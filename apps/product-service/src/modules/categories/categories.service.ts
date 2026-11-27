import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';

import { Category } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  async create(dto: CreateCategoryDto) {
    const category = this.categoryRepository.create({
      ...dto,
      slug: dto.slug.trim().toLowerCase(),
    });

    try {
      return await this.categoryRepository.save(category);
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async findAll() {
    return this.categoryRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string) {
    const category = await this.categoryRepository.findOne({
      where: { id },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const category = await this.findOne(id);

    Object.assign(category, {
      ...dto,
      ...(dto.slug !== undefined
        ? { slug: dto.slug.trim().toLowerCase() }
        : {}),
    });

    try {
      return await this.categoryRepository.save(category);
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  async remove(id: string) {
    const category = await this.findOne(id);

    await this.categoryRepository.remove(category);

    return {
      message: 'Category deleted successfully',
    };
  }

  private handleDatabaseError(error: unknown): never {
    if (
      error instanceof QueryFailedError &&
      (error as QueryFailedError & { driverError?: { code?: string } })
        .driverError?.code === '23505'
    ) {
      throw new ConflictException('Category slug already exists');
    }

    throw error;
  }
}