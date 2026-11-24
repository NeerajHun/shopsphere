#!/usr/bin/env bash
set -euo pipefail

echo "Creating ShopSphere service database users and databases..."

psql \
  --set=ON_ERROR_STOP=1 \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" \
  --set=auth_password="$AUTH_DB_PASSWORD" \
  --set=product_password="$PRODUCT_DB_PASSWORD" \
  --set=order_password="$ORDER_DB_PASSWORD" \
  --set=inventory_password="$INVENTORY_DB_PASSWORD" \
  --set=payment_password="$PAYMENT_DB_PASSWORD" \
  --set=shipping_password="$SHIPPING_DB_PASSWORD" \
  --set=notification_password="$NOTIFICATION_DB_PASSWORD" <<'EOSQL'

SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', 'auth_user', :'auth_password') \gexec
SELECT format('CREATE DATABASE %I OWNER %I', 'auth_db', 'auth_user') \gexec

SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', 'product_user', :'product_password') \gexec
SELECT format('CREATE DATABASE %I OWNER %I', 'product_db', 'product_user') \gexec

SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', 'order_user', :'order_password') \gexec
SELECT format('CREATE DATABASE %I OWNER %I', 'order_db', 'order_user') \gexec

SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', 'inventory_user', :'inventory_password') \gexec
SELECT format('CREATE DATABASE %I OWNER %I', 'inventory_db', 'inventory_user') \gexec

SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', 'payment_user', :'payment_password') \gexec
SELECT format('CREATE DATABASE %I OWNER %I', 'payment_db', 'payment_user') \gexec

SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', 'shipping_user', :'shipping_password') \gexec
SELECT format('CREATE DATABASE %I OWNER %I', 'shipping_db', 'shipping_user') \gexec

SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', 'notification_user', :'notification_password') \gexec
SELECT format('CREATE DATABASE %I OWNER %I', 'notification_db', 'notification_user') \gexec

EOSQL

echo "ShopSphere databases and users created successfully."
