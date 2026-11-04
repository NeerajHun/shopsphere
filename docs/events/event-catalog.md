
# ShopSphere - Event Catalogue

Exchange: shopsphere.events
Exchange Type: topic
Durable: true

## Order Events

### order.created
Producer: Order Service
Consumer: Inventory Service

### order.confirmed
Producer: Order Service
Consumer: Notification Service

### order.cancelled
Producer: Order Service
Consumer: Notification Service

## Inventory Events

### inventory.reserved
Producer: Inventory Service
Consumer: Order Service

### inventory.reservation_failed
Producer: Inventory Service
Consumer: Order Service

### inventory.release_requested
Producer: Order Service
Consumer: Inventory Service

### inventory.released
Producer: Inventory Service
Consumer: Order Service

## Payment Events

### payment.requested
Producer: Order Service
Consumer: Payment Service

### payment.succeeded
Producer: Payment Service
Consumer: Order Service

### payment.failed
Producer: Payment Service
Consumer: Order Service

## Shipping Events

### shipment.requested
Producer: Order Service
Consumer: Shipping Service

### shipment.created
Producer: Shipping Service
Consumer: Order Service

## Reliability Rules

- Every event has a unique eventId.
- Events include correlationId.
- Consumers must be idempotent.
- Messages must be acknowledged only after successful processing.
- Failed messages must follow retry and DLQ policies.
- Event schemas must be versioned.
