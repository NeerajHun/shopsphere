
# ShopSphere API Contracts

Base URL:
http://localhost:3000/api/v1

## Authentication

POST /auth/register

Request:
{
  "email": "customer@example.com",
  "password": "StrongPassword123"
}

POST /auth/login

Request:
{
  "email": "customer@example.com",
  "password": "StrongPassword123"
}

## Products

GET /products

GET /products/:id

POST /products

Authorization: Bearer <access-token>

## Orders

POST /orders

Authorization: Bearer <access-token>

Request:
{
  "items": [
    {
      "productId": "PROD-101",
      "quantity": 1
    }
  ],
  "idempotencyKey": "checkout-unique-key-001"
}

GET /orders/:id

GET /orders

## Inventory

GET /inventory/:productId

## Payments

GET /payments/:id

## Shipping

GET /shipments/:id

## Notes

- All client APIs use /api/v1.
- Protected endpoints require JWT authentication.
- Orders are processed asynchronously.
- Order creation initially returns a pending order.
- Order completion is communicated through order events.
