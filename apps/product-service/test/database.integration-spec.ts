import {
  closeTestDatabase,
  initializeTestDatabase,
} from './helpers/database-setup';
import { testDataSource } from './helpers/database.helper';

describe('Product Service Database Integration', () => {
  beforeAll(async () => {
    await initializeTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  it('should connect to the dedicated product test database', async () => {
    const [result] = await testDataSource.query(`
      SELECT current_database() AS database, current_user AS username
    `);

    expect(result.database).toBe('product_test_db');
    expect(result.username).toBe('product_test_user');
  });

  it('should have no pending migrations', async () => {
    const pendingMigrations = await testDataSource.showMigrations();

    expect(pendingMigrations).toBe(false);
  });

  it('should create categories and products tables', async () => {
    const tables: Array<{ table_name: string }> = await testDataSource.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('categories', 'products')
        ORDER BY table_name
      `);

    expect(tables.map((table) => table.table_name)).toEqual([
      'categories',
      'products',
    ]);
  });
});
