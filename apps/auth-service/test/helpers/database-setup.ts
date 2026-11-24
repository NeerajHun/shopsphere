
import { testDataSource } from './database.helper';

export async function initializeTestDatabase() {
  // Safety check: never allow integration tests to touch the development DB.
  if (
    process.env.AUTH_DB_NAME !== 'auth_test_db' ||
    process.env.AUTH_DB_USER !== 'auth_test_user'
  ) {
    throw new Error(
      'Refusing to run integration tests: expected auth_test_db / auth_test_user',
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
  await testDataSource.query(`
    TRUNCATE TABLE "user_sessions", "users"
    RESTART IDENTITY CASCADE
  `);
}
