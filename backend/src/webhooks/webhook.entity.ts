import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum WebhookStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
}

@Entity('webhook_events')
export class WebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column()
  eventId: string;

  @Column()
  type: string;

  @Column({ type: 'jsonb' })
  data: any;

  @Column({
    type: 'enum',
    enum: WebhookStatus,
    default: WebhookStatus.PENDING,
  })
  status: WebhookStatus;

  @Column({ default: 0 })
  attemptCount: number;

  @Column({
    type: 'timestamp',
    nullable: true,
  })
  nextAttemptAt: Date | null;

  @Column({
    type: 'timestamp',
    nullable: true,
  })
  leaseUntil: Date | null;

  @Column({
    type: 'varchar',
    nullable: true,
  })
  workerId: string | null;

  @Column({
    type: 'text',
    nullable: true,
  })
  lastError: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}