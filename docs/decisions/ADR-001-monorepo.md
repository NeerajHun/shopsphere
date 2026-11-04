
# ADR-001: Monorepo Architecture

## Status
Accepted

## Context
ShopSphere will contain multiple independently deployable
microservices developed using NestJS and TypeScript.

We need a repository structure that simplifies local
development, testing, and code sharing.

## Decision
We will use a monorepo managed by the NestJS CLI.

Each microservice will have its own application,
database ownership, configuration, and Docker image.

Shared libraries will contain reusable technical
components and event contracts.

## Consequences

### Advantages
- Centralized dependency management.
- Easier local development.
- Shared libraries and contracts.
- Unified CI/CD configuration.

### Trade-offs
- Larger repository.
- CI/CD must detect which services have changed.
- Shared library changes require careful coordination.
