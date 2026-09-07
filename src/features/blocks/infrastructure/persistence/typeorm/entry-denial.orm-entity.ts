// TypeORM
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// Constants
import {
  EntryDenialReason,
  SyncStatus,
} from '../../../domain/constants/block.constant';

/**
 * Evento de impedimento de entrada — tabela `entry_denial` (migration `0003`).
 * Ledger imutável (append-only): nunca é deletado.
 *
 * Propriedades com `!` são preenchidas pelo ORM em runtime (padrão TypeORM em
 * modo estrito).
 */
@Entity('entry_denial')
export class EntryDenialOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId!: string;

  @Column({ name: 'vehicle_id', type: 'uuid', nullable: true })
  vehicleId!: string | null;

  @Column({ name: 'plate_snapshot', type: 'varchar', length: 10 })
  plateSnapshot!: string;

  @Column({ name: 'block_id', type: 'uuid', nullable: true })
  blockId!: string | null;

  @Column({
    type: 'enum',
    enum: EntryDenialReason,
    enumName: 'entry_denial_reason',
  })
  reason!: EntryDenialReason;

  @Column({ type: 'text', nullable: true })
  observation!: string | null;

  @Column({ name: 'entrance_id', type: 'uuid', nullable: true })
  entranceId!: string | null;

  @Column({ name: 'doorman_id', type: 'uuid' })
  doormanId!: string;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;

  @Column({
    name: 'sync_status',
    type: 'enum',
    enum: SyncStatus,
    enumName: 'sync_status',
    default: SyncStatus.PENDING,
  })
  syncStatus!: SyncStatus;

  @Column({ name: 'idempotency_key', type: 'uuid' })
  idempotencyKey!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
