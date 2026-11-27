import { config } from 'dotenv';
import { resolve } from 'path';

config({
  path: resolve(process.cwd(), '.env.test'),
  override: true,
});

// Point the NestJS Product Service module to the isolated test database.
process.env.PRODUCT_DB_HOST = process.env.PRODUCT_TEST_DB_HOST;
process.env.PRODUCT_DB_PORT = process.env.PRODUCT_TEST_DB_PORT || '5433';
process.env.PRODUCT_DB_NAME = process.env.PRODUCT_TEST_DB_NAME;
process.env.PRODUCT_DB_USER = process.env.PRODUCT_TEST_DB_USER;
process.env.PRODUCT_DB_PASSWORD = process.env.PRODUCT_TEST_DB_PASSWORD;

// Fail early if test database configuration is incomplete.
if (
  process.env.PRODUCT_DB_NAME !== 'product_test_db' ||
  process.env.PRODUCT_DB_USER !== 'product_test_user'
) {
  throw new Error(
    'Unsafe integration-test configuration: expected product_test_db / product_test_user',
  );
}
