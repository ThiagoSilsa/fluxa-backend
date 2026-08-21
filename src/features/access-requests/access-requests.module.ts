// NestJS
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Modules
import { AuthModule } from '../auth/auth.module';
import { DepartmentsModule } from '../departments/departments.module';
import { UsersModule } from '../users/users.module';
import { VehiclesModule } from '../vehicles/vehicles.module';

// Repository
import { ACCESS_REQUEST_REPOSITORY } from './domain/repositories/access-request.repository';

// Infrastructure
import { accessRequestsProviders } from './infrastructure/persistence/providers/access-requests.providers';
import { AccessRequestOrmEntity } from './infrastructure/persistence/typeorm/access-request.orm-entity';

// Use cases
import { AcceptAccessRequestUseCase } from './application/use-cases/accept-access-request.use-case';
import { CancelAccessRequestUseCase } from './application/use-cases/cancel-access-request.use-case';
import { CreateAccessRequestUseCase } from './application/use-cases/create-access-request.use-case';
import { GetAccessRequestUseCase } from './application/use-cases/get-access-request.use-case';
import { ListAccessRequestsUseCase } from './application/use-cases/list-access-requests.use-case';
import { MarkInContactAccessRequestUseCase } from './application/use-cases/mark-in-contact-access-request.use-case';
import { RejectAccessRequestUseCase } from './application/use-cases/reject-access-request.use-case';

// Presentation
import { AccessRequestsController } from './presentation/http/controllers/access-requests.controller';

/**
 * Módulo de solicitações de acesso (ADR 0010 — M2).
 *
 * Importa `AuthModule` (guards + `USER_COMPANY_REPOSITORY`), `UsersModule`
 * (`USER_REPOSITORY` — nomes de atores e criação de VISITOR), `VehiclesModule`
 * (`VEHICLE_REPOSITORY`/`VEHICLE_TYPE_REPOSITORY`/`USER_VEHICLE_REPOSITORY` —
 * resolução retroativa) e `DepartmentsModule` (`DEPARTMENT_REPOSITORY` —
 * validação do departamento). **Sem ciclo**: users/vehicles/departments não
 * importam access-requests.
 */
@Module({
  imports: [
    AuthModule,
    UsersModule,
    VehiclesModule,
    DepartmentsModule,
    TypeOrmModule.forFeature([AccessRequestOrmEntity]),
  ],
  providers: [
    ...accessRequestsProviders,
    CreateAccessRequestUseCase,
    ListAccessRequestsUseCase,
    GetAccessRequestUseCase,
    AcceptAccessRequestUseCase,
    RejectAccessRequestUseCase,
    MarkInContactAccessRequestUseCase,
    CancelAccessRequestUseCase,
  ],
  controllers: [AccessRequestsController],
  exports: [ACCESS_REQUEST_REPOSITORY],
})
export class AccessRequestsModule {}
