// NestJS
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

// Types
import type { RolePermissionEntity } from '../../../domain/entities/role-permission.entity';
import type { RolePermissionRepository } from '../../../domain/repositories/role-permission.repository';

// TypeORM
import { RolePermissionOrmEntity } from './role-permission.orm-entity';

/**
 * Implementação TypeORM do `RolePermissionRepository`.
 *
 * Escopada por `company_id` — vínculos nunca vazam entre empresas (ADR 0004).
 * A duplicidade é impedida pelo unique `(company_id, role_id, permission_id)`.
 */
@Injectable()
export class RolePermissionTypeormRepository implements RolePermissionRepository {
  constructor(
    @InjectRepository(RolePermissionOrmEntity)
    private readonly rolePermissionRepo: Repository<RolePermissionOrmEntity>,
  ) {}

  /**
   * Associa uma permissão do catálogo global a um cargo da empresa.
   *
   * @param companyId Empresa da sessão.
   * @param roleId Cargo.
   * @param permissionId Permissão (catálogo global).
   * @returns Promise resolvida quando o vínculo é gravado.
   */
  public async associate(
    companyId: string,
    roleId: string,
    permissionId: string,
  ): Promise<void> {
    const orm = this.rolePermissionRepo.create({
      companyId,
      roleId,
      permissionId,
    });
    await this.rolePermissionRepo.save(orm);
  }

  /**
   * Remove um vínculo cargo ↔ permissão da empresa.
   *
   * @param companyId Empresa da sessão.
   * @param roleId Cargo.
   * @param permissionId Permissão.
   * @returns `true` quando um vínculo foi removido.
   */
  public async remove(
    companyId: string,
    roleId: string,
    permissionId: string,
  ): Promise<boolean> {
    const result = await this.rolePermissionRepo.delete({
      companyId,
      roleId,
      permissionId,
    });
    return (result.affected ?? 0) > 0;
  }

  /**
   * Lista as permissões vinculadas a um cargo da empresa (com a permissão).
   *
   * @param roleId Cargo.
   * @param companyId Empresa da sessão.
   * @returns Vínculos ordenados por código da permissão.
   */
  public async listByRoleIdAndCompanyId(
    roleId: string,
    companyId: string,
  ): Promise<RolePermissionEntity[]> {
    const rows = await this.rolePermissionRepo.find({
      where: { roleId, companyId },
      relations: { permission: true },
    });

    return rows
      .map((row) => this.toDomain(row))
      .sort((a, b) => a.permission.code.localeCompare(b.permission.code));
  }

  /**
   * Verifica se um vínculo existe na empresa.
   *
   * @param companyId Empresa da sessão.
   * @param roleId Cargo.
   * @param permissionId Permissão.
   * @returns `true` quando o vínculo existe.
   */
  public async exists(
    companyId: string,
    roleId: string,
    permissionId: string,
  ): Promise<boolean> {
    const found = await this.rolePermissionRepo.findOne({
      where: { companyId, roleId, permissionId },
      select: { id: true },
    });
    return found !== null;
  }

  /**
   * Mapeia a ORM entity para a entidade de domínio.
   *
   * @param orm Registro ORM.
   * @returns Vínculo de domínio.
   */
  private toDomain(orm: RolePermissionOrmEntity): RolePermissionEntity {
    return {
      id: orm.id,
      companyId: orm.companyId,
      roleId: orm.roleId,
      permissionId: orm.permissionId,
      permission: {
        id: orm.permission?.id ?? '',
        code: orm.permission?.code ?? '',
        description: orm.permission?.description ?? null,
      },
    };
  }
}
