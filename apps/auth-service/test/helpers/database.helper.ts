import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve } from 'path';
import { DataSource } from 'typeorm';

import { User } from '../../src/modules/users/entities/user.entity';
import { UserSession } from '../../src/modules/users/entities/user-session.entity';

config({
  path: resolve(process.cwd(), '.env.test'),
  override: true,
});

export const testDataSource = new DataSource({
  type: 'postgres',
  host: process.env.AUTH_DB_HOST,
  port: Number(process.env.AUTH_DB_PORT || 5433),
  username: process.env.AUTH_DB_USER,
  password: process.env.AUTH_DB_PASSWORD,
  database: process.env.AUTH_DB_NAME,

  entities: [User, UserSession],
  migrations: [
    resolve(
      process.cwd(),
      'apps/auth-service/src/database/migrations/*{.ts,.js}',
    ),
  ],

  migrationsTableName: 'typeorm_migrations',
  synchronize: false,
  logging: false,
});
