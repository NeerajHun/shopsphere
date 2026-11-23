import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { User, UserRole } from '../users/entities/user.entity';
import { UserSession } from '../users/entities/user-session.entity';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';

jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

jest.mock('@nestjs/config', () => ({
  ConfigService: class {},
}));

jest.mock('@nestjs/jwt', () => ({
  JwtService: class {},
}));

jest.mock('typeorm', () => {
  const decorator = () => () => undefined;

  return {
    Repository: class {},
    IsNull: jest.fn(() => 'IS_NULL'),

    Entity: decorator,
    Column: decorator,
    PrimaryGeneratedColumn: decorator,
    PrimaryColumn: decorator,
    CreateDateColumn: decorator,
    UpdateDateColumn: decorator,
    Index: decorator,
    Unique: decorator,

    ManyToOne: decorator,
    OneToMany: decorator,
    OneToOne: decorator,
    ManyToMany: decorator,
    JoinColumn: decorator,
    JoinTable: decorator,
  };
});

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('AuthService - Login Lockout', () => {
  let service: AuthService;
  let user: User;

  let userRepo: any;
  let sessionRepo: any;
  let jwtService: any;
  let configService: any;

  const loginDto = {
    email: 'USER@EXAMPLE.COM',
    password: 'WrongPassword123!',
  };

  const setup = (overrides: Partial<User> = {}) => {
    user = {
      id: 'user-id',
      email: 'user@example.com',
      password: 'hashed-password',
      firstName: 'John',
      lastName: 'Doe',
      role: UserRole.USER,
      isActive: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      ...overrides,
    } as User;

    const queryBuilder = {
      setLock: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(user),
    };

    userRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      save: jest.fn(async (entity) => entity),
    };

    sessionRepo = {
      create: jest.fn((data) => data),
      save: jest.fn(async (entity) => entity),
    };

    const manager = {
      getRepository: jest.fn((entity) =>
        entity === User ? userRepo : sessionRepo,
      ),
    };

    const transaction = jest.fn(async (callback) => callback(manager));

    const userRepository = {
      manager: { transaction },
    };

    const sessionRepository = {};

    jwtService = {
      signAsync: jest
        .fn()
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token'),
    };

    configService = {
      getOrThrow: jest.fn().mockReturnValue('test-refresh-secret'),
    };

    service = new AuthService(
      userRepository as any,
      sessionRepository as any,
      jwtService as any,
      configService as any,
    );
    return {
      queryBuilder,
      transaction,
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should increment failed login attempts for an incorrect password', async () => {
    setup();

    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(service.login(loginDto)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(user.failedLoginAttempts).toBe(1);
    expect(user.lockedUntil).toBeNull();
    expect(userRepo.save).toHaveBeenCalledWith(user);
  });

  it('should lock the account after five failed attempts', async () => {
    setup({ failedLoginAttempts: 4 });

    const before = Date.now();

    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(service.login(loginDto)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(user.failedLoginAttempts).toBe(5);
    expect(user.lockedUntil).toBeInstanceOf(Date);

    const lockDuration = user.lockedUntil!.getTime() - before;

    expect(lockDuration).toBeGreaterThanOrEqual(15 * 60 * 1000);
    expect(lockDuration).toBeLessThanOrEqual(15 * 60 * 1000 + 1000);
  });

  it('should reject login when the account is locked', async () => {
    setup({
      failedLoginAttempts: 5,
      lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
    });

    await expect(service.login(loginDto)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(bcrypt.compare).not.toHaveBeenCalled();
    expect(user.failedLoginAttempts).toBe(5);
    expect(userRepo.save).not.toHaveBeenCalled();
  });

  it('should reset expired lockout after successful login', async () => {
    setup({
      failedLoginAttempts: 5,
      lockedUntil: new Date(Date.now() - 1000),
    });

    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const result = await service.login(
      {
        email: 'USER@EXAMPLE.COM',
        password: 'CorrectPassword123!',
      },
      {
        userAgent: 'Jest Test',
        ipAddress: '127.0.0.1',
      },
    );

    expect(user.failedLoginAttempts).toBe(0);
    expect(user.lockedUntil).toBeNull();

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');

    expect(userRepo.save).toHaveBeenCalledWith(user);
    expect(sessionRepo.create).toHaveBeenCalled();
    expect(sessionRepo.save).toHaveBeenCalled();
  });

  it('should reject login when the email does not exist', async () => {
    const { queryBuilder } = setup();

    queryBuilder.getOne.mockResolvedValue(null);

    await expect(service.login(loginDto)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  it('should reject login when the user account is inactive', async () => {
    setup({ isActive: false });

    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    await expect(service.login(loginDto)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  it('should normalize email before querying the database', async () => {
    const { queryBuilder } = setup();

    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(service.login(loginDto)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(queryBuilder.where).toHaveBeenCalledWith('user.email = :email', {
      email: 'user@example.com',
    });
  });

  it('should reset failed attempts after a successful login', async () => {
    setup({ failedLoginAttempts: 3 });

    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const result = await service.login({
      email: 'user@example.com',
      password: 'CorrectPassword123!',
    });

    expect(user.failedLoginAttempts).toBe(0);
    expect(user.lockedUntil).toBeNull();
    expect(result.accessToken).toBe('access-token');
  });

  it('should save user agent and IP address in the session', async () => {
    setup();

    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    await service.login(
      {
        email: 'user@example.com',
        password: 'CorrectPassword123!',
      },
      {
        userAgent: 'Ubuntu-Laptop',
        ipAddress: '127.0.0.1',
      },
    );

    expect(sessionRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userAgent: 'Ubuntu-Laptop',
        ipAddress: '127.0.0.1',
      }),
    );
  });

  describe('AuthService - Refresh Token', () => {
    let service: AuthService;
    let session: any;
    let queryBuilder: any;
    let sessionRepo: any;
    let jwtService: any;
    let configService: any;

    const refreshToken = 'old-refresh-token';
    const newRefreshToken = 'new-refresh-token';

    const hashToken = (token: string) =>
      createHash('sha256').update(token).digest('hex');

    beforeEach(() => {
      session = {
        id: 'session-id',
        userId: 'user-id',
        refreshTokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        revokedAt: null,
        lastUsedAt: new Date(),
        user: {
          id: 'user-id',
          email: 'user@example.com',
          role: UserRole.USER,
          isActive: true,
        },
      };

      queryBuilder = {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setLock: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(session),
      };

      sessionRepo = {
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
        save: jest.fn(async (entity) => entity),
      };

      const manager = {
        getRepository: jest.fn().mockReturnValue(sessionRepo),
      };

      sessionRepo.manager = {
        transaction: jest.fn(async (callback) => callback(manager)),
      };

      jwtService = {
        verifyAsync: jest.fn().mockResolvedValue({
          sub: 'user-id',
          email: 'user@example.com',
          tokenUse: 'refresh',
          sid: 'session-id',
        }),
        signAsync: jest
          .fn()
          .mockResolvedValueOnce('new-access-token')
          .mockResolvedValueOnce(newRefreshToken),
      };

      configService = {
        getOrThrow: jest.fn().mockReturnValue('test-refresh-secret'),
      };

      service = new AuthService(
        {} as any,
        sessionRepo as any,
        jwtService as any,
        configService as any,
      );
    });

    it('should rotate refresh token and update the session', async () => {
      const result = await service.refresh(refreshToken);

      expect(jwtService.verifyAsync).toHaveBeenCalledWith(refreshToken, {
        secret: 'test-refresh-secret',
      });

      expect(jwtService.signAsync).toHaveBeenCalledTimes(2);

      expect(sessionRepo.save).toHaveBeenCalledTimes(1);

      expect(session.refreshTokenHash).toBe(hashToken(newRefreshToken));

      expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());

      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: newRefreshToken,
        tokenType: 'Bearer',
        expiresIn: '15m',
        refreshExpiresIn: '7d',
      });
    });

    it('should reject an invalid or expired refresh token', async () => {
      jwtService.verifyAsync.mockRejectedValueOnce(new Error('Token expired'));

      await expect(service.refresh(refreshToken)).rejects.toThrow(
        'Invalid or expired refresh token',
      );

      expect(sessionRepo.manager.transaction).not.toHaveBeenCalled();
    });

    it('should reject a token with an invalid payload', async () => {
      jwtService.verifyAsync.mockResolvedValueOnce({
        sub: 'user-id',
        email: 'user@example.com',
        tokenUse: 'access',
        sid: 'session-id',
      });

      await expect(service.refresh(refreshToken)).rejects.toThrow(
        'Invalid refresh token',
      );

      expect(sessionRepo.manager.transaction).not.toHaveBeenCalled();
    });

    it('should reject refresh when the session does not exist', async () => {
      queryBuilder.getOne.mockResolvedValueOnce(null);

      await expect(service.refresh(refreshToken)).rejects.toThrow(
        'Invalid or expired session',
      );

      expect(sessionRepo.save).not.toHaveBeenCalled();
    });

    it('should reject a revoked session', async () => {
      session.revokedAt = new Date();

      await expect(service.refresh(refreshToken)).rejects.toThrow(
        'Invalid or expired session',
      );

      expect(sessionRepo.save).not.toHaveBeenCalled();
    });

    it('should reject a session belonging to an inactive user', async () => {
      session.user.isActive = false;

      await expect(service.refresh(refreshToken)).rejects.toThrow(
        'Invalid or expired session',
      );

      expect(sessionRepo.save).not.toHaveBeenCalled();
    });

    it('should reject an expired session', async () => {
      session.expiresAt = new Date(Date.now() - 1000);

      await expect(service.refresh(refreshToken)).rejects.toThrow(
        'Invalid or expired session',
      );

      expect(sessionRepo.save).not.toHaveBeenCalled();
    });

    it('should reject refresh-token reuse when the stored hash does not match', async () => {
      session.refreshTokenHash = hashToken('some-other-token');

      await expect(service.refresh(refreshToken)).rejects.toThrow(
        'Refresh token has been revoked',
      );

      expect(sessionRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('AuthService - Logout', () => {
    let service: AuthService;
    let session: any;
    let sessionRepo: any;
    let queryBuilder: any;
    let jwtService: any;
    let configService: any;

    const refreshToken = 'logout-refresh-token';

    const hashToken = (token: string) =>
      createHash('sha256').update(token).digest('hex');

    beforeEach(() => {
      session = {
        id: 'session-id',
        userId: 'user-id',
        refreshTokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        revokedAt: null,
      };

      queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setLock: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(session),
      };

      sessionRepo = {
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
        save: jest.fn(async (entity) => entity),
      };

      const manager = {
        getRepository: jest.fn().mockReturnValue(sessionRepo),
      };

      sessionRepo.manager = {
        transaction: jest.fn(async (callback) => callback(manager)),
      };

      jwtService = {
        verifyAsync: jest.fn().mockResolvedValue({
          sub: 'user-id',
          email: 'user@example.com',
          tokenUse: 'refresh',
          sid: 'session-id',
        }),
      };

      configService = {
        getOrThrow: jest.fn().mockReturnValue('test-refresh-secret'),
      };

      service = new AuthService(
        {} as any,
        sessionRepo as any,
        jwtService as any,
        configService as any,
      );
    });

    it('should successfully revoke the session during logout', async () => {
      const result = await service.logout(refreshToken);

      expect(result).toEqual({
        message: 'Logged out successfully',
      });

      expect(session.revokedAt).toBeInstanceOf(Date);
      expect(sessionRepo.save).toHaveBeenCalledWith(session);
    });

    it('should reject an invalid or expired refresh token', async () => {
      jwtService.verifyAsync.mockRejectedValueOnce(new Error('Invalid token'));

      await expect(service.logout(refreshToken)).rejects.toThrow(
        'Invalid or expired refresh token',
      );

      expect(sessionRepo.manager.transaction).not.toHaveBeenCalled();
    });

    it('should reject an already revoked session', async () => {
      session.revokedAt = new Date();

      await expect(service.logout(refreshToken)).rejects.toThrow(
        'Session is already invalid',
      );

      expect(sessionRepo.save).not.toHaveBeenCalled();
    });

    it('should reject logout when the refresh token hash does not match', async () => {
      session.refreshTokenHash = hashToken('another-token');

      await expect(service.logout(refreshToken)).rejects.toThrow(
        'Invalid refresh token',
      );

      expect(sessionRepo.save).not.toHaveBeenCalled();
    });

    it('should reject a refresh token with an invalid payload', async () => {
      jwtService.verifyAsync.mockResolvedValueOnce({
        sub: 'user-id',
        email: 'user@example.com',
        tokenUse: 'access',
        sid: 'session-id',
      });

      await expect(service.logout(refreshToken)).rejects.toThrow(
        'Invalid refresh token',
      );

      expect(sessionRepo.manager.transaction).not.toHaveBeenCalled();
    });
  });

  describe('AuthService - Get Active Sessions', () => {
    let service: AuthService;
    let sessionRepo: any;

    beforeEach(() => {
      sessionRepo = {
        find: jest.fn(),
      };

      service = new AuthService(
        {} as any,
        sessionRepo as any,
        {} as any,
        {} as any,
      );
    });

    it('should return active sessions and identify the current session', async () => {
      const now = new Date();

      sessionRepo.find.mockResolvedValue([
        {
          id: 'session-1',
          userAgent: 'Ubuntu Chrome',
          ipAddress: '192.168.1.10',
          createdAt: now,
          lastUsedAt: now,
          expiresAt: new Date(Date.now() + 60_000),
        },
        {
          id: 'session-2',
          userAgent: 'Android Chrome',
          ipAddress: '192.168.1.20',
          createdAt: now,
          lastUsedAt: now,
          expiresAt: new Date(Date.now() + 60_000),
        },
        {
          id: 'session-3',
          userAgent: 'Expired Device',
          ipAddress: '192.168.1.30',
          createdAt: now,
          lastUsedAt: now,
          expiresAt: new Date(Date.now() - 60_000),
        },
      ]);

      const result = await service.getActiveSessions('user-id', 'session-1');

      expect(result).toHaveLength(2);

      expect(result[0].current).toBe(true);
      expect(result[1].current).toBe(false);

      expect(result.map((item) => item.id)).toEqual(['session-1', 'session-2']);

      expect(sessionRepo.find).toHaveBeenCalledWith({
        where: {
          userId: 'user-id',
          revokedAt: 'IS_NULL',
        },
        order: {
          createdAt: 'DESC',
        },
      });
    });

    it('should return an empty array when no sessions exist', async () => {
      sessionRepo.find.mockResolvedValue([]);

      const result = await service.getActiveSessions('user-id', 'session-1');

      expect(result).toEqual([]);
    });
  });

  describe('AuthService - Revoke Session', () => {
    let service: AuthService;
    let session: any;
    let sessionRepo: any;
    let queryBuilder: any;

    beforeEach(() => {
      session = {
        id: 'session-id',
        userId: 'user-id',
        revokedAt: null,
      };

      queryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setLock: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(session),
      };

      sessionRepo = {
        createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
        save: jest.fn(async (entity) => entity),
      };

      const manager = {
        getRepository: jest.fn().mockReturnValue(sessionRepo),
      };

      sessionRepo.manager = {
        transaction: jest.fn(async (callback) => callback(manager)),
      };

      service = new AuthService(
        {} as any,
        sessionRepo as any,
        {} as any,
        {} as any,
      );
    });

    it('should successfully revoke a session', async () => {
      const result = await service.revokeSession('user-id', 'session-id');

      expect(result).toEqual({
        message: 'Session revoked successfully',
      });

      expect(session.revokedAt).toBeInstanceOf(Date);
      expect(sessionRepo.save).toHaveBeenCalledWith(session);
    });

    it('should throw NotFoundException when session does not exist', async () => {
      queryBuilder.getOne.mockResolvedValueOnce(null);

      await expect(
        service.revokeSession('user-id', 'unknown-session'),
      ).rejects.toThrow('Session not found');

      expect(sessionRepo.save).not.toHaveBeenCalled();
    });

    it('should return a message when the session is already revoked', async () => {
      session.revokedAt = new Date();

      const result = await service.revokeSession('user-id', 'session-id');

      expect(result).toEqual({
        message: 'Session already revoked',
      });

      expect(sessionRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('AuthService - Revoke All Sessions', () => {
    let service: AuthService;
    let sessionRepo: any;

    beforeEach(() => {
      sessionRepo = {
        update: jest.fn(),
      };

      const manager = {
        getRepository: jest.fn().mockReturnValue(sessionRepo),
      };

      sessionRepo.manager = {
        transaction: jest.fn(async (callback) => callback(manager)),
      };

      service = new AuthService(
        {} as any,
        sessionRepo as any,
        {} as any,
        {} as any,
      );
    });

    it('should revoke all active sessions and return the count', async () => {
      sessionRepo.update.mockResolvedValue({ affected: 5 });

      const result = await service.revokeAllSessions('user-id');

      expect(result).toEqual({
        message: 'Logged out from all devices successfully',
        revokedCount: 5,
      });

      expect(sessionRepo.update).toHaveBeenCalledWith(
        {
          userId: 'user-id',
          revokedAt: 'IS_NULL',
        },
        expect.objectContaining({
          revokedAt: expect.any(Date),
        }),
      );
    });

    it('should return zero when no active sessions exist', async () => {
      sessionRepo.update.mockResolvedValue({ affected: 0 });

      const result = await service.revokeAllSessions('user-id');

      expect(result.revokedCount).toBe(0);
    });

    it('should return zero when affected is undefined', async () => {
      sessionRepo.update.mockResolvedValue({});

      const result = await service.revokeAllSessions('user-id');

      expect(result.revokedCount).toBe(0);
    });
  });

  describe('AuthService - Register', () => {
    let service: AuthService;
    let userRepo: any;
    let bcryptHash: jest.SpyInstance;

    const registerDto = {
      email: '  USER@EXAMPLE.COM  ',
      password: 'StrongPassword123!',
      firstName: '  John  ',
      lastName: '  Doe  ',
    };

    beforeEach(() => {
      userRepo = {
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn((data) => data),
        save: jest.fn(),
      };

      service = new AuthService(
        userRepo as any,
        {} as any,
        {} as any,
        {} as any,
      );

      bcryptHash = jest.spyOn(bcrypt, 'hash') as jest.SpyInstance;
      bcryptHash.mockResolvedValue('hashed-password' as never);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should register a user successfully', async () => {
      const savedUser = {
        id: 'user-id',
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.USER,
        isActive: true,
        createdAt: new Date(),
        password: 'hashed-password',
      };

      userRepo.save.mockResolvedValue(savedUser);

      const result = await service.register(registerDto);

      expect(userRepo.findOne).toHaveBeenCalledWith({
        where: { email: 'user@example.com' },
      });

      expect(bcryptHash).toHaveBeenCalledWith(registerDto.password, 12);

      expect(userRepo.create).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'hashed-password',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.USER,
      });

      expect(result).toEqual({
        id: 'user-id',
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: UserRole.USER,
        isActive: true,
        createdAt: savedUser.createdAt,
      });

      expect(result).not.toHaveProperty('password');
    });

    it('should reject registration when email already exists', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'existing-user-id',
        email: 'user@example.com',
      });

      await expect(service.register(registerDto)).rejects.toThrow(
        'Email is already registered',
      );

      expect(bcryptHash).not.toHaveBeenCalled();
      expect(userRepo.save).not.toHaveBeenCalled();
    });

    it('should handle duplicate email database constraint errors', async () => {
      userRepo.create.mockReturnValue({ email: 'user@example.com' });

      userRepo.save.mockRejectedValue({
        code: '23505',
      });

      await expect(service.register(registerDto)).rejects.toThrow(
        'Email is already registered',
      );
    });

    it('should rethrow unexpected database errors', async () => {
      const databaseError = new Error('Database connection failed');

      userRepo.save.mockRejectedValue(databaseError);

      await expect(service.register(registerDto)).rejects.toThrow(
        databaseError,
      );
    });

    it('should set optional names to null when they are empty', async () => {
      userRepo.create.mockImplementation((data: any) => data);

      userRepo.save.mockImplementation(async (user: any) => ({
        id: 'user-id',
        ...user,
        isActive: true,
        createdAt: new Date(),
      }));

      await service.register({
        email: 'user@example.com',
        password: 'StrongPassword123!',
        firstName: '   ',
        lastName: '   ',
      });

      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: null,
          lastName: null,
        }),
      );
    });
  });
});
