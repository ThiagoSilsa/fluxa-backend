// NestJS
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Modules
import { AuthModule } from '../auth/auth.module';

// Repositories
import { USER_REPOSITORY } from './domain/repositories/user.repository';

// Infrastructure
import { usersProviders } from './infrastructure/persistence/providers/users.providers';
import { UserCompanyOrmEntity } from './infrastructure/persistence/typeorm/user-company.orm-entity';
import { UserOrmEntity } from './infrastructure/persistence/typeorm/user.orm-entity';

// Use cases
import { ChangePasswordUseCase } from './application/use-cases/change-password.use-case';
import { CreateUserUseCase } from './application/use-cases/create-user.use-case';
import { DeactivateUserUseCase } from './application/use-cases/deactivate-user.use-case';
import { EmailStatusUseCase } from './application/use-cases/email-status.use-case';
import { GetUserUseCase } from './application/use-cases/get-user.use-case';
import { ListUsersUseCase } from './application/use-cases/list-users.use-case';
import { UpdateUserUseCase } from './application/use-cases/update-user.use-case';

// Presentation
import { UsersController } from './presentation/http/controllers/users.controller';

/**
 * Módulo de usuários (CRUD de `user`, `user_company` e, nas fases seguintes,
 * `user_role`) — ADR 0005.
 *
 * Importa `AuthModule` para o `PasswordHashUseCase`, o
 * `USER_COMPANY_REPOSITORY` (vínculos) e os use cases de JWT/validação usados
 * pelos guards compartilhados aplicados nos controllers.
 */
@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([UserOrmEntity, UserCompanyOrmEntity]),
  ],
  providers: [
    ...usersProviders,
    CreateUserUseCase,
    ListUsersUseCase,
    GetUserUseCase,
    EmailStatusUseCase,
    UpdateUserUseCase,
    DeactivateUserUseCase,
    ChangePasswordUseCase,
  ],
  controllers: [UsersController],
  exports: [USER_REPOSITORY],
})
export class UsersModule {}
