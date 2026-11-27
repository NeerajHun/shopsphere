import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QueryFailedError } from 'typeorm';
import { ProductsService } from './products.service';
import { Product, ProductStatus } from './entities/product.entity';
import { Category } from '../categories/entities/category.entity';

describe('ProductsService', () => {
  let service: ProductsService;
  let productRepository: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    remove: jest.Mock;
    createQueryBuilder: jest.Mock;
  };

  let categoryRepository: {
    findOne: jest.Mock;
  };

  const category = {
    id: 'f2271d49-d7f0-47ea-9148-d1b8f548b183',
    name: 'Electronics',
    slug: 'electronics',
    isActive: true,
  } as Category;

  const product = {
    id: 'fb91bfeb-5a47-4c88-b388-00cb5546ad2b',
    name: 'Wireless Headphones',
    slug: 'wireless-headphones',
    sku: 'WH-1001',
    description: 'Bluetooth headphones',
    price: '2199.00',
    currency: 'INR',
    status: ProductStatus.ACTIVE,
    categoryId: category.id,
    category,
  } as Product;

  beforeEach(async () => {
    productRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    categoryRepository = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: getRepositoryToken(Product),
          useValue: productRepository,
        },
        {
          provide: getRepositoryToken(Category),
          useValue: categoryRepository,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a product successfully', async () => {
      categoryRepository.findOne!.mockResolvedValue(category);
      productRepository.create!.mockReturnValue(product);
      productRepository.save!.mockResolvedValue(product);

      const result = await service.create({
        name: 'Wireless Headphones',
        slug: 'Wireless-Headphones',
        sku: 'wh-1001',
        price: '2199.00',
        categoryId: category.id,
      });

      expect(categoryRepository.findOne).toHaveBeenCalledWith({
        where: { id: category.id, isActive: true },
      });

      expect(productRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Wireless Headphones',
          slug: 'wireless-headphones',
          sku: 'WH-1001',
          currency: 'INR',
        }),
      );

      expect(productRepository.save).toHaveBeenCalled();
      expect(result).toEqual(product);
    });

    it('should reject a nonexistent or inactive category', async () => {
      categoryRepository.findOne!.mockResolvedValue(null);

      await expect(
        service.create({
          name: 'Test Product',
          slug: 'test-product',
          sku: 'TEST-100',
          price: '100.00',
          categoryId: category.id,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(productRepository.save).not.toHaveBeenCalled();
    });

    it('should reject duplicate slug or SKU', async () => {
      const driverError = Object.assign(
        new Error('duplicate key value violates unique constraint'),
        {
          code: '23505',
          detail: 'Key (sku)=(WH-1001) already exists.',
        },
      );

      const databaseError = new QueryFailedError(
        'INSERT INTO products',
        [],
        driverError,
      );

      productRepository.create.mockReturnValue(product);
      productRepository.save.mockRejectedValue(databaseError);

      await expect(
        service.create({
          name: 'Wireless Headphones',
          slug: 'wireless-headphones',
          sku: 'WH-1001',
          price: '2199.00',
        }),
      ).rejects.toThrow(ConflictException);
    });
    it('should rethrow unexpected database errors', async () => {
      const databaseError = new Error('Database connection failed');

      productRepository.create.mockReturnValue(product);
      productRepository.save.mockRejectedValue(databaseError);

      await expect(
        service.create({
          name: 'Wireless Headphones',
          slug: 'wireless-headphones',
          sku: 'WH-1001',
          price: '2199.00',
        }),
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('findAll', () => {
    it('should return paginated products with categories', async () => {
      const queryBuilder: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[product], 1]),
      };

      productRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.findAll({
        page: 1,
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'DESC',
      });

      expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'product.category',
        'category',
      );

      expect(queryBuilder.skip).toHaveBeenCalledWith(0);
      expect(queryBuilder.take).toHaveBeenCalledWith(10);

      expect(result.data).toEqual([product]);
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      });
    });
    it('should apply search, filters, sorting and pagination', async () => {
      const queryBuilder: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[product], 1]),
      };

      productRepository.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await service.findAll({
        page: 2,
        limit: 5,
        search: 'headphones',
        status: ProductStatus.ACTIVE,
        categoryId: category.id,
        sortBy: 'price',
        sortOrder: 'ASC',
      });

      // Search condition
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('product.name ILIKE :search'),
        { search: '%headphones%' },
      );

      // Status filter
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'product.status = :status',
        { status: ProductStatus.ACTIVE },
      );

      // Category filter
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'product.categoryId = :categoryId',
        { categoryId: category.id },
      );

      // Sorting
      expect(queryBuilder.orderBy).toHaveBeenCalledWith('product.price', 'ASC');

      // Pagination: page 2, limit 5 => skip 5
      expect(queryBuilder.skip).toHaveBeenCalledWith(5);
      expect(queryBuilder.take).toHaveBeenCalledWith(5);

      expect(result.data).toEqual([product]);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(2);
      expect(result.meta.limit).toBe(5);
    });
  });

  describe('findOne', () => {
    it('should return a product by ID', async () => {
      productRepository.findOne!.mockResolvedValue(product);

      const result = await service.findOne(product.id);

      expect(result).toEqual(product);
    });

    it('should throw NotFoundException when product does not exist', async () => {
      productRepository.findOne!.mockResolvedValue(null);

      await expect(service.findOne(product.id)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update a product successfully', async () => {
      productRepository.findOne!.mockResolvedValue({ ...product });
      productRepository.save!.mockImplementation(
        async (entity) => entity as Product,
      );

      const result = await service.update(product.id, {
        price: '1999.00',
        slug: 'Updated-Headphones',
      });

      expect(result.price).toBe('1999.00');
      expect(result.slug).toBe('updated-headphones');
    });

    it('should reject an invalid category during update', async () => {
      productRepository.findOne!.mockResolvedValue({ ...product });
      categoryRepository.findOne!.mockResolvedValue(null);

      await expect(
        service.update(product.id, {
          categoryId: category.id,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(productRepository.save).not.toHaveBeenCalled();
    });
    it('should update all optional product fields', async () => {
      productRepository.findOne.mockResolvedValue({ ...product });

      productRepository.save.mockImplementation(
        async (entity) => entity as Product,
      );

      const result = await service.update(product.id, {
        name: '  Updated Headphones  ',
        slug: 'Updated-Headphones',
        sku: 'wh-2001',
        description: '  Updated description  ',
        price: '2999.00',
        currency: 'USD',
        status: ProductStatus.ARCHIVED,
        categoryId: null,
      });

      expect(result.name).toBe('Updated Headphones');
      expect(result.slug).toBe('updated-headphones');
      expect(result.sku).toBe('WH-2001');
      expect(result.description).toBe('Updated description');
      expect(result.price).toBe('2999.00');
      expect(result.currency).toBe('USD');
      expect(result.status).toBe(ProductStatus.ARCHIVED);
      expect(result.categoryId).toBeNull();
    });
    it('should set description to null when an empty string is provided', async () => {
      productRepository.findOne.mockResolvedValue({ ...product });

      productRepository.save.mockImplementation(
        async (entity) => entity as Product,
      );

      const result = await service.update(product.id, {
        description: '   ',
      });

      expect(result.description).toBeNull();
    });
    it('should update category when the category is active', async () => {
      productRepository.findOne.mockResolvedValue({ ...product });
      categoryRepository.findOne.mockResolvedValue(category);

      productRepository.save.mockImplementation(
        async (entity) => entity as Product,
      );

      const result = await service.update(product.id, {
        categoryId: category.id,
      });

      expect(categoryRepository.findOne).toHaveBeenCalledWith({
        where: { id: category.id, isActive: true },
      });

      expect(result.categoryId).toBe(category.id);
    });
    it('should reject duplicate slug or SKU during update', async () => {
      productRepository.findOne.mockResolvedValue({ ...product });

      const driverError = Object.assign(
        new Error('duplicate key value violates unique constraint'),
        { code: '23505' },
      );

      const databaseError = new QueryFailedError(
        'UPDATE products',
        [],
        driverError,
      );

      productRepository.save.mockRejectedValue(databaseError);

      await expect(
        service.update(product.id, {
          sku: 'WH-2001',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should delete a product successfully', async () => {
      productRepository.findOne!.mockResolvedValue(product);
      productRepository.remove!.mockResolvedValue(product);

      const result = await service.remove(product.id);

      expect(productRepository.remove).toHaveBeenCalledWith(product);
      expect(result).toEqual({
        message: 'Product deleted successfully',
      });
    });
  });
});
