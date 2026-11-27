import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';

import { Product } from './entities/product.entity';
import { Category } from '../categories/entities/category.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { GetProductsQueryDto } from './dto/get-products-query.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,

    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  async create(dto: CreateProductDto) {
    const slug = dto.slug.trim().toLowerCase();
    const sku = dto.sku.trim().toUpperCase();

    if (dto.categoryId) {
      await this.validateCategory(dto.categoryId);
    }

    const product = this.productRepository.create({
      ...dto,
      name: dto.name.trim(),
      slug,
      sku,
      currency: dto.currency ?? 'INR',
      description: dto.description?.trim() ?? null,
      categoryId: dto.categoryId ?? null,
    });

    try {
      return await this.productRepository.save(product);
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async findAll(query: GetProductsQueryDto) {
    const {
      page = 1,
      limit = 10,
      search,
      status,
      categoryId,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = query;

    const queryBuilder = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category');

    // Search by product name, SKU, or description.
    if (search?.trim()) {
      queryBuilder.andWhere(
        `(
        product.name ILIKE :search
        OR product.sku ILIKE :search
        OR product.description ILIKE :search
      )`,
        { search: `%${search.trim()}%` },
      );
    }

    // Filter by product status.
    if (status) {
      queryBuilder.andWhere('product.status = :status', { status });
    }

    // Filter by category.
    if (categoryId) {
      queryBuilder.andWhere('product.categoryId = :categoryId', {
        categoryId,
      });
    }

    // Sorting.
    const sortColumns = {
      name: 'product.name',
      price: 'product.price',
      createdAt: 'product.createdAt',
    };

    queryBuilder.orderBy(sortColumns[sortBy], sortOrder);

    // Pagination.
    const skip = (page - 1) * limit;

    queryBuilder.skip(skip).take(limit);

    const [products, total] = await queryBuilder.getManyAndCount();

    return {
      data: products,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPreviousPage: page > 1,
      },
    };
  }

  async findOne(id: string) {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: { category: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async update(id: string, dto: UpdateProductDto) {
    const product = await this.findOne(id);

    if (dto.categoryId !== undefined && dto.categoryId !== null) {
      await this.validateCategory(dto.categoryId);
    }

    if (dto.name !== undefined) {
      product.name = dto.name.trim();
    }

    if (dto.slug !== undefined) {
      product.slug = dto.slug.trim().toLowerCase();
    }

    if (dto.sku !== undefined) {
      product.sku = dto.sku.trim().toUpperCase();
    }

    if (dto.description !== undefined) {
      product.description = dto.description.trim() || null;
    }

    if (dto.price !== undefined) {
      product.price = dto.price;
    }

    if (dto.currency !== undefined) {
      product.currency = dto.currency;
    }

    if (dto.status !== undefined) {
      product.status = dto.status;
    }

    if (dto.categoryId !== undefined) {
      product.categoryId = dto.categoryId;
    }

    try {
      return await this.productRepository.save(product);
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async remove(id: string) {
    const product = await this.findOne(id);

    await this.productRepository.remove(product);

    return {
      message: 'Product deleted successfully',
    };
  }

  private async validateCategory(categoryId: string) {
    const category = await this.categoryRepository.findOne({
      where: { id: categoryId, isActive: true },
    });

    if (!category) {
      throw new BadRequestException('Category does not exist or is inactive');
    }
  }

  private handleDatabaseError(error: unknown): never {
    if (error instanceof QueryFailedError) {
      const driverError = (error as any).driverError;

      if (driverError?.code === '23505') {
        throw new ConflictException(
          'Product with this slug or SKU already exists',
        );
      }
    }

    throw error;
  }
}
