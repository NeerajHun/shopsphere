import 'reflect-metadata';
import { config } from 'dotenv';
import { resolve } from 'path';
import { DataSource } from 'typeorm';

import { Product } from '../../src/modules/products/entities/product.entity';
import { Category } from '../../src/modules/categories/entities/category.entity';

config({
  path: resolve(process.cwd(), '.env.test'),
  override: true,
});

export const testDataSource = new DataSource({
  type: 'postgres',
  host: process.env.PRODUCT_TEST_DB_HOST,
  port: Number(process.env.PRODUCT_TEST_DB_PORT || 5433),
  username: process.env.PRODUCT_TEST_DB_USER,
  password: process.env.PRODUCT_TEST_DB_PASSWORD,
  database: process.env.PRODUCT_TEST_DB_NAME,

  entities: [Product, Category],
  migrations: [
    resolve(
      process.cwd(),
      'apps/product-service/src/database/migrations/*{.ts,.js}',
    ),
  ],

  migrationsTableName: 'typeorm_migrations',
  synchronize: false,
  logging: false,
});
