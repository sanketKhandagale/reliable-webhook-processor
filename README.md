# Reliable Webhook Processor

NestJS + PostgreSQL + Next.js webhook processor with concurrent workers, retries, leases, and duplicate protection.

## Architecture

`POST /webhooks` persists the event to PostgreSQL before acknowledging it.

Workers poll PostgreSQL for pending events and claim them using row locking and an expiring lease. Each worker records its attempts in `processing_attempts` and updates the event state after processing.

Two worker processes can run concurrently. The business result is stored in `processed_orders`.


```text
                         POST /webhooks
                                |
                                v
                         +-------------+
                         |   NestJS    |
                         |   Backend   |
                         +------+------+
                                |
                                v
                         +-------------+
                         | PostgreSQL  |
                         |             |
                         | webhook_    |
                         | events      |
                         |             |
                         | processing_ |
                         | attempts    |
                         |             |
                         | processed_  |
                         | orders      |
                         +------+------+
                                |
                    +-----------+-----------+
                    |                       |
                    v                       v
              +-----------+           +-----------+
              |  Worker 1 |           |  Worker 2 |
              +-----------+           +-----------+
                    |                       |
                    +-----------+-----------+
                                |
                                v
                         Business action
                                |
                                v
                       processed_orders
                                |
                                v
                       Next.js Operations UI

## Correctness Guarantees

- **Durable ingestion:** events are persisted before the webhook request is acknowledged.
- **Duplicate protection:** `webhook_events.eventId` is unique, so concurrent submissions cannot create duplicate event rows.
- **Exactly one business record:** `processed_orders.eventId` is unique, preventing duplicate business records even during retries or worker recovery.
- **Worker coordination:** PostgreSQL row locking prevents healthy workers from claiming the same available event simultaneously.
- **Retries:** failed attempts use exponential backoff and stop after the configurable maximum attempt count.
- **Crash recovery:** expired leases allow another worker to reclaim an event after a worker crashes.
- **Long-running processing:** workers heartbeat their leases while processing.

## Known Limitations

- If a worker stops heartbeating while still executing, another worker may reclaim the event after the lease expires. The unique `processed_orders.eventId` constraint prevents a duplicate business record, but the business operation should also be idempotent.
- PostgreSQL polling is simpler than a dedicated queue but would not be ideal for very high throughput.
- The business action and final event-status update are not one transaction. A crash between them can cause recovery processing, relying on the unique business constraint for idempotency.
- `synchronize: true` is used for development; production should use migrations.
- Authentication and extensive payload validation are out of scope.
- Docker Compose was validated with `docker compose config`, but container execution could not be verified because Docker Desktop's Linux engine was unavailable locally.

## Hardest Bug

The hardest bug was the duplicate webhook race.

An application-level "check then insert" is not safe because two requests can check at the same time.

The fix was to use PostgreSQL unique constraints as the concurrency boundary on both `webhook_events.eventId` and `processed_orders.eventId`.

The API catches the duplicate-key error and treats the second webhook as a safe duplicate.

I verified this by submitting the same event multiple times and confirming that only one business record was created.

I also encountered worker crash recovery issues where a claimed event could remain stuck. Expiring leases allow another worker to reclaim it.

## What I'd Do Next

1. Add real concurrent integration tests with multiple workers.
2. Add structured logging and metrics for retries, failures, and processing latency.
3. Replace `synchronize: true` with database migrations.
4. Improve queue efficiency and move to a dedicated queue if throughput requires it.
5. Add authentication and stronger payload validation for production use.