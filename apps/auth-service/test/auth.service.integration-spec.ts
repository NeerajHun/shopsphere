import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

import { AuthService } from '../src/modules/auth/auth.service';
import { User } from '../src/modules/users/entities/user.entity';
import { UserSession } from '../src/modules/users/entities/user-session.entity';
import { RegisterDto } from '../src/modules/auth/dto/register.dto';
import { LoginDto } from '../src/modules/auth/dto/login.dto';

import {
  initializeTestDatabase,
  closeTestDatabase,
  cleanTestDatabase,
} from './helpers/database-setup';

import { testDataSource } from './helpers/database.helper';
import { createHash } from 'crypto';

describe('AuthService - PostgreSQL Integration', () => {
  let authService: AuthService;

  beforeAll(async () => {
    await initializeTestDatabase();

    const userRepository = testDataSource.getRepository(User);
    const sessionRepository = testDataSource.getRepository(UserSession);

    const jwtService = new JwtService({
      secret: process.env.JWT_SECRET,
      signOptions: {
        expiresIn: '15m',
      },
    });

    const configService = new ConfigService({
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
      JWT_REFRESH_EXPIRY: '7d',
    });

    authService = new AuthService(
      userRepository,
      sessionRepository,
      jwtService,
      configService,
    );
  });

  beforeEach(async () => {
    await cleanTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  describe('Registration', () => {
    it('should register a user and persist it in PostgreSQL', async () => {
      const dto: RegisterDto = {
        email: '  TestUser@Example.com  ',
        password: 'StrongPassword123!',
        firstName: ' John ',
        lastName: ' Doe ',
      };

      const result = await authService.register(dto);

      expect(result.email).toBe('testuser@example.com');
      expect(result.firstName).toBe('John');
      expect(result.lastName).toBe('Doe');
      expect(result).not.toHaveProperty('password');

      const savedUser = await testDataSource.getRepository(User).findOne({
        where: { email: 'testuser@example.com' },
        select: {
          id: true,
          email: true,
          password: true,
          role: true,
        },
      });

      expect(savedUser).not.toBeNull();
      expect(savedUser!.password).not.toBe(dto.password);
      expect(savedUser!.password).toMatch(/^\$2[aby]\$/);
    });

    it('should reject duplicate email registration', async () => {
      const dto: RegisterDto = {
        email: 'duplicate@example.com',
        password: 'StrongPassword123!',
      };

      await authService.register(dto);

      await expect(authService.register(dto)).rejects.toThrow(
        'Email is already registered',
      );

      const users = await testDataSource.getRepository(User).find({
        where: { email: 'duplicate@example.com' },
      });

      expect(users).toHaveLength(1);
    });
  });

  describe('Login', () => {
    it('should authenticate a registered user and create a session in PostgreSQL', async () => {
      await authService.register({
        email: 'login@example.com',
        password: 'StrongPassword123!',
        firstName: 'John',
        lastName: 'Doe',
      });

      const result = await authService.login(
        {
          email: 'LOGIN@example.com',
          password: 'StrongPassword123!',
        } as LoginDto,
        {
          userAgent: 'Integration-Test',
          ipAddress: '127.0.0.1',
        },
      );

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.tokenType).toBe('Bearer');
      expect(result.user.email).toBe('login@example.com');

      const sessions = await testDataSource.getRepository(UserSession).find();

      expect(sessions).toHaveLength(1);
      expect(sessions[0].userAgent).toBe('Integration-Test');
      expect(sessions[0].ipAddress).toBe('127.0.0.1');
      expect(sessions[0].refreshTokenHash).not.toBe(result.refreshToken);
    });
  });

  it('should rotate refresh tokens and persist the new token hash', async () => {
    const registerDto: RegisterDto = {
      email: 'refresh@example.com',
      password: 'StrongPassword123!',
      firstName: 'Refresh',
      lastName: 'Test',
    };

    const user = await authService.register(registerDto);

    const loginResult = await authService.login({
      email: registerDto.email,
      password: registerDto.password,
    } as LoginDto);

    const oldRefreshToken = loginResult.refreshToken;

    const refreshed = await authService.refresh(oldRefreshToken);

    expect(refreshed.accessToken).toBeDefined();
    expect(refreshed.refreshToken).toBeDefined();
    expect(refreshed.refreshToken).not.toBe(oldRefreshToken);

    const sessionRepository = testDataSource.getRepository(UserSession);

    const session = await sessionRepository.findOne({
      where: { userId: user.id },
    });

    expect(session).not.toBeNull();

    const expectedHash = createHash('sha256')
      .update(refreshed.refreshToken)
      .digest('hex');

    expect(session!.refreshTokenHash).toBe(expectedHash);
    expect(session!.lastUsedAt).toBeInstanceOf(Date);
  });

  it('should reject reuse of the old refresh token after rotation', async () => {
    const registerDto: RegisterDto = {
      email: 'reuse@example.com',
      password: 'StrongPassword123!',
    };

    await authService.register(registerDto);

    const loginResult = await authService.login({
      email: registerDto.email,
      password: registerDto.password,
    } as LoginDto);

    const oldRefreshToken = loginResult.refreshToken;

    await authService.refresh(oldRefreshToken);

    await expect(authService.refresh(oldRefreshToken)).rejects.toThrow(
      'Refresh token has been revoked',
    );
  });

  it('should allow the newly rotated refresh token to be used', async () => {
    const registerDto: RegisterDto = {
      email: 'rotation@example.com',
      password: 'StrongPassword123!',
    };

    await authService.register(registerDto);

    const loginResult = await authService.login({
      email: registerDto.email,
      password: registerDto.password,
    } as LoginDto);

    const firstRefresh = await authService.refresh(loginResult.refreshToken);

    const secondRefresh = await authService.refresh(firstRefresh.refreshToken);

    expect(secondRefresh.accessToken).toBeDefined();
    expect(secondRefresh.refreshToken).toBeDefined();
    expect(secondRefresh.refreshToken).not.toBe(firstRefresh.refreshToken);
  });

  it('should revoke the session in PostgreSQL on logout', async () => {
    const registerDto: RegisterDto = {
      email: 'logout@example.com',
      password: 'StrongPassword123!',
    };

    const user = await authService.register(registerDto);

    const loginResult = await authService.login({
      email: registerDto.email,
      password: registerDto.password,
    } as LoginDto);

    const result = await authService.logout(loginResult.refreshToken);

    expect(result.message).toBe('Logged out successfully');

    const sessionRepository = testDataSource.getRepository(UserSession);

    const session = await sessionRepository.findOne({
      where: { userId: user.id },
    });

    expect(session).not.toBeNull();
    expect(session!.revokedAt).toBeInstanceOf(Date);
  });

  it('should reject refresh after logout', async () => {
    const registerDto: RegisterDto = {
      email: 'afterlogout@example.com',
      password: 'StrongPassword123!',
    };

    await authService.register(registerDto);

    const loginResult = await authService.login({
      email: registerDto.email,
      password: registerDto.password,
    } as LoginDto);

    await authService.logout(loginResult.refreshToken);

    await expect(authService.refresh(loginResult.refreshToken)).rejects.toThrow(
      'Invalid or expired session',
    );
  });

  describe('Session Management', () => {
    it('should revoke a specific session and persist revokedAt', async () => {
      const user = await authService.register({
        email: 'revoke@example.com',
        password: 'StrongPassword123!',
      });

      const loginResult = await authService.login({
        email: 'revoke@example.com',
        password: 'StrongPassword123!',
      } as LoginDto);

      const sessionRepository = testDataSource.getRepository(UserSession);

      const session = await sessionRepository.findOne({
        where: { userId: user.id },
      });

      expect(session).not.toBeNull();
      expect(session!.revokedAt).toBeNull();

      const result = await authService.revokeSession(user.id, session!.id);

      expect(result.message).toBe('Session revoked successfully');

      const updatedSession = await sessionRepository.findOne({
        where: { id: session!.id },
      });

      expect(updatedSession!.revokedAt).toBeInstanceOf(Date);

      await expect(
        authService.refresh(loginResult.refreshToken),
      ).rejects.toThrow('Invalid or expired session');
    });

    it('should not allow a user to revoke another user session', async () => {
      const firstUser = await authService.register({
        email: 'owner@example.com',
        password: 'StrongPassword123!',
      });

      const secondUser = await authService.register({
        email: 'other@example.com',
        password: 'StrongPassword123!',
      });

      await authService.login({
        email: 'owner@example.com',
        password: 'StrongPassword123!',
      } as LoginDto);

      const sessionRepository = testDataSource.getRepository(UserSession);

      const session = await sessionRepository.findOne({
        where: { userId: firstUser.id },
      });

      expect(session).not.toBeNull();

      await expect(
        authService.revokeSession(secondUser.id, session!.id),
      ).rejects.toThrow('Session not found');

      const unchangedSession = await sessionRepository.findOne({
        where: { id: session!.id },
      });

      expect(unchangedSession!.revokedAt).toBeNull();
    });

    it('should handle an already revoked session', async () => {
      const user = await authService.register({
        email: 'alreadyrevoked@example.com',
        password: 'StrongPassword123!',
      });

      await authService.login({
        email: 'alreadyrevoked@example.com',
        password: 'StrongPassword123!',
      } as LoginDto);

      const sessionRepository = testDataSource.getRepository(UserSession);

      const session = await sessionRepository.findOne({
        where: { userId: user.id },
      });

      expect(session).not.toBeNull();

      const firstResult = await authService.revokeSession(user.id, session!.id);

      expect(firstResult.message).toBe('Session revoked successfully');

      const secondResult = await authService.revokeSession(
        user.id,
        session!.id,
      );

      expect(secondResult.message).toBe('Session already revoked');
    });

    it('should revoke all active sessions and return the affected count', async () => {
      const user = await authService.register({
        email: 'revokeall@example.com',
        password: 'StrongPassword123!',
      });

      // Create three independent sessions for the same user.
      for (let i = 0; i < 3; i++) {
        await authService.login({
          email: 'revokeall@example.com',
          password: 'StrongPassword123!',
        } as LoginDto);
      }

      const sessionRepository = testDataSource.getRepository(UserSession);

      const sessionsBefore = await sessionRepository.find({
        where: { userId: user.id },
      });

      expect(sessionsBefore).toHaveLength(3);

      const result = await authService.revokeAllSessions(user.id);

      expect(result.message).toBe('Logged out from all devices successfully');
      expect(result.revokedCount).toBe(3);

      const sessionsAfter = await sessionRepository.find({
        where: { userId: user.id },
      });

      expect(sessionsAfter).toHaveLength(3);

      for (const session of sessionsAfter) {
        expect(session.revokedAt).toBeInstanceOf(Date);
      }
    });

    it('should return zero when no active sessions exist', async () => {
      const user = await authService.register({
        email: 'noactive@example.com',
        password: 'StrongPassword123!',
      });

      const result = await authService.revokeAllSessions(user.id);

      expect(result.revokedCount).toBe(0);
    });
  });

  describe('Concurrent Refresh', () => {
    it('should allow only one concurrent refresh using the same token', async () => {
      await authService.register({
        email: 'concurrent@example.com',
        password: 'StrongPassword123!',
      });

      const loginResult = await authService.login({
        email: 'concurrent@example.com',
        password: 'StrongPassword123!',
      } as LoginDto);

      const oldRefreshToken = loginResult.refreshToken;

      const results = await Promise.allSettled([
        authService.refresh(oldRefreshToken),
        authService.refresh(oldRefreshToken),
      ]);

      const successfulResult = results.find(
        (result) => result.status === 'fulfilled',
      );

      const rejectedResult = results.find(
        (result) => result.status === 'rejected',
      );

      expect(successfulResult?.status).toBe('fulfilled');
      expect(rejectedResult?.status).toBe('rejected');

      if (!successfulResult || successfulResult.status !== 'fulfilled') {
        throw new Error('Expected exactly one successful refresh');
      }

      const session = await testDataSource.getRepository(UserSession).findOne({
        where: {
          userId: (
            await testDataSource.getRepository(User).findOneByOrFail({
              email: 'concurrent@example.com',
            })
          ).id,
        },
      });

      expect(session).not.toBeNull();

      const expectedHash = createHash('sha256')
        .update(successfulResult.value.refreshToken)
        .digest('hex');

      expect(session!.refreshTokenHash).toBe(expectedHash);
    });
  });
});
