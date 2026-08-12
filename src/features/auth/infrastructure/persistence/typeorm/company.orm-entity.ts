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
import { UserCompanyOrmEntity } from './user-company.orm-entity';

/**
 * Empresa (tenant) — tabela `company`.
 *
 * Propriedades com `!` são preenchidas pelo ORM em runtime (padrão TypeORM
 * em modo estrito).
 */
@Entity('company')
export class CompanyOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'varchar', length: 64, default: 'America/Sao_Paulo' })
  timezone!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany(() => UserCompanyOrmEntity, (link) => link.company)
  userCompanies!: UserCompanyOrmEntity[];
}
