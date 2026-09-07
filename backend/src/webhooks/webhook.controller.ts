import {
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';

import { WebhookService } from './webhook.service';

@Controller()
export class WebhookController {
  constructor(
    private readonly webhookService: WebhookService,
  ) {}

  @Post('webhooks')
  async receive(@Body() body: any) {
    return this.webhookService.receive(body);
  }

  @Get('events')
  async events() {
    return this.webhookService.getEvents();
  }

  @Get('events/:eventId')
  async event(
    @Param('eventId') eventId: string,
  ) {
    return this.webhookService.getEvent(eventId);
  }

  @Get('events/:eventId/attempts')
  async attempts(
    @Param('eventId') eventId: string,
  ) {
    return this.webhookService.getAttempts(eventId);
  }

  @Post('events/:eventId/retry')
  async retry(
    @Param('eventId') eventId: string,
  ) {
    return this.webhookService.manualRetry(eventId);
  }
}