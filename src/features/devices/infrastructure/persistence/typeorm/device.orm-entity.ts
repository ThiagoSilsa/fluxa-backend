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

// Constants
import { DevicePlatform } from '../../../domain/constants/device-platform.constant';

// TypeORM (feature entrances — portaria vinculada)
import { EntranceOrmEntity } from '../../../../entrances/infrastructure/persistence/typeorm/entrance.orm-entity';

/**
 * Dispositivo do app do porteiro — tabela `device` (migration `0005`; ADR
 * 0008). `token` é write-only (nunca serializado nas respostas). `platform`
 * é imutável após a criação; `appVersion`/`lastSyncAt` são preenchidos pelo
 * app (somente leitura na web).
 *
 * Propriedades com `!` são preenchidas pelo ORM em runtime (padrão TypeORM em
 * modo estrito).
 */
@Entity('device')
export class DeviceOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'varchar', length: 64 })
  token!: string;

  @Column({ type: 'enum', enum: DevicePlatform, enumName: 'device_platform' })
  platform!: DevicePlatform;

  @Column({ name: 'app_version', type: 'varchar', length: 32, nullable: true })
  appVersion!: string | null;

  @Column({ name: 'entrance_id', type: 'uuid', nullable: true })
  entranceId!: string | null;

  @Column({ name: 'last_sync_at', type: 'timestamptz', nullable: true })
  lastSyncAt!: Date | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => EntranceOrmEntity, { nullable: true })
  @JoinColumn({ name: 'entrance_id' })
  entrance!: EntranceOrmEntity | null;
}
