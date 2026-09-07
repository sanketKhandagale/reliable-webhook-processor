# Reliable Webhook Processor

A reliable webhook processing system built with NestJS, PostgreSQL, and Next.js.

The system accepts webhook events, persists them before acknowledging the request, processes them asynchronously using multiple workers, prevents duplicate business processing, retries transient failures with backoff, and recovers events when a worker crashes.

## Tech Stack

- Backend: NestJS
- Database: PostgreSQL
- Frontend: Next.js
- Queue: PostgreSQL-backed worker queue
- ORM: TypeORM
- Containerization: Docker Compose

## Architecture

```text
                    POST /webhooks
                          |
                          v
                  +---------------+
                  |    NestJS     |
                  |    Backend    |
                  +-------+-------+
                          |
                          v
                  +---------------+
                  |  PostgreSQL   |
                  |               |
                  | webhook_events|
                  | processing_   |
                  | attempts      |
                  | processed_    |
                  | orders        |
                  +-------+-------+
                          |
                +---------+---------+
                |                   |
                v                   v
          +-----------+       +-----------+
          |  Worker 1 |       |  Worker 2 |
          +-----------+       +-----------+
                |                   |
                +---------+---------+
                          |
                          v
                    Business action
                    processed_orders
                          |
                          v
                   Next.js Operations
                       Dashboard