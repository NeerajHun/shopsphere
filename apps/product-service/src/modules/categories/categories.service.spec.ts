
import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError } from 'typeorm';

import { CategoriesService } from './categories.service';
import { Category } from './entities/category.entity';

describe('CategoriesService', () => {
  let service: CategoriesService;
  let categoryRepository: Record<string, jest.Mock>;

  const category = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Electronics',
    slug: 'electronics',
    description: 'Electronic products',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Category;

  beforeEach(async () => {
    categoryRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CategoriesService,
        {
          provide: getRepositoryToken(Category),
          useValue: categoryRepository,
        },
      ],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a category and normalize its slug', async () => {
      const dto = {
        name: 'Electronics',
        slug: '  Electronics  ',
        description: 'Electronic products',
      };

      categoryRepository.create.mockReturnValue(category);
      categoryRepository.save.mockResolvedValue(category);

      const result = await service.create(dto);

      expect(categoryRepository.create).toHaveBeenCalledWith({
        ...dto,
        slug: 'electronics',
      });
      expect(categoryRepository.save).toHaveBeenCalledWith(category);
      expect(result).toEqual(category);
    });

    it('should reject duplicate category slugs', async () => {
      const driverError = Object.assign(
        new Error('duplicate key value violates unique constraint'),
        { code: '23505' },
      );

      const databaseError = new QueryFailedError(
        'INSERT INTO categories',
        [],
        driverError,
      );

      categoryRepository.create.mockReturnValue(category);
      categoryRepository.save.mockRejectedValue(databaseError);

      await expect(
        service.create({
          name: 'Electronics',
          slug: 'electronics',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should rethrow unexpected database errors', async () => {
      const databaseError = new Error('Database connection failed');

      categoryRepository.create.mockReturnValue(category);
      categoryRepository.save.mockRejectedValue(databaseError);

      await expect(
        service.create({
          name: 'Electronics',
          slug: 'electronics',
        }),
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('findAll', () => {
    it('should return categories ordered by newest first', async () => {
      categoryRepository.find.mockResolvedValue([category]);

      const result = await service.findAll();

      expect(categoryRepository.find).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual([category]);
    });
  });

  describe('findOne', () => {
    it('should return a category by ID', async () => {
      categoryRepository.findOne.mockResolvedValue(category);

      const result = await service.findOne(category.id);

      expect(categoryRepository.findOne).toHaveBeenCalledWith({
        where: { id: category.id },
      });
      expect(result).toEqual(category);
    });

    it('should throw NotFoundException when category does not exist', async () => {
      categoryRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findOne(category.id),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update category details and normalize slug', async () => {
      categoryRepository.findOne.mockResolvedValue({ ...category });
      categoryRepository.save.mockImplementation(
        async (entity) => entity as Category,
      );

      const result = await service.update(category.id, {
        name: 'Updated Electronics',
        slug: '  Updated-Electronics  ',
        description: 'Updated description',
        isActive: false,
      });

      expect(result.name).toBe('Updated Electronics');
      expect(result.slug).toBe('updated-electronics');
      expect(result.description).toBe('Updated description');
      expect(result.isActive).toBe(false);
    });

    it('should update category without changing its slug', async () => {
      categoryRepository.findOne.mockResolvedValue({ ...category });
      categoryRepository.save.mockImplementation(
        async (entity) => entity as Category,
      );

      const result = await service.update(category.id, {
        name: 'Updated Electronics',
      });

      expect(result.name).toBe('Updated Electronics');
      expect(result.slug).toBe('electronics');
    });

    it('should reject duplicate slugs during update', async () => {
      const driverError = Object.assign(
        new Error('duplicate key value violates unique constraint'),
        { code: '23505' },
      );

      const databaseError = new QueryFailedError(
        'UPDATE categories',
        [],
        driverError,
      );

      categoryRepository.findOne.mockResolvedValue({ ...category });
      categoryRepository.save.mockRejectedValue(databaseError);

      await expect(
        service.update(category.id, {
          slug: 'existing-slug',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should rethrow unexpected database errors during update', async () => {
      categoryRepository.findOne.mockResolvedValue({ ...category });
      categoryRepository.save.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(
        service.update(category.id, {
          name: 'Updated Electronics',
        }),
      ).rejects.toThrow('Database connection failed');
    });
  });

  describe('remove', () => {
    it('should delete a category successfully', async () => {
      categoryRepository.findOne.mockResolvedValue(category);
      categoryRepository.remove.mockResolvedValue(category);

      const result = await service.remove(category.id);

      expect(categoryRepository.remove).toHaveBeenCalledWith(category);
      expect(result).toEqual({
        message: 'Category deleted successfully',
      });
    });

    it('should throw NotFoundException when deleting a missing category', async () => {
      categoryRepository.findOne.mockResolvedValue(null);

      await expect(
        service.remove(category.id),
      ).rejects.toThrow(NotFoundException);

      expect(categoryRepository.remove).not.toHaveBeenCalled();
    });
  });
});
