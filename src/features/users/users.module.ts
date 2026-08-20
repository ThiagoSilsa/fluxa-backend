// NestJS
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Modules
import { AuthModule } from '../auth/auth.module';
import { ImportsModule } from '../imports/imports.module';
import { RolesModule } from '../roles/roles.module';

// Shared
import {
  QUEUE_NAMES,
  registerImportQueue,
} from '../../shared/queue/queue.module';

// Repositories
import { USER_REPOSITORY } from './domain/repositories/user.repository';

// Infrastructure
import { usersProviders } from './infrastructure/persistence/providers/users.providers';
import { UserCompanyOrmEntity } from './infrastructure/persistence/typeorm/user-company.orm-entity';
import { UserOrmEntity } from './infrastructure/persistence/typeorm/user.orm-entity';
import { UserRoleOrmEntity } from '../roles/infrastructure/persistence/typeorm/user-role.orm-entity';

// Use cases
import { AssignRoleToUserUseCase } from './application/use-cases/assign-role-to-user.use-case';
import { ChangePasswordUseCase } from './application/use-cases/change-password.use-case';
import { CreateUserUseCase } from './application/use-cases/create-user.use-case';
import { DeleteUserUseCase } from './application/use-cases/delete-user.use-case';
import { EmailStatusUseCase } from './application/use-cases/email-status.use-case';
import { GetUserUseCase } from './application/use-cases/get-user.use-case';
import { ImportUsersUseCase } from './application/use-cases/import-users.use-case';
import { ListUserRolesUseCase } from './application/use-cases/list-user-roles.use-case';
import { ListUsersUseCase } from './application/use-cases/list-users.use-case';
import { RemoveRoleFromUserUseCase } from './application/use-cases/remove-role-from-user.use-case';
import { UpdateUserUseCase } from './application/use-cases/update-user.use-case';

// Processors
import { ImportUsersProcessor } from './application/processors/import-users.processor';

// Presentation
import { UserRolesController } from './presentation/http/controllers/user-roles.controller';
import { UsersController } from './presentation/http/controllers/users.controller';
import { UsersImportController } from './presentation/http/controllers/users-import.controller';

/**
 * Módulo de usuários (CRUD de `user`, `user_company` e `user_role`) — ADR
 * 0005.
 *
 * Importa `AuthModule` para o `PasswordHashUseCase`, o
 * `USER_COMPANY_REPOSITORY` (vínculos) e os use cases de JWT/validação usados
 * pelos guards compartilhados; importa `RolesModule` para o
 * `ROLE_REPOSITORY` (validação de cargos nos vínculos `user_role`).
 */
@Module({
  imports: [
    AuthModule,
    RolesModule,
    ImportsModule,
    registerImportQueue(QUEUE_NAMES.IMPORT_USERS),
    TypeOrmModule.forFeature([
      UserOrmEntity,
      UserCompanyOrmEntity,
      UserRoleOrmEntity,
    ]),
  ],
  providers: [
    ...usersProviders,
    CreateUserUseCase,
    ListUsersUseCase,
    GetUserUseCase,
    EmailStatusUseCase,
    UpdateUserUseCase,
    DeleteUserUseCase,
    ChangePasswordUseCase,
    AssignRoleToUserUseCase,
    RemoveRoleFromUserUseCase,
    ListUserRolesUseCase,
    ImportUsersUseCase,
    ImportUsersProcessor,
  ],
  controllers: [UsersController, UserRolesController, UsersImportController],
  exports: [USER_REPOSITORY],
})
export class UsersModule {}
