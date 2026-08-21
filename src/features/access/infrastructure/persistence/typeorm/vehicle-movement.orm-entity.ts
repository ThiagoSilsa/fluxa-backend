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
  MovementSource,
  MovementType,
  SyncStatus,
} from '../../../domain/constants/access.constant';

/**
 * Evento de movimento (entrada/saída) — tabela `vehicle_movement` (migration
 * `0004`). Ledger imutável.
 *
 * Propriedades com `!` são preenchidas pelo ORM em runtime (padrão TypeORM em
 * modo estrito).
 */
@Entity('vehicle_movement')
export class VehicleMovementOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId!: string;

  @Column({ name: 'access_id', type: 'uuid', nullable: true })
  accessId!: string | null;

  @Column({ name: 'vehicle_id', type: 'uuid', nullable: true })
  vehicleId!: string | null;

  @Column({
    type: 'enum',
    enum: MovementType,
    enumName: 'movement_type',
  })
  type!: MovementType;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;

  @Column({ name: 'plate_snapshot', type: 'varchar', length: 10 })
  plateSnapshot!: string;

  @Column({ name: 'driver_user_id', type: 'uuid', nullable: true })
  driverUserId!: string | null;

  @Column({ name: 'department_id', type: 'uuid', nullable: true })
  departmentId!: string | null;

  @Column({
    type: 'enum',
    enum: MovementSource,
    enumName: 'movement_source',
  })
  source!: MovementSource;

  @Column({ name: 'entrance_id', type: 'uuid', nullable: true })
  entranceId!: string | null;

  @Column({ name: 'doorman_id', type: 'uuid', nullable: true })
  doormanId!: string | null;

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
