import { NotFoundException } from '@nestjs/common';

import {
  WebhookService,
} from '../src/webhooks/webhook.service';

import {
  WebhookStatus,
} from '../src/webhooks/webhook.entity';

describe('WebhookService', () => {
  function createService() {
    const eventRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
    };

    const attemptRepository = {
      find: jest.fn(),
    };

    const service = new WebhookService(
      eventRepository as any,
      attemptRepository as any,
    );

    return {
      service,
      eventRepository,
      attemptRepository,
    };
  }

  describe('receive', () => {
    it(
      'handles a simultaneous duplicate safely',
      async () => {
        const {
          service,
          eventRepository,
        } = createService();

        const event = {
          eventId: 'evt-duplicate-test',
          type: 'order.created',
          data: {
            orderId: 'order-001',
          },
          status: WebhookStatus.PENDING,
          attemptCount: 0,
          nextAttemptAt: new Date(),
        };

        eventRepository.create.mockReturnValue(
          event,
        );

        eventRepository.save.mockRejectedValue({
          code: '23505',
        });

        const result =
          await service.receive({
            eventId: 'evt-duplicate-test',
            type: 'order.created',
            data: {
              orderId: 'order-001',
            },
          });

        expect(result).toEqual({
          accepted: true,
          duplicate: true,
          eventId: 'evt-duplicate-test',
        });

        expect(
          eventRepository.save,
        ).toHaveBeenCalledTimes(1);
      },
    );
  });

  describe('manualRetry', () => {
    it(
      'resets a failed event for a fresh retry cycle',
      async () => {
        const {
          service,
          eventRepository,
        } = createService();

        const event = {
          eventId: 'evt-failed-test',
          status: WebhookStatus.FAILED,
          attemptCount: 5,
          nextAttemptAt: null,
          leaseUntil: null,
          workerId: null,
          lastError: 'Simulated failure',
        };

        eventRepository.findOne.mockResolvedValue(
          event,
        );

        eventRepository.save.mockResolvedValue(
          event,
        );

        const result =
          await service.manualRetry(
            'evt-failed-test',
          );

        expect(result).toEqual({
          success: true,
          eventId: 'evt-failed-test',
        });

        expect(
          event.status,
        ).toBe(WebhookStatus.PENDING);

        expect(
          event.attemptCount,
        ).toBe(0);

        expect(
          event.leaseUntil,
        ).toBeNull();

        expect(
          event.workerId,
        ).toBeNull();

        expect(
          event.lastError,
        ).toBeNull();

        expect(
          event.nextAttemptAt,
        ).toBeInstanceOf(Date);

        expect(
          eventRepository.save,
        ).toHaveBeenCalledWith(event);
      },
    );

    it(
      'throws when the event does not exist',
      async () => {
        const {
          service,
          eventRepository,
        } = createService();

        eventRepository.findOne.mockResolvedValue(
          null,
        );

        await expect(
          service.manualRetry(
            'missing-event',
          ),
        ).rejects.toThrow(
          NotFoundException,
        );
      },
    );
  });
});