import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AUTH_REPOSITORY } from './domain/repositories/auth.repository';
import { USER_COMPANY_REPOSITORY } from './domain/repositories/user-company.repository';
import { authProviders } from './infrastructure/persistence/providers/auth.providers';
import { userCompanyProviders } from './infrastructure/persistence/providers/user-company.providers';
import { CompanyOrmEntity } from './infrastructure/persistence/typeorm/company.orm-entity';
import { PermissionOrmEntity } from './infrastructure/persistence/typeorm/permission.orm-entity';
import { RolePermissionOrmEntity } from './infrastructure/persistence/typeorm/role-permission.orm-entity';
import { RoleOrmEntity } from './infrastructure/persistence/typeorm/role.orm-entity';
import { UserCompanyOrmEntity } from './infrastructure/persistence/typeorm/user-company.orm-entity';
import { UserRoleOrmEntity } from './infrastructure/persistence/typeorm/user-role.orm-entity';
import { UserOrmEntity } from './infrastructure/persistence/typeorm/user.orm-entity';

/**
 * Módulo de autenticação — Fase 2 (entidades ORM + repositórios).
 *
 * Expõe `AUTH_REPOSITORY` e `USER_COMPANY_REPOSITORY` para os use cases de
 * login/sessão (Fases 3–5). Os use cases nunca tocam banco diretamente —
 * passam exclusivamente pelos repositórios.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserOrmEntity,
      UserCompanyOrmEntity,
      CompanyOrmEntity,
      RoleOrmEntity,
      PermissionOrmEntity,
      RolePermissionOrmEntity,
      UserRoleOrmEntity,
    ]),
  ],
  providers: [...authProviders, ...userCompanyProviders],
  exports: [AUTH_REPOSITORY, USER_COMPANY_REPOSITORY],
})
export class AuthModule {}
