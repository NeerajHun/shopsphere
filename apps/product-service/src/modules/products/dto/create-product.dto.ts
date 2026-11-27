import {
  IsEnum,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';

import { ProductStatus } from '../entities/product.entity';

export class CreateProductDto {
  @IsString()
  @MinLength(2)
  @MaxLength(180)
  name: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  slug: string;

  @IsString()
  @MinLength(2)
  @MaxLength(64)
  sku: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @IsNumberString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'price must be a positive amount with up to 2 decimal places',
  })
  price: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/, {
    message: 'currency must be a 3-letter uppercase currency code',
  })
  currency?: string;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @IsUUID()
  categoryId?: string | null;
}
