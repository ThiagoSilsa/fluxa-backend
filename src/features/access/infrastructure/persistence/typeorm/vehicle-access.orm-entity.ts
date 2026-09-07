// TypeORM
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// Constants
import { AccessStatus } from '../../../domain/constants/access.constant';

/**
 * Estado da visita de um veículo — tabela `vehicle_access` (migration `0004`).
 *
 * Propriedades com `!` são preenchidas pelo ORM em runtime (padrão TypeORM em
 * modo estrito).
 */
@Entity('vehicle_access')
export class VehicleAccessOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId!: string;

  @Column({ name: 'vehicle_id', type: 'uuid', nullable: true })
  vehicleId!: string | null;

  @Column({
    name: 'temporary_plate',
    type: 'varchar',
    length: 10,
    nullable: true,
  })
  temporaryPlate!: string | null;

  @Column({ name: 'driver_user_id', type: 'uuid', nullable: true })
  driverUserId!: string | null;

  @Column({
    name: 'temporary_driver_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  temporaryDriverName!: string | null;

  @Column({ name: 'department_id', type: 'uuid', nullable: true })
  departmentId!: string | null;

  @Column({ name: 'access_request_id', type: 'uuid', nullable: true })
  accessRequestId!: string | null;

  @Column({ name: 'over_capacity', type: 'boolean', default: false })
  overCapacity!: boolean;

  @Column({
    type: 'enum',
    enum: AccessStatus,
    enumName: 'access_status',
    default: AccessStatus.INSIDE,
  })
  status!: AccessStatus;

  @Column({ name: 'forced_exit', type: 'boolean', default: false })
  forcedExit!: boolean;

  @Column({ name: 'entry_at', type: 'timestamptz', nullable: true })
  entryAt!: Date | null;

  @Column({ name: 'exit_at', type: 'timestamptz', nullable: true })
  exitAt!: Date | null;

  @Column({ name: 'closed_by', type: 'uuid', nullable: true })
  closedBy!: string | null;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
