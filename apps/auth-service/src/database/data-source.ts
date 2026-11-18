
import 'dotenv/config';

import { DataSource } from 'typeorm';
import { User } from '../modules/users/entities/user.entity';
import { UserSession } from '../modules/users/entities/user-session.entity';

export default new DataSource({
  type: 'postgres',
  host: process.env.AUTH_DB_HOST,
  port: Number(process.env.AUTH_DB_PORT || 5433),
  username: process.env.AUTH_DB_USER,
  password: process.env.AUTH_DB_PASSWORD,
  database: process.env.AUTH_DB_NAME,

  entities: [User,UserSession],

  migrations: [__dirname + '/migrations/*{.ts,.js}'],

  migrationsTableName: 'typeorm_migrations',

  synchronize: false,
});
