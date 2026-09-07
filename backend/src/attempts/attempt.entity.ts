import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('processing_attempts')
export class ProcessingAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  eventId: string;

  @Column()
  attemptNumber: number;

  @Column()
  workerId: string;

  @Column({
    type: 'timestamp',
  })
  startedAt: Date;

  @Column({
    type: 'timestamp',
    nullable: true,
  })
  finishedAt: Date | null;

  @Column()
  result: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  error: string | null;

  @CreateDateColumn()
  createdAt: Date;
}