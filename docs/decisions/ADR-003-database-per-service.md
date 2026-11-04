
# ADR-003: Database Per Service

## Status
Accepted

## Context

Each microservice must maintain independent
ownership of its business data.

## Decision

Each business service will own its own PostgreSQL
database and database credentials.

Services cannot directly query or modify
another service's database.

Communication between services will happen
through REST APIs or messaging events.

## Consequences

Advantages:
- Independent schema evolution
- Better service isolation
- Independent deployment
- Clear data ownership

Trade-offs:
- Cross-service queries become more complex
- Distributed transactions are not available
- Eventual consistency must be handled
