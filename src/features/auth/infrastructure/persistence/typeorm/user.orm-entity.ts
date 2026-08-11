import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserCompanyOrmEntity } from './user-company.orm-entity';
import { UserRoleOrmEntity } from './user-role.orm-entity';

/**
 * Pessoa (identidade) — tabela `user`.
 *
 * Modelo-alvo do ADR 0002: sem `company_id`, `type` ou `is_active` (esses
 * vivem no vínculo `user_company`). `email` e `document` são únicos globais.
 */
@Entity('user')
export class UserOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  password: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true, unique: true })
  document: string | null;

  @Column({ type: 'text', nullable: true })
  observation: string | null;

  @Column({ name: 'photo_url', type: 'varchar', length: 512, nullable: true })
  photoUrl: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => UserCompanyOrmEntity, (link) => link.user)
  companies: UserCompanyOrmEntity[];

  @OneToMany(() => UserRoleOrmEntity, (userRole) => userRole.user)
  userRoles: UserRoleOrmEntity[];
}
