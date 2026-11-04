
# ADR-002: Service Communication Strategy

## Status
Accepted

## Context

ShopSphere contains independently deployable
microservices that need to exchange data.

We need synchronous and asynchronous communication.

## Decision

REST will be used for synchronous request-response
communication.

RabbitMQ will be used for asynchronous event-driven
communication.

A topic exchange named shopsphere.events will
distribute domain events.

Docker Compose DNS will provide local service discovery.

## REST Use Cases

- User authentication
- Product queries
- Order history
- Shipment tracking

## RabbitMQ Use Cases

- Order created
- Inventory reserved
- Payment succeeded
- Order confirmed
- Shipment requested

## Consequences

Advantages:
- Loose coupling
- Independent service execution
- Asynchronous processing
- Better resilience for background operations

Trade-offs:
- Eventual consistency
- Duplicate message handling
- More complex debugging
- Message ordering considerations
