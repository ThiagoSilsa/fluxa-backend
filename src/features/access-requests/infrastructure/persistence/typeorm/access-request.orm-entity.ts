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
  AccessRequestStatus,
  AccessRequestType,
  ContactChannel,
} from '../../../domain/constants/access-request.constant';

// Types
import type { AccessRequestPayload } from '../../../domain/entities/access-request.entity';

/**
 * Solicitação de acesso — tabela `access_request` (migration `0005`).
 *
 * Propriedades com `!` são preenchidas pelo ORM em runtime (padrão TypeORM em
 * modo estrito).
 */
@Entity('access_request')
export class AccessRequestOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId!: string;

  @Column({ name: 'idempotency_key', type: 'uuid' })
  idempotencyKey!: string;

  @Column({
    type: 'enum',
    enum: AccessRequestType,
    enumName: 'access_request_type',
  })
  type!: AccessRequestType;

  @Column({ type: 'varchar', length: 10 })
  plate!: string;

  @Column({ name: 'vehicle_id', type: 'uuid', nullable: true })
  vehicleId!: string | null;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({
    type: 'enum',
    enum: AccessRequestStatus,
    enumName: 'access_request_status',
    default: AccessRequestStatus.PENDING,
  })
  status!: AccessRequestStatus;

  @Column({ name: 'entry_authorized', type: 'boolean', default: false })
  entryAuthorized!: boolean;

  @Column({ name: 'authorized_by', type: 'uuid', nullable: true })
  authorizedBy!: string | null;

  @Column({ name: 'authorized_at', type: 'timestamptz', nullable: true })
  authorizedAt!: Date | null;

  @Column({ name: 'requested_by', type: 'uuid' })
  requestedBy!: string;

  @Column({ name: 'requested_at', type: 'timestamptz' })
  requestedAt!: Date;

  @Column({ name: 'handled_by', type: 'uuid', nullable: true })
  handledBy!: string | null;

  @Column({ name: 'handled_at', type: 'timestamptz', nullable: true })
  handledAt!: Date | null;

  @Column({
    name: 'contact_channel',
    type: 'enum',
    enum: ContactChannel,
    enumName: 'contact_channel',
    nullable: true,
  })
  contactChannel!: ContactChannel | null;

  @Column({
    name: 'contact_phone',
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  contactPhone!: string | null;

  @Column({ name: 'department_id', type: 'uuid', nullable: true })
  departmentId!: string | null;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  payload!: AccessRequestPayload;

  @Column({ name: 'status_history', type: 'jsonb', default: () => "'[]'" })
  statusHistory!: unknown[];

  @Column({ name: 'resolved_user_id', type: 'uuid', nullable: true })
  resolvedUserId!: string | null;

  @Column({ name: 'resolved_vehicle_id', type: 'uuid', nullable: true })
  resolvedVehicleId!: string | null;

  @Column({ type: 'text', nullable: true })
  observation!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
