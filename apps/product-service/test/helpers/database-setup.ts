import { testDataSource } from './database.helper';

export async function initializeTestDatabase() {
  // Never allow integration tests to touch the development database.
  if (
    process.env.PRODUCT_TEST_DB_NAME !== 'product_test_db' ||
    process.env.PRODUCT_TEST_DB_USER !== 'product_test_user'
  ) {
    throw new Error(
      'Refusing to run integration tests: expected product_test_db / product_test_user',
    );
  }

  if (!testDataSource.isInitialized) {
    await testDataSource.initialize();
  }

  await testDataSource.runMigrations();
}

export async function closeTestDatabase() {
  if (testDataSource.isInitialized) {
    await testDataSource.destroy();
  }
}

export async function cleanTestDatabase() {
  if (!testDataSource.isInitialized) {
    throw new Error('Test database is not initialized');
  }

  await testDataSource.query(`
    TRUNCATE TABLE "products", "categories"
    RESTART IDENTITY CASCADE
  `);
}
