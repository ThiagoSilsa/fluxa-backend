// NestJS
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

// Shared
import { JwtTokenSignUseCase } from '../../shared/security/jwt-token-sign.use-case';
import { JwtTokenVerifyUseCase } from '../../shared/security/jwt-token-verify.use-case';
import { PasswordHashUseCase } from '../../shared/security/password-hash.use-case';
import { PasswordVerifyUseCase } from '../../shared/security/password-verify.use-case';

// Use-cases
import { ListSessionCompaniesUseCase } from './application/use-cases/list-session-companies.use-case';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { ResolveAuthenticatedUserUseCase } from './application/use-cases/resolve-authenticated-user.use-case';
import { SwitchCompanyUseCase } from './application/use-cases/switch-company.use-case';
import { ValidateJwtPayloadUseCase } from './application/use-cases/validate-jwt-payload.use-case';
import { ValidateSessionUseCase } from './application/use-cases/validate-session.use-case';

// Repository
import { AUTH_REPOSITORY } from './domain/repositories/auth.repository';
import { USER_COMPANY_REPOSITORY } from './domain/repositories/user-company.repository';

// Infrastructure
import { SessionAuditListener } from './infrastructure/listeners/session-audit.listener';
import { authProviders } from './infrastructure/persistence/providers/auth.providers';
import { userCompanyProviders } from './infrastructure/persistence/providers/user-company.providers';
import { CompanyOrmEntity } from './infrastructure/persistence/typeorm/company.orm-entity';
import { UserCompanyOrmEntity } from './infrastructure/persistence/typeorm/user-company.orm-entity';
import { UserOrmEntity } from './infrastructure/persistence/typeorm/user.orm-entity';
import { PermissionOrmEntity } from '../roles/infrastructure/persistence/typeorm/permission.orm-entity';
import { RolePermissionOrmEntity } from '../roles/infrastructure/persistence/typeorm/role-permission.orm-entity';
import { RoleOrmEntity } from '../roles/infrastructure/persistence/typeorm/role.orm-entity';
import { UserRoleOrmEntity } from '../roles/infrastructure/persistence/typeorm/user-role.orm-entity';

// Presentation
import { AuthController } from './presentation/http/controllers/auth.controller';

/**
 * Módulo de autenticação — Fases 2 e 3 (entidades, repositórios, JWT, senha e
 * resolução do ator autenticado).
 *
 * Expõe os repositórios (`AUTH_REPOSITORY`, `USER_COMPANY_REPOSITORY`) e os
 * use cases de segurança/JWT para o guard e para os use cases de login/sessão
 * (Fases 4–5). `JwtModule` é global (qualquer guard/controller injeta
 * `JwtService`), com `JWT_SECRET`/`JWT_EXPIRES_IN`.
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
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        ({
          secret: config.get<string>('JWT_SECRET') ?? 'dev-secret-change-me',
          signOptions: {
            expiresIn: config.get<string>('JWT_EXPIRES_IN') ?? '28800s',
          },
        }) as JwtModuleOptions,
    }),
  ],
  providers: [
    ...authProviders,
    ...userCompanyProviders,
    ResolveAuthenticatedUserUseCase,
    ValidateJwtPayloadUseCase,
    LoginUseCase,
    ListSessionCompaniesUseCase,
    SwitchCompanyUseCase,
    ValidateSessionUseCase,
    JwtTokenSignUseCase,
    JwtTokenVerifyUseCase,
    PasswordHashUseCase,
    PasswordVerifyUseCase,
    SessionAuditListener,
  ],
  controllers: [AuthController],
  exports: [
    AUTH_REPOSITORY,
    USER_COMPANY_REPOSITORY,
    ResolveAuthenticatedUserUseCase,
    ValidateJwtPayloadUseCase,
    LoginUseCase,
    ListSessionCompaniesUseCase,
    SwitchCompanyUseCase,
    ValidateSessionUseCase,
    JwtTokenSignUseCase,
    JwtTokenVerifyUseCase,
    PasswordHashUseCase,
    PasswordVerifyUseCase,
  ],
})
export class AuthModule {}
