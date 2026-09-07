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
  BlockRequestStatus,
  SyncStatus,
} from '../../../domain/constants/block.constant';

/**
 * Solicitação de bloqueio feita pelo porteiro — tabela `block_request`
 * (migration `0003`).
 *
 * Propriedades com `!` são preenchidas pelo ORM em runtime (padrão TypeORM em
 * modo estrito).
 */
@Entity('block_request')
export class BlockRequestOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId!: string;

  @Column({ name: 'vehicle_id', type: 'uuid', nullable: true })
  vehicleId!: string | null;

  @Column({ type: 'varchar', length: 10 })
  plate!: string;

  @Column({ type: 'text' })
  reason!: string;

  @Column({
    type: 'enum',
    enum: BlockRequestStatus,
    enumName: 'block_request_status',
    default: BlockRequestStatus.PENDING,
  })
  status!: BlockRequestStatus;

  @Column({ name: 'requested_by', type: 'uuid' })
  requestedBy!: string;

  @Column({ name: 'requested_at', type: 'timestamptz' })
  requestedAt!: Date;

  @Column({ name: 'handled_by', type: 'uuid', nullable: true })
  handledBy!: string | null;

  @Column({ name: 'handled_at', type: 'timestamptz', nullable: true })
  handledAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  observation!: string | null;

  @Column({ name: 'status_history', type: 'jsonb', default: () => "'[]'" })
  statusHistory!: unknown[];

  @Column({ name: 'resolved_block_id', type: 'uuid', nullable: true })
  resolvedBlockId!: string | null;

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
