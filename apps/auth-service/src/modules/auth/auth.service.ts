import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { User, UserRole } from '../users/entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtService } from '@nestjs/jwt';
import { UserSession } from '../users/entities/user-session.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserSession)
    private readonly sessionRepository: Repository<UserSession>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();

    const existingUser = await this.userRepository.findOne({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const user = this.userRepository.create({
      email,
      password: hashedPassword,
      firstName: dto.firstName?.trim() || null,
      lastName: dto.lastName?.trim() || null,
      role: UserRole.USER,
    });

    try {
      const savedUser = await this.userRepository.save(user);

      // Never return the password or password hash.
      return {
        id: savedUser.id,
        email: savedUser.email,
        firstName: savedUser.firstName,
        lastName: savedUser.lastName,
        role: savedUser.role,
        isActive: savedUser.isActive,
        createdAt: savedUser.createdAt,
      };
    } catch (error) {
      // Handles concurrent requests for the same email.
      if (error?.code === '23505') {
        throw new ConflictException('Email is already registered');
      }

      throw error;
    }
  }

  async login(
    dto: LoginDto,
    metadata?: {
      userAgent?: string | null;
      ipAddress?: string | null;
    },
  ) {
    const email = dto.email.trim().toLowerCase();

    // Password has select: false, so explicitly select it.
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email })
      .getOne();

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.password);

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive');
    }

    // Generate a unique session ID.
    const sessionId = randomUUID();

    // Generate access token.
    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    // Generate refresh token with session ID.
    const refreshToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        tokenUse: 'refresh',
        sid: sessionId,
      },
      {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: '7d',
      },
    );

    // Store session information.
    const session = this.sessionRepository.create({
      id: sessionId,
      userId: user.id,
      refreshTokenHash: this.hashToken(refreshToken),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      lastUsedAt: new Date(),
      userAgent: metadata?.userAgent ?? null,
      ipAddress: metadata?.ipAddress ?? null,
    });

    await this.sessionRepository.save(session);

    // Return tokens.
    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: '15m',
      refreshExpiresIn: '7d',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  async refresh(refreshToken: string) {
    let payload: {
      sub: string;
      email: string;
      tokenUse: string;
      sid: string;
    };

    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (!payload.sub || payload.tokenUse !== 'refresh' || !payload.sid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.sessionRepository.manager.transaction(async (manager) => {
      const sessionRepository = manager.getRepository(UserSession);

      const session = await sessionRepository
        .createQueryBuilder('session')
        .innerJoinAndSelect('session.user', 'user')
        .where('session.id = :sessionId', {
          sessionId: payload.sid,
        })
        .andWhere('session.userId = :userId', {
          userId: payload.sub,
        })
        .setLock('pessimistic_write')
        .getOne();

      if (
        !session ||
        session.revokedAt ||
        !session.user.isActive ||
        session.expiresAt.getTime() <= Date.now()
      ) {
        throw new UnauthorizedException('Invalid or expired session');
      }

      const suppliedHash = this.hashToken(refreshToken);

      if (suppliedHash !== session.refreshTokenHash) {
        throw new UnauthorizedException('Refresh token has been revoked');
      }

      const accessToken = await this.jwtService.signAsync({
        sub: session.user.id,
        email: session.user.email,
        role: session.user.role,
      });

      const newRefreshToken = await this.jwtService.signAsync(
        {
          sub: session.user.id,
          email: session.user.email,
          tokenUse: 'refresh',
          sid: session.id,
        },
        {
          secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
          expiresIn: '7d',
        },
      );

      session.refreshTokenHash = this.hashToken(newRefreshToken);
      session.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      session.lastUsedAt = new Date();

      await sessionRepository.save(session);

      return {
        accessToken,
        refreshToken: newRefreshToken,
        tokenType: 'Bearer',
        expiresIn: '15m',
        refreshExpiresIn: '7d',
      };
    });
  }

  async logout(refreshToken: string) {
    let payload: {
      sub: string;
      email: string;
      tokenUse: string;
      sid: string;
    };

    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (!payload.sub || payload.tokenUse !== 'refresh' || !payload.sid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.sessionRepository.manager.transaction(async (manager) => {
      const sessionRepository = manager.getRepository(UserSession);

      const session = await sessionRepository
        .createQueryBuilder('session')
        .where('session.id = :sessionId', { sessionId: payload.sid })
        .andWhere('session.userId = :userId', { userId: payload.sub })
        .setLock('pessimistic_write')
        .getOne();

      if (
        !session ||
        session.revokedAt ||
        session.expiresAt.getTime() <= Date.now()
      ) {
        throw new UnauthorizedException('Session is already invalid');
      }

      if (this.hashToken(refreshToken) !== session.refreshTokenHash) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      session.revokedAt = new Date();
      await sessionRepository.save(session);

      return { message: 'Logged out successfully' };
    });
  }
}
