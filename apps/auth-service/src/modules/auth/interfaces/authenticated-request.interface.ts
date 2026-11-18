import { Request } from 'express';
import { UserRole } from '../../users/entities/user.entity';

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    role: UserRole;
    sessionId: string;
  };
}
