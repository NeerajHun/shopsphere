
# ShopSphere - Service Catalogue

## 1. API Gateway
Port: 3000

Responsibilities:
- Client entry point
- Request routing
- JWT validation
- Rate limiting
- Request correlation

Database: None

## 2. Auth Service
Port: 3001

Responsibilities:
- User registration
- Login and logout
- Password hashing
- JWT access and refresh tokens
- Role-based authorization

Database: auth_db

## 3. Product Service
Port: 3002

Responsibilities:
- Product management
- Product categories
- Product search
- Product details

Database: product_db

## 4. Order Service
Port: 3003

Responsibilities:
- Order creation
- Order history
- Order status management
- Saga orchestration

Database: order_db

## 5. Inventory Service
Port: 3004

Responsibilities:
- Stock management
- Inventory reservation
- Stock release
- Prevent overselling

Database: inventory_db

## 6. Payment Service
Port: 3005

Responsibilities:
- Payment initiation
- Payment processing
- Payment status
- Refund handling

Database: payment_db

## 7. Shipping Service
Port: 3006

Responsibilities:
- Shipment creation
- Shipment tracking
- Delivery status

Database: shipping_db

## 8. Notification Service
Port: 3007

Responsibilities:
- Order confirmation emails
- Payment notifications
- Shipment notifications
- Retry failed notifications

Database: notification_db

## Infrastructure

- PostgreSQL: Service-owned databases
- RabbitMQ: Asynchronous communication
- Redis: Caching and rate limiting
- Docker Compose: Local orchestration
