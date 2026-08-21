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
  VehicleBlockStatus,
  VehicleBlockType,
} from '../../../domain/constants/block.constant';

/**
 * Estado de bloqueio de um veículo — tabela `vehicle_block` (migration `0003`).
 * Histórico de estados: a única mutação é `ACTIVE → REVOKED`.
 *
 * Propriedades com `!` são preenchidas pelo ORM em runtime (padrão TypeORM em
 * modo estrito).
 */
@Entity('vehicle_block')
export class VehicleBlockOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId!: string;

  @Column({ name: 'vehicle_id', type: 'uuid', nullable: true })
  vehicleId!: string | null;

  @Column({ type: 'varchar', length: 10 })
  plate!: string;

  @Column({
    name: 'block_type',
    type: 'enum',
    enum: VehicleBlockType,
    enumName: 'vehicle_block_type',
    default: VehicleBlockType.MANUAL,
  })
  blockType!: VehicleBlockType;

  @Column({ type: 'text' })
  reason!: string;

  @Column({
    type: 'enum',
    enum: VehicleBlockStatus,
    enumName: 'vehicle_block_status',
    default: VehicleBlockStatus.ACTIVE,
  })
  status!: VehicleBlockStatus;

  @Column({ name: 'blocked_by', type: 'uuid', nullable: true })
  blockedBy!: string | null;

  @Column({ name: 'blocked_at', type: 'timestamptz' })
  blockedAt!: Date;

  @Column({ name: 'revoked_by', type: 'uuid', nullable: true })
  revokedBy!: string | null;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @Column({ name: 'revoked_reason', type: 'text', nullable: true })
  revokedReason!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
