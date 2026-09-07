import { DataSource } from 'typeorm';

import {
  WebhookEvent,
  WebhookStatus,
} from '../webhooks/webhook.entity';

import { ProcessingAttempt } from '../attempts/attempt.entity';

import { ProcessedOrder } from '../processed-orders/processed-order.entity';

const MAX_ATTEMPTS = Number(
  process.env.MAX_ATTEMPTS || 5,
);

const LEASE_SECONDS = Number(
  process.env.LEASE_SECONDS || 10,
);

const WORKER_ID =
  process.env.WORKER_ID ||
  `worker-${process.pid}`;

const sleep = (ms: number) =>
  new Promise(resolve => setTimeout(resolve, ms));


/*
 * Keeps extending the lease while the worker is alive.
 *
 * This prevents a healthy worker processing a slow event
 * from losing its lease while it is still working.
 */
function startLeaseHeartbeat(
  dataSource: DataSource,
  eventId: string,
) {
  const intervalMs =
    Math.max(
      1000,
      Math.floor(
        (LEASE_SECONDS * 1000) / 2,
      ),
    );

  const interval = setInterval(
    async () => {
      try {
        const repository =
          dataSource.getRepository(
            WebhookEvent,
          );

        await repository
          .createQueryBuilder()
          .update(WebhookEvent)
          .set({
            leaseUntil: new Date(
              Date.now() +
              LEASE_SECONDS * 1000,
            ),
          })
          .where(
            'eventId = :eventId',
          )
          .andWhere(
            'status = :status',
          )
          .andWhere(
            'workerId = :workerId',
          )
          .setParameters({
            eventId,
            status:
              WebhookStatus.PROCESSING,
            workerId: WORKER_ID,
          })
          .execute();

      } catch (error) {
        console.error(
          `[${WORKER_ID}] Lease heartbeat error`,
          error,
        );
      }
    },
    intervalMs,
  );

  return () => {
    clearInterval(interval);
  };
}


/*
 * Performs the actual business processing.
 */
async function processEvent(
  dataSource: DataSource,
  event: WebhookEvent,
) {
  const attemptRepository =
    dataSource.getRepository(
      ProcessingAttempt,
    );

  const processedRepository =
    dataSource.getRepository(
      ProcessedOrder,
    );

  const attempt =
    attemptRepository.create({
      eventId: event.eventId,
      attemptNumber: event.attemptCount,
      workerId: WORKER_ID,
      startedAt: new Date(),
      finishedAt: null,
      result: 'started',
      error: null,
    });

  await attemptRepository.save(
    attempt,
  );

  try {
    const simulation =
      event.data?.simulation ||
      event.data?.simulate ||
      'ok';

    /*
     * Temporary failure.
     *
     * Example:
     * fail_then_succeed:2
     *
     * Attempt 1 -> fail
     * Attempt 2 -> fail
     * Attempt 3 -> succeed
     */
    if (
      simulation.startsWith(
        'fail_then_succeed:',
      )
    ) {
      const failCount =
        Number(
          simulation.split(':')[1],
        );

      if (
        event.attemptCount <=
        failCount
      ) {
        throw new Error(
          `Simulated temporary failure ${event.attemptCount}/${failCount}`,
        );
      }
    }

    /*
     * Permanent failure.
     */
    if (
      simulation === 'always_fail'
    ) {
      throw new Error(
        'Simulated permanent failure',
      );
    }

    /*
     * Slow processing.
     *
     * The heartbeat continues running
     * while this is sleeping.
     */
    if (
      simulation.startsWith('slow:')
    ) {
      const seconds =
        Number(
          simulation.split(':')[1],
        );

      await sleep(
        seconds * 1000,
      );
    }

    /*
     * Business action.
     *
     * eventId has a UNIQUE constraint in
     * processed_orders, so the same event
     * cannot create two business records.
     */
    const orderId =
      event.data?.orderId ||
      `ORDER-${event.eventId}`;

    try {
      await processedRepository.insert({
        orderId,
        eventId: event.eventId,
      });

    } catch (error: any) {

      /*
       * Another worker may have already
       * completed the business action.
       *
       * PostgreSQL error 23505 =
       * unique constraint violation.
       */
      if (
        error?.code !== '23505'
      ) {
        throw error;
      }
    }

    attempt.finishedAt =
      new Date();

    attempt.result =
      'success';

    await attemptRepository.save(
      attempt,
    );

    return {
      success: true,
    };

  } catch (error: any) {

    attempt.finishedAt =
      new Date();

    attempt.result =
      'failed';

    attempt.error =
      error?.message ||
      'Unknown error';

    await attemptRepository.save(
      attempt,
    );

    return {
      success: false,
      error:
        error?.message ||
        'Unknown error',
    };
  }
}


/*
 * Claims one available event.
 *
 * The database row lock prevents two workers
 * from claiming the same pending event.
 */
