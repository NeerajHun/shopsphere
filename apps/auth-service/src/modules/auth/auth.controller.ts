import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { UserRole } from '../users/entities/user.entity';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LogoutDto } from './dto/logout.dto';
import { Throttle } from '@nestjs/throttler';

interface AuthenticatedRequest {
  user: {
    id: string;
    email: string;
    role: string;
    sessionId: string;
  };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  register(@Body() dto: RegisterDto, @Req() request: Request) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.authService.login(dto, {
      userAgent: request.get('user-agent') ?? null,
      ipAddress: request.ip ?? null,
    });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getProfile(@Req() request: AuthenticatedRequest) {
    return {
      user: request.user,
    };
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  getAdminData() {
    return {
      message: 'Welcome Admin!',
      access: 'You have administrator permissions.',
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Body() dto: LogoutDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  async getSessions(@Req() request: AuthenticatedRequest) {
    return this.authService.getActiveSessions(
      request.user.id,
      request.user.sessionId,
    );
  }

  @Delete('sessions/:sessionId')
  @UseGuards(JwtAuthGuard)
  async revokeSession(
    @Req() request: AuthenticatedRequest,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
  ) {
    return this.authService.revokeSession(request.user.id, sessionId);
  }

  @Delete('sessions')
  @UseGuards(JwtAuthGuard)
  async revokeAllSessions(@Req() request: AuthenticatedRequest) {
    return this.authService.revokeAllSessions(request.user.id);
  }
}
