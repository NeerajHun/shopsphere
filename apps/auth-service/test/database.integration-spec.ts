import {
  initializeTestDatabase,
  closeTestDatabase,
} from './helpers/database-setup';

import { testDataSource } from './helpers/database.helper';

describe('Auth Service - PostgreSQL Integration', () => {
  beforeAll(async () => {
    await initializeTestDatabase();
  });

  afterAll(async () => {
    await closeTestDatabase();
  });

  it('should connect to the dedicated auth test database', async () => {
    const result = await testDataSource.query(`
      SELECT current_database() AS database,
             current_user AS username
    `);

    expect(result[0].database).toBe('auth_test_db');
    expect(result[0].username).toBe('auth_test_user');
  });

  it('should successfully apply all database migrations', async () => {
    const hasPendingMigrations = await testDataSource.showMigrations();

    expect(hasPendingMigrations).toBe(false);
  });

  it('should create users and user_sessions tables', async () => {
    const result = await testDataSource.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('users', 'user_sessions')
    `);

    const tableNames = result.map((row: { table_name: string }) => row.table_name);

    expect(tableNames).toContain('users');
    expect(tableNames).toContain('user_sessions');
  });
});
