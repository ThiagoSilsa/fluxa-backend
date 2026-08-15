// NestJS
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Modules
import { AuthModule } from '../auth/auth.module';

// Repository
import { DEPARTMENT_REPOSITORY } from './domain/repositories/department.repository';

// Infrastructure
import { departmentsProviders } from './infrastructure/persistence/providers/departments.providers';
import { DepartmentOrmEntity } from './infrastructure/persistence/typeorm/department.orm-entity';

// Use cases
import { CreateDepartmentUseCase } from './application/use-cases/create-department.use-case';
import { DeactivateDepartmentUseCase } from './application/use-cases/deactivate-department.use-case';
import { GetDepartmentUseCase } from './application/use-cases/get-department.use-case';
import { ListDepartmentsUseCase } from './application/use-cases/list-departments.use-case';
import { UpdateDepartmentUseCase } from './application/use-cases/update-department.use-case';

// Presentation
import { DepartmentsController } from './presentation/http/controllers/departments.controller';

/**
 * Módulo de departamentos (CRUD por empresa — ADR 0006 §1).
 *
 * Importa `AuthModule` para os use cases de JWT/validação usados pelos guards
 * compartilhados (`JwtAuthGuard`, `PermissionsGuard`). Exporta o
 * `DEPARTMENT_REPOSITORY` para a feature `vehicles` (validação do departamento
 * no vínculo `vehicle_department` — Fase 3).
 */
@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([DepartmentOrmEntity])],
  providers: [
    ...departmentsProviders,
    CreateDepartmentUseCase,
    ListDepartmentsUseCase,
    GetDepartmentUseCase,
    UpdateDepartmentUseCase,
    DeactivateDepartmentUseCase,
  ],
  controllers: [DepartmentsController],
  exports: [DEPARTMENT_REPOSITORY],
})
export class DepartmentsModule {}
