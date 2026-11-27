import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CategoriesModule } from './modules/categories/categories.module';
import { ProductsModule } from './modules/products/products.module';

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
        host: configService.get<string>('PRODUCT_DB_HOST'),
        port: Number(configService.get<string>('PRODUCT_DB_PORT')),
        username: configService.get<string>('PRODUCT_DB_USER'),
        password: configService.get<string>('PRODUCT_DB_PASSWORD'),
        database: configService.get<string>('PRODUCT_DB_NAME'),
        autoLoadEntities: true,
        synchronize: false,
        retryAttempts: 5,
        retryDelay: 3000,
      }),
    }),

    CategoriesModule,

    ProductsModule,
  ],
  controllers: [],
  providers: [],
})
export class ProductServiceModule {}
