// NestJS
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Modules
import { AuthModule } from '../auth/auth.module';

// Repositories
import { PERMISSION_REPOSITORY } from './domain/repositories/permission.repository';
import { ROLE_REPOSITORY } from './domain/repositories/role.repository';

// Infrastructure
import { rolesProviders } from './infrastructure/persistence/providers/roles.providers';
import { PermissionOrmEntity } from './infrastructure/persistence/typeorm/permission.orm-entity';
import { RolePermissionOrmEntity } from './infrastructure/persistence/typeorm/role-permission.orm-entity';
import { RoleOrmEntity } from './infrastructure/persistence/typeorm/role.orm-entity';

// Use cases
import { AssociatePermissionToRoleUseCase } from './application/use-cases/associate-permission-to-role.use-case';
import { CreateRoleUseCase } from './application/use-cases/create-role.use-case';
import { DeleteRoleUseCase } from './application/use-cases/delete-role.use-case';
import { GetRoleUseCase } from './application/use-cases/get-role.use-case';
import { ListPermissionsUseCase } from './application/use-cases/list-permissions.use-case';
import { ListRolePermissionsUseCase } from './application/use-cases/list-role-permissions.use-case';
import { ListRolesUseCase } from './application/use-cases/list-roles.use-case';
import { RemovePermissionFromRoleUseCase } from './application/use-cases/remove-permission-from-role.use-case';
import { UpdateRoleUseCase } from './application/use-cases/update-role.use-case';

// Presentation
import { PermissionsController } from './presentation/http/controllers/permissions.controller';
import { RolesController } from './presentation/http/controllers/roles.controller';

/**
 * Módulo de cargos e permissões (RBAC operacional — ADR 0004).
 *
 * CRUD de cargos, catálogo de permissões e (Fase 2) o vínculo
 * `role_permission`. Entidades ORM de RBAC vivem aqui (movidas do módulo
 * `auth` — os dois registram as mesmas em seus `forFeature`).
 */
@Module({
  imports: [
    // Fornece os use cases de JWT/validação usados pelos guards compartilhados
    // (`JwtAuthGuard`, `PermissionsGuard`) aplicados nos controllers.
    AuthModule,
    TypeOrmModule.forFeature([
      RoleOrmEntity,
      PermissionOrmEntity,
      RolePermissionOrmEntity,
    ]),
  ],
  providers: [
    ...rolesProviders,
    CreateRoleUseCase,
    ListRolesUseCase,
    GetRoleUseCase,
    UpdateRoleUseCase,
    DeleteRoleUseCase,
    ListPermissionsUseCase,
    AssociatePermissionToRoleUseCase,
    RemovePermissionFromRoleUseCase,
    ListRolePermissionsUseCase,
  ],
  controllers: [RolesController, PermissionsController],
  exports: [ROLE_REPOSITORY, PERMISSION_REPOSITORY],
})
export class RolesModule {}
