import 'dotenv/config';

import { DataSource } from 'typeorm';

import { Product } from '../modules/products/entities/product.entity';
import { Category } from '../modules/categories/entities/category.entity';

export default new DataSource({
  type: 'postgres',

  host: process.env.PRODUCT_DB_HOST,
  port: Number(process.env.PRODUCT_DB_PORT || 5433),
  username: process.env.PRODUCT_DB_USER,
  password: process.env.PRODUCT_DB_PASSWORD,
  database: process.env.PRODUCT_DB_NAME,

  entities: [Product, Category],

  migrations: [__dirname + '/migrations/*{.ts,.js}'],

  migrationsTableName: 'typeorm_migrations',

  synchronize: false,
});
