import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RoleOrmEntity } from './role.orm-entity';
import { UserOrmEntity } from './user.orm-entity';

/**
 * Cargos de cada usuário — tabela `user_role` (escopada por empresa).
 *
 * Já é escopado por `company_id`: papéis nunca vazam entre empresas (ADR 0002).
 */
@Entity('user_role')
export class UserRoleOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'role_id', type: 'uuid' })
  roleId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => UserOrmEntity, (user) => user.userRoles)
  @JoinColumn({ name: 'user_id' })
  user: UserOrmEntity;

  @ManyToOne(() => RoleOrmEntity, (role) => role.userRoles)
  @JoinColumn({ name: 'role_id' })
  role: RoleOrmEntity;
}
