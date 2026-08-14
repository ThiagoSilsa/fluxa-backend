// NestJS
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// Entities
import { RolePermissionOrmEntity } from './role-permission.orm-entity';
import { UserRoleOrmEntity } from './user-role.orm-entity';

/**
 * Cargo (por empresa) — tabela `role`.
 *
 * Propriedades com `!` são preenchidas pelo ORM em runtime (padrão TypeORM
 * em modo estrito).
 */
@Entity('role')
export class RoleOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId!: string;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'is_admin', type: 'boolean', default: false })
  isAdmin!: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => RolePermissionOrmEntity, (rp) => rp.role)
  rolePermissions!: RolePermissionOrmEntity[];

  @OneToMany(() => UserRoleOrmEntity, (userRole) => userRole.role)
  userRoles!: UserRoleOrmEntity[];
}
