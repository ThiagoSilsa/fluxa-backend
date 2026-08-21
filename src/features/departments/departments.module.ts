// NestJS
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Modules
import { AuthModule } from '../auth/auth.module';
import { ImportsModule } from '../imports/imports.module';

// Shared
import {
  QUEUE_NAMES,
  registerImportQueue,
} from '../../shared/queue/queue.module';

// Repository
import { DEPARTMENT_REPOSITORY } from './domain/repositories/department.repository';

// Infrastructure
import { departmentsProviders } from './infrastructure/persistence/providers/departments.providers';
import { DepartmentOrmEntity } from './infrastructure/persistence/typeorm/department.orm-entity';

// Use cases
import { CreateDepartmentUseCase } from './application/use-cases/create-department.use-case';
import { DeleteDepartmentUseCase } from './application/use-cases/delete-department.use-case';
import { GetDepartmentUseCase } from './application/use-cases/get-department.use-case';
import { ImportDepartmentsUseCase } from './application/use-cases/import-departments.use-case';
import { ListDepartmentsUseCase } from './application/use-cases/list-departments.use-case';
import { UpdateDepartmentUseCase } from './application/use-cases/update-department.use-case';

// Processors
import { ImportDepartmentsProcessor } from './application/processors/import-departments.processor';

// Presentation
import { DepartmentsController } from './presentation/http/controllers/departments.controller';
import { DepartmentsImportController } from './presentation/http/controllers/departments-import.controller';

/**
 * Módulo de departamentos (CRUD por empresa — ADR 0006 §1) e importação em
 * lote por planilha (ADR 0007).
 *
 * Importa `AuthModule` para os use cases de JWT/validação usados pelos guards
 * compartilhados (`JwtAuthGuard`, `PermissionsGuard`) e `ImportsModule` para o
 * `IMPORT_JOB_REPOSITORY` (o importador cria/atualiza jobs). Exporta o
 * `DEPARTMENT_REPOSITORY` para a feature `vehicles` (validação do departamento
 * no vínculo `vehicle_department` — Fase 3).
 */
@Module({
  imports: [
    AuthModule,
    ImportsModule,
    registerImportQueue(QUEUE_NAMES.IMPORT_DEPARTMENTS),
    TypeOrmModule.forFeature([DepartmentOrmEntity]),
  ],
  providers: [
    ...departmentsProviders,
    CreateDepartmentUseCase,
    ListDepartmentsUseCase,
    GetDepartmentUseCase,
    UpdateDepartmentUseCase,
    DeleteDepartmentUseCase,
    ImportDepartmentsUseCase,
    ImportDepartmentsProcessor,
  ],
  controllers: [DepartmentsController, DepartmentsImportController],
  exports: [DEPARTMENT_REPOSITORY],
})
export class DepartmentsModule {}
