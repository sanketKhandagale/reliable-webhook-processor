import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WebhookEvent } from './webhooks/webhook.entity';
import { ProcessingAttempt } from './attempts/attempt.entity';
import { ProcessedOrder } from './processed-orders/processed-order.entity';

import { WebhookController } from './webhooks/webhook.controller';
import { WebhookService } from './webhooks/webhook.service';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DATABASE_HOST || 'localhost',
      port: Number(process.env.DATABASE_PORT || 5432),
      username: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgres',
      database: process.env.DATABASE_NAME || 'webhook_db',

      entities: [
        WebhookEvent,
        ProcessingAttempt,
        ProcessedOrder,
      ],

      synchronize: true,
    }),

    TypeOrmModule.forFeature([
      WebhookEvent,
      ProcessingAttempt,
      ProcessedOrder,
    ]),
  ],

  controllers: [
    WebhookController,
  ],

  providers: [
    WebhookService,
  ],
})
export class AppModule {}