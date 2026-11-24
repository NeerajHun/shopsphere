import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';

import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('AUTH_DB_HOST'),
        port: Number(configService.get<string>('AUTH_DB_PORT')),
        username: configService.get<string>('AUTH_DB_USER'),
        password: configService.get<string>('AUTH_DB_PASSWORD'),
        database: configService.get<string>('AUTH_DB_NAME'),
        autoLoadEntities: true,
        synchronize: false,
        retryAttempts: 5,
        retryDelay: 3000,
      }),
    }),

    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const storage = new ThrottlerStorageRedisService({
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: Number(configService.get<string>('REDIS_PORT', '6380')),
          password: configService.get<string>('REDIS_PASSWORD'),
        });

        storage.redis.on('ready', () => {
          console.log('Redis throttler storage connected');
        });

        storage.redis.on('error', (error) => {
          console.error('Redis throttler storage error:', error.message);
        });

        return {
          throttlers: [
            {
              name: 'default',
              ttl: 60_000,
              limit: 100,
            },
          ],
          storage,
        };
      },
    }),

    UsersModule,
    AuthModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AuthServiceModule {}
