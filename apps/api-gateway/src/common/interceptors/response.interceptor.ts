
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { map, Observable } from 'rxjs';
import { Request } from 'express';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
  ) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const skipTransform = this.reflector.get<boolean>(
      'skipResponseTransform',
      context.getHandler(),
    );

    if (skipTransform) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<
      Request & { id?: string }
    >();

    return next.handle().pipe(
      map((data) => ({
        success: true,
        message: 'Request successful',
        data,
        meta: {
          requestId: request.id ?? null,
        },
      })),
    );
  }
}
