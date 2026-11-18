import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { UserSession } from '../../users/entities/user-session.entity';
import { Repository } from 'typeorm';

interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  sessionId: string;
}

interface AuthenticatedRequest {
  headers: {
    authorization?: string;
  };
  user?: AuthenticatedUser;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(UserSession)
    private readonly sessionRepository: Repository<UserSession>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Access token is required');
    }

    const token = authorization.substring(7);

    try {
      const payload = await this.jwtService.verifyAsync(token);

      if (!payload.sub || !payload.email || !payload.role || !payload.sid) {
        throw new UnauthorizedException('Invalid access token');
      }

      const session = await this.sessionRepository
        .createQueryBuilder('session')
        .innerJoinAndSelect('session.user', 'user')
        .select([
          'session.id',
          'session.userId',
          'session.expiresAt',
          'session.revokedAt',
          'user.id',
          'user.isActive',
        ])
        .where('session.id = :sessionId', {
          sessionId: payload.sid,
        })
        .andWhere('session.userId = :userId', {
          userId: payload.sub,
        })
        .getOne();

      if (
        !session ||
        session.revokedAt ||
        session.expiresAt.getTime() <= Date.now() ||
        !session.user.isActive
      ) {
        throw new UnauthorizedException('Session is invalid or expired');
      }

      request.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        sessionId: payload.sid,
      };

      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }
}
