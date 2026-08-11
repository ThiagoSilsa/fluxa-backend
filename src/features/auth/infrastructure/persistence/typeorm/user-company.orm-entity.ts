import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserType } from '../../../domain/constants/user-type.constant';
import { CompanyOrmEntity } from './company.orm-entity';
import { UserOrmEntity } from './user.orm-entity';

/**
 * Vínculo pessoa ↔ empresa — tabela `user_company` (ADR 0002).
 *
 * `type` e `is_active` (o que muda por empresa) moram aqui. Uma pessoa só
 * participa de uma empresa uma vez (`UNIQUE (user_id, company_id)`).
 */
@Entity('user_company')
export class UserCompanyOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId: string;

  @Column({ type: 'enum', enum: UserType, enumName: 'user_type' })
  type: UserType;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => UserOrmEntity, (user) => user.companies)
  @JoinColumn({ name: 'user_id' })
  user: UserOrmEntity;

  @ManyToOne(() => CompanyOrmEntity, (company) => company.userCompanies)
  @JoinColumn({ name: 'company_id' })
  company: CompanyOrmEntity;
}
