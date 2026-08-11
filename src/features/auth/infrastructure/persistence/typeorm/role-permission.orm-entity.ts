import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PermissionOrmEntity } from './permission.orm-entity';
import { RoleOrmEntity } from './role.orm-entity';

/**
 * Permissões de cada cargo — tabela `role_permission` (escopada por empresa).
 */
@Entity('role_permission')
export class RolePermissionOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId: string;

  @Column({ name: 'role_id', type: 'uuid' })
  roleId: string;

  @Column({ name: 'permission_id', type: 'uuid' })
  permissionId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => RoleOrmEntity, (role) => role.rolePermissions)
  @JoinColumn({ name: 'role_id' })
  role: RoleOrmEntity;

  @ManyToOne(
    () => PermissionOrmEntity,
    (permission) => permission.rolePermissions,
  )
  @JoinColumn({ name: 'permission_id' })
  permission: PermissionOrmEntity;
}
