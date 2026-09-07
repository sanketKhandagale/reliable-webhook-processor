import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('processed_orders')
@Index(['eventId'], { unique: true })
export class ProcessedOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  orderId: string;

  @Column()
  eventId: string;

  @CreateDateColumn()
  processedAt: Date;
}