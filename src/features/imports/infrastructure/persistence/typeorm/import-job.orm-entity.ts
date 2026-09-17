// TypeORM
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// Constants
import {
  ImportJobStatus,
  ImportJobType,
} from '../../../domain/constants/import-job.constant';
import type {
  ImportRowErrorCode,
  ImportRowErrorParams,
} from '../../../domain/constants/import-row-error.constant';

/**
 * Job de importação — tabela `import_job` (migrations `0005`, `0011` e `0015`;
 * ADR 0007 §3). Colunas de enum mapeiam os ENUMs nativos do Postgres.
 *
 * Propriedades com `!` são preenchidas pelo ORM em runtime (padrão TypeORM em
 * modo estrito).
 */
@Entity('import_job')
export class ImportJobOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'company_id', type: 'uuid' })
  companyId!: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @Column({ type: 'enum', enum: ImportJobType, enumName: 'import_job_type' })
  type!: ImportJobType;

  @Column({
    type: 'enum',
    enum: ImportJobStatus,
    enumName: 'import_job_status',
    default: ImportJobStatus.PENDING,
  })
  status!: ImportJobStatus;

  @Column({ name: 'file_url', type: 'varchar', length: 512, nullable: true })
  fileUrl!: string | null;

  @Column({ name: 'file_name', type: 'varchar', length: 255, nullable: true })
  fileName!: string | null;

  @Column({ name: 'total_rows', type: 'int', default: 0 })
  totalRows!: number;

  @Column({ name: 'processed_rows', type: 'int', default: 0 })
  processedRows!: number;

  @Column({ name: 'success_count', type: 'int', default: 0 })
  successCount!: number;

  @Column({ name: 'error_count', type: 'int', default: 0 })
  errorCount!: number;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ name: 'error_code', type: 'varchar', length: 100, nullable: true })
  errorCode!: ImportRowErrorCode | null;

  @Column({ name: 'error_params', type: 'jsonb', nullable: true })
  errorParams!: ImportRowErrorParams | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
