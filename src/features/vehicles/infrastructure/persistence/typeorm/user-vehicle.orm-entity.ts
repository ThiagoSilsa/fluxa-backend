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

// TypeORM (entidade da feature `users` — a pessoa é identidade global)
import { UserOrmEntity } from '../../../../users/infrastructure/persistence/typeorm/user.orm-entity';

/**
 * Vínculo motorista ↔ veículo (por empresa) — tabela `user_vehicle`
 * (migration `0002`).
 *
 * Propriedades com `!` são preenchidas pelo ORM em runtime (padrão TypeORM em
 * modo estrito). A tabela **não tem** `is_active` — a remoção é física.
 * `userId` é coluna simples (padrão do projeto) e a relação `user` permite o
 * join do nome do motorista nas respostas.
 */
@Entity('user_vehicle')
export class UserVehicleOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'vehicle_id', type: 'uuid' })
  vehicleId!: string;

  @Column({ name: 'is_primary', type: 'boolean', default: false })
  isPrimary!: boolean;

  @Column({ name: 'can_drive', type: 'boolean', default: true })
  canDrive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ManyToOne(() => UserOrmEntity, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user!: UserOrmEntity;
}
