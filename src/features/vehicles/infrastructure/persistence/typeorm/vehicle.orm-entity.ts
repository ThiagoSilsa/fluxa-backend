// TypeORM
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// TypeORM
import { VehicleTypeOrmEntity } from './vehicle-type.orm-entity';

/**
 * Veículo (por empresa) — tabela `vehicle` (migration `0002`).
 *
 * Propriedades com `!` são preenchidas pelo ORM em runtime (padrão TypeORM em
 * modo estrito). `vehicleTypeId` é coluna simples (padrão do projeto) e a
 * relação `vehicleType` permite o join para o detalhe/listagem.
 */
@Entity('vehicle')
export class VehicleOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 10 })
  plate!: string;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId!: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  model!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  color!: string | null;

  @Column({ type: 'text', nullable: true })
  observation!: string | null;

  @Column({ name: 'is_blocked', type: 'boolean', default: false })
  isBlocked!: boolean;

  @Column({ name: 'free_pass', type: 'boolean', default: false })
  freePass!: boolean;

  @Column({ name: 'vehicle_type_id', type: 'uuid' })
  vehicleTypeId!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => VehicleTypeOrmEntity, { nullable: false })
  @JoinColumn({ name: 'vehicle_type_id' })
  vehicleType!: VehicleTypeOrmEntity;
}