async function claimEvent(
  dataSource: DataSource,
): Promise<WebhookEvent | null> {

  const queryRunner =
    dataSource.createQueryRunner();

  await queryRunner.connect();

  await queryRunner.startTransaction();

  try {
    const now =
      new Date();

    const event =
      await queryRunner.manager
        .createQueryBuilder(
          WebhookEvent,
          'event',
        )
        .setLock(
          'pessimistic_write',
        )
        .where(
          `
          (
            event.status = :pending
            AND (
              event.nextAttemptAt IS NULL
              OR event.nextAttemptAt <= :now
            )
          )
          OR
          (
            event.status = :processing
            AND event.leaseUntil <= :now
          )
          `,
        )
        .setParameters({
          pending:
            WebhookStatus.PENDING,

          processing:
            WebhookStatus.PROCESSING,

          now,
        })
        .orderBy(
          'event.createdAt',
          'ASC',
        )
        .limit(1)
        .getOne();

    if (!event) {

      await queryRunner
        .rollbackTransaction();

      return null;
    }

    event.status =
      WebhookStatus.PROCESSING;

    event.workerId =
      WORKER_ID;

    event.leaseUntil =
      new Date(
        Date.now() +
        LEASE_SECONDS * 1000,
      );

    event.attemptCount += 1;

    await queryRunner.manager.save(
      event,
    );

    await queryRunner.commitTransaction();

    return event;

  } catch (error) {

    await queryRunner
      .rollbackTransaction();

    throw error;

  } finally {

    await queryRunner.release();
  }
}


/*
 * Updates the event after processing.
 */
async function finishEvent(
  dataSource: DataSource,
  event: WebhookEvent,
  result: {
    success: boolean;
    error?: string;
  },
) {
  const repository =
    dataSource.getRepository(
      WebhookEvent,
    );

  const current =
    await repository.findOne({
      where: {
        eventId: event.eventId,
      },
    });

  if (!current) {
    return;
  }

  /*
   * Successful processing.
   */
  if (result.success) {

    current.status =
      WebhookStatus.SUCCEEDED;

    current.leaseUntil = null;
    current.workerId = null;
    current.lastError = null;
    current.nextAttemptAt = null;

    await repository.save(
      current,
    );

    return;
  }

  /*
   * Maximum attempts reached.
   */
  if (
    current.attemptCount >=
    MAX_ATTEMPTS
  ) {

    current.status =
      WebhookStatus.FAILED;

    current.leaseUntil = null;
    current.workerId = null;

    current.lastError =
      result.error ||
      'Unknown error';

    await repository.save(
      current,
    );

    return;
  }

  /*
   * Exponential backoff.
   *
   * Attempt 1 -> 2 seconds
   * Attempt 2 -> 4 seconds
   * Attempt 3 -> 8 seconds
   * Attempt 4 -> 16 seconds
   */
  const delay =
    Math.pow(
      2,
      current.attemptCount,
    ) * 1000;

  current.status =
    WebhookStatus.PENDING;

  current.nextAttemptAt =
    new Date(
      Date.now() + delay,
    );

  current.leaseUntil = null;
  current.workerId = null;

  current.lastError =
    result.error ||
    'Unknown error';

  await repository.save(
    current,
  );
}


/*
 * Start worker.
 */
async function runWorker() {

  const dataSource =
    new DataSource({
      type: 'postgres',

      host:
        process.env.DATABASE_HOST ||
        'localhost',

      port:
        Number(
          process.env.DATABASE_PORT ||
          5432,
        ),

      username:
        process.env.DATABASE_USER ||
        'postgres',

      password:
        process.env.DATABASE_PASSWORD ||
        'postgres',

      database:
        process.env.DATABASE_NAME ||
        'webhook_db',

      entities: [
        WebhookEvent,
        ProcessingAttempt,
        ProcessedOrder,
      ],

      synchronize: true,
    });

  await dataSource.initialize();

  console.log(
    `[${WORKER_ID}] Worker started`,
  );

  while (true) {

    try {

      const event =
        await claimEvent(
          dataSource,
        );

      if (!event) {
        await sleep(1000);
        continue;
      }

      console.log(
        `[${WORKER_ID}] Processing ${event.eventId}, attempt ${event.attemptCount}`,
      );

      /*
       * Start heartbeat for this event.
       */
      const stopHeartbeat =
        startLeaseHeartbeat(
          dataSource,
          event.eventId,
        );

      try {

        const result =
          await processEvent(
            dataSource,
            event,
          );

        await finishEvent(
          dataSource,
          event,
          result,
        );

      } finally {

        /*
         * Always stop the heartbeat when
         * processing finishes.
         */
        stopHeartbeat();
      }

    } catch (error) {

      console.error(
        `[${WORKER_ID}] Worker error`,
        error,
      );

      await sleep(1000);
    }
  }
}


runWorker();