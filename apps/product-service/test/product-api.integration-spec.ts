import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';

import { ProductServiceModule } from '../src/product-service.module';
import {
  closeTestDatabase,
  cleanTestDatabase,
  initializeTestDatabase,
} from './helpers/database-setup';

describe('Product Service HTTP Integration', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // Initialize and migrate the isolated test database first.
    await initializeTestDatabase();

    const moduleFixture = await Test.createTestingModule({
      imports: [ProductServiceModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Match the actual Product Service bootstrap configuration.
    app.setGlobalPrefix('api/v1');

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  beforeEach(async () => {
    await cleanTestDatabase();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }

    await closeTestDatabase();
  });

  describe('Categories API', () => {
    it('should create a category', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/categories')
        .send({
          name: 'Electronics',
          slug: 'electronics',
          description: 'Electronic products',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Electronics');
      expect(response.body.slug).toBe('electronics');
    });

    it('should return all categories', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/categories')
        .send({
          name: 'Electronics',
          slug: 'electronics',
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get('/api/v1/categories')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].slug).toBe('electronics');
    });

    it('should reject invalid category input', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/categories')
        .send({
          name: 'A',
          slug: 'electronics',
          unexpectedField: true,
        })
        .expect(400);

      expect(response.body).toHaveProperty('statusCode', 400);
    });

    it('should reject an invalid category UUID', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/categories/not-a-uuid')
        .expect(400);
    });
  });

  describe('Products API', () => {
    async function createCategory() {
      const response = await request(app.getHttpServer())
        .post('/api/v1/categories')
        .send({
          name: 'Electronics',
          slug: 'electronics',
        })
        .expect(201);

      return response.body.id as string;
    }

    it('should create a product with a category', async () => {
      const categoryId = await createCategory();

      const response = await request(app.getHttpServer())
        .post('/api/v1/products')
        .send({
          name: 'Wireless Mouse',
          slug: 'wireless-mouse',
          sku: 'MOUSE-001',
          price: '799.00',
          currency: 'INR',
          categoryId,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Wireless Mouse');
      expect(response.body.sku).toBe('MOUSE-001');
      expect(response.body.categoryId).toBe(categoryId);
    });

    it('should reject a product with an invalid category', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/products')
        .send({
          name: 'Wireless Mouse',
          slug: 'wireless-mouse',
          sku: 'MOUSE-001',
          price: '799.00',
          categoryId: '00000000-0000-4000-8000-000000000000',
        })
        .expect(400);
    });

    it('should reject duplicate product SKU', async () => {
      const product = {
        name: 'Wireless Mouse',
        slug: 'wireless-mouse',
        sku: 'MOUSE-001',
        price: '799.00',
      };

      await request(app.getHttpServer())
        .post('/api/v1/products')
        .send(product)
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/v1/products')
        .send({
          ...product,
          name: 'Gaming Mouse',
          slug: 'gaming-mouse',
        })
        .expect(409);
    });

    it('should retrieve a product by ID', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/products')
        .send({
          name: 'Mechanical Keyboard',
          slug: 'mechanical-keyboard',
          sku: 'KEYBOARD-001',
          price: '2499.00',
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get(`/api/v1/products/${createResponse.body.id}`)
        .expect(200);

      expect(response.body.id).toBe(createResponse.body.id);
      expect(response.body.name).toBe('Mechanical Keyboard');
    });

    it('should update a product', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/products')
        .send({
          name: 'Mechanical Keyboard',
          slug: 'mechanical-keyboard',
          sku: 'KEYBOARD-001',
          price: '2499.00',
        })
        .expect(201);

      const response = await request(app.getHttpServer())
        .patch(`/api/v1/products/${createResponse.body.id}`)
        .send({
          price: '2199.00',
          name: 'Updated Keyboard',
        })
        .expect(200);

      expect(response.body.name).toBe('Updated Keyboard');
      expect(response.body.price).toBe('2199.00');
    });

    it('should delete a product', async () => {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/products')
        .send({
          name: 'Mechanical Keyboard',
          slug: 'mechanical-keyboard',
          sku: 'KEYBOARD-001',
          price: '2499.00',
        })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/api/v1/products/${createResponse.body.id}`)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/api/v1/products/${createResponse.body.id}`)
        .expect(404);
    });

    it('should reject invalid product query parameters', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/products?page=0')
        .expect(400);
    });
  });
});
