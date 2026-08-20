// NestJS
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Modules
import { AuthModule } from '../auth/auth.module';

// Repository
import { IMPORT_JOB_REPOSITORY } from './domain/repositories/import-job.repository';

// Infrastructure
import { importJobProviders } from './infrastructure/persistence/providers/import-job.providers';
import { ImportJobOrmEntity } from './infrastructure/persistence/typeorm/import-job.orm-entity';

// Use cases
import { GetImportJobStatusUseCase } from './application/use-cases/get-import-job-status.use-case';
import { ListImportJobsUseCase } from './application/use-cases/list-import-jobs.use-case';

// Presentation
import { ImportJobsController } from './presentation/http/controllers/import-jobs.controller';

/**
 * Módulo genérico de jobs de importação (ADR 0007 §1/§6).
 *
 * Importa `AuthModule` para os use cases de JWT/validação usados pelos guards
 * compartilhados (`JwtAuthGuard`, `PermissionsGuard`) — mesmo padrão das
 * demais features. Expõe a consulta (`GET /import-jobs` e
 * `GET /import-jobs/:jobId`) e exporta o `IMPORT_JOB_REPOSITORY` para os
 * importadores de cada recurso (departments, vehicles, users), que
 * criam/enfileiram/atualizam jobs.
 */
@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([ImportJobOrmEntity])],
  controllers: [ImportJobsController],
  providers: [
    ...importJobProviders,
    ListImportJobsUseCase,
    GetImportJobStatusUseCase,
  ],
  exports: [IMPORT_JOB_REPOSITORY],
})
export class ImportsModule {}
