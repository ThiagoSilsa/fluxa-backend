// NestJS
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

// Shared
import { PermissionCode } from '../../../../../shared/constants/access-control.constant';

// Types
import type { AuthUserEntity } from '../../../domain/entities/auth-user.entity';
import type { AuthRepository } from '../../../domain/repositories/auth.repository';

// TypeORM
import { UserCompanyOrmEntity } from './user-company.orm-entity';
import { UserOrmEntity } from './user.orm-entity';
import { RolePermissionOrmEntity } from '../../../../../features/roles/infrastructure/persistence/typeorm/role-permission.orm-entity';
import { UserRoleOrmEntity } from '../../../../../features/roles/infrastructure/persistence/typeorm/user-role.orm-entity';

/**
 * Implementação TypeORM do `AuthRepository`.
 *
 * Todas as resoluções são escopadas por `(user_id, company_id)` — o
 * `companyId` da sessão (ADR 0002) garante que papéis/permissões não vazem
 * entre empresas.
 */
@Injectable()
export class AuthTypeormRepository implements AuthRepository {
  constructor(
    @InjectRepository(UserOrmEntity)
    private readonly userRepo: Repository<UserOrmEntity>,
    @InjectRepository(UserCompanyOrmEntity)
    private readonly userCompanyRepo: Repository<UserCompanyOrmEntity>,
    @InjectRepository(UserRoleOrmEntity)
    private readonly userRoleRepo: Repository<UserRoleOrmEntity>,
    @InjectRepository(RolePermissionOrmEntity)
    private readonly rolePermissionRepo: Repository<RolePermissionOrmEntity>,
  ) {}

  /**
   * Busca os candidatos de autenticação de um e-mail — uma entrada por vínculo
   * pessoa ↔ empresa (não por pessoa).
   *
   * @param email E-mail da pessoa (identidade global).
   * @returns Candidatos (1 por vínculo), incluindo empresa e vínculo.
   */
  public async findUsersByEmail(email: string): Promise<AuthUserEntity[]> {
    const users = await this.userRepo.find({
      where: { email },
      relations: { companies: { company: true } },
    });

    const candidates: AuthUserEntity[] = [];
    for (const user of users) {
      for (const link of user.companies ?? []) {
        candidates.push(this.toDomain(user, link));
      }
    }
    return candidates;
  }

  /**
   * Revalida o vínculo pessoa+empresa (usado pelo guard a cada requisição).
   *
   * @param userId Id da pessoa.
   * @param companyId Id da empresa da sessão.
   * @returns Candidato se o vínculo existir; `null` caso contrário.
   */
  public async findUserInCompany(
    userId: string,
    companyId: string,
  ): Promise<AuthUserEntity | null> {
    const link = await this.userCompanyRepo.findOne({
      where: { userId, companyId },
      relations: { user: true, company: true },
    });
    if (!link) {
      return null;
    }
    return this.toDomain(link.user, link);
  }

  /**
   * Códigos dos cargos ativos da pessoa na empresa.
   *
   * @param userId Id da pessoa.
   * @param companyId Id da empresa.
   * @returns Códigos de cargos ativos (ex.: `Administração`, `Porteiro`).
   */
  public async findRoleCodesByUserIdAndCompanyId(
    userId: string,
    companyId: string,
  ): Promise<string[]> {
    const userRoles = await this.userRoleRepo.find({
      where: { userId, companyId },
      relations: { role: true },
    });
    return userRoles
      .filter((userRole) => userRole.role?.isActive === true)
      .map((userRole) => userRole.role.name);
  }

  /**
   * Permissões efetivas da pessoa na empresa (via cargos → role_permission).
   *
   * @param userId Id da pessoa.
   * @param companyId Id da empresa.
   * @returns Códigos de permissão (ex.: `REGISTER_ENTRY`).
   */
  public async findPermissionsByUserIdAndCompanyId(
    userId: string,
    companyId: string,
  ): Promise<PermissionCode[]> {
    const userRoles = await this.userRoleRepo.find({
      where: { userId, companyId },
      relations: { role: true },
    });
    const activeRoleIds = userRoles
      .filter((userRole) => userRole.role?.isActive === true)
      .map((userRole) => userRole.roleId);

    if (activeRoleIds.length === 0) {
      return [];
    }

    const rolePermissions = await this.rolePermissionRepo.find({
      where: { companyId, roleId: In(activeRoleIds) },
      relations: { permission: true },
    });
    return rolePermissions
      .map((rp) => rp.permission?.code)
      .filter(
        (code): code is PermissionCode => code !== undefined && code !== null,
      );
  }

  /**
   * Se a pessoa tem cargo `is_admin` ativo na empresa da sessão.
   *
   * @param userId Id da pessoa.
   * @param companyId Id da empresa da sessão.
   * @returns `true` quando há cargo ativo com `is_admin = true`.
   */
  public async findHasAdminRoleByUserIdAndCompanyId(
    userId: string,
    companyId: string,
  ): Promise<boolean> {
    const userRoles = await this.userRoleRepo.find({
      where: { userId, companyId },
      relations: { role: true },
    });
    return userRoles.some(
      (userRole) =>
        userRole.role?.isActive === true && userRole.role.isAdmin === true,
    );
  }

  /**
   * Registra o momento do último login da pessoa (ADR 0003).
   *
   * @param userId Id da pessoa.
   * @returns Promise resolvida quando o registro é gravado.
   */
  public async updateLastLoginAt(userId: string): Promise<void> {
    await this.userRepo.update({ id: userId }, { lastLoginAt: new Date() });
  }

  /**
   * Mapeia ORM (user + vínculo + empresa) para a entidade de domínio.
   *
   * @param user Pessoa (ORM).
   * @param link Vínculo pessoa ↔ empresa (ORM).
   * @returns Candidato de autenticação.
   */
  private toDomain(
    user: UserOrmEntity,
    link: UserCompanyOrmEntity,
  ): AuthUserEntity {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      passwordHash: user.password,
      companyId: link.companyId,
      companyName: link.company?.name ?? '',
      companyIsActive: link.company?.isActive ?? false,
      type: link.type,
      isActive: link.isActive,
    };
  }
}
