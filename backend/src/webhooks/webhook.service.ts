import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  WebhookEvent,
  WebhookStatus,
} from './webhook.entity';

import { ProcessingAttempt } from '../attempts/attempt.entity';

@Injectable()
export class WebhookService {
  constructor(
  @InjectRepository(WebhookEvent)
  private readonly eventRepository: Repository<WebhookEvent>,

  @InjectRepository(ProcessingAttempt)
  private readonly attemptRepository: Repository<ProcessingAttempt>,
) {}

  async receive(body: any) {
    const event = this.eventRepository.create({
      eventId: body.eventId,
      type: body.type,
      data: body.data || {},
      status: WebhookStatus.PENDING,
      attemptCount: 0,
      nextAttemptAt: new Date(),
    });

    try {
      await this.eventRepository.save(event);

      return {
        accepted: true,
        duplicate: false,
        eventId: event.eventId,
      };
    } catch (error: any) {
      // PostgreSQL unique constraint violation.
      // This safely handles simultaneous duplicate submissions.
      if (error?.code === '23505') {
        return {
          accepted: true,
          duplicate: true,
          eventId: body.eventId,
        };
      }

      throw error;
    }
  }

  async getEvents() {
    return this.eventRepository.find({
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async getEvent(eventId: string) {
    const event = await this.eventRepository.findOne({
      where: {
        eventId,
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    return event;
  }
  async getAttempts(eventId: string) {
  const event = await this.eventRepository.findOne({
    where: {
      eventId,
    },
  });

  if (!event) {
    throw new NotFoundException('Event not found');
  }

  return this.attemptRepository.find({
    where: {
      eventId,
    },
    order: {
      attemptNumber: 'ASC',
    },
  });
}
  
  async manualRetry(eventId: string) {
    const event = await this.eventRepository.findOne({
      where: {
        eventId,
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    event.status = WebhookStatus.PENDING;
    event.attemptCount = 0;
    event.nextAttemptAt = new Date();
    event.leaseUntil = null;
    event.workerId = null;
    event.lastError = null;

    await this.eventRepository.save(event);

    return {
      success: true,
      eventId,
    };
  }
}