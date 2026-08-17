// NestJS
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';

// Types
import type { RoleEntity } from '../../../domain/entities/role.entity';
import type {
  CreateRoleRepositoryData,
  ListRolesRepositoryFilters,
  RoleRepository,
  UpdateRoleRepositoryData,
} from '../../../domain/repositories/role.repository';

// TypeORM
import { RoleOrmEntity } from './role.orm-entity';
import { RolePermissionOrmEntity } from './role-permission.orm-entity';
import { UserRoleOrmEntity } from './user-role.orm-entity';

/**
 * Implementação TypeORM do `RoleRepository`.
 *
 * Todas as operações são escopadas por `company_id` (sufixo `AndCompanyId`) —
 * cargos nunca vazam entre empresas (ADR 0002/0004).
 */
@Injectable()
export class RolesTypeormRepository implements RoleRepository {
  constructor(
    @InjectRepository(RoleOrmEntity)
    private readonly roleRepo: Repository<RoleOrmEntity>,
  ) {}

  /**
   * Busca um cargo por id dentro da empresa.
   *
   * @param id Id do cargo.
   * @param companyId Empresa da sessão.
   * @returns Cargo da empresa ou `null` se não existir/não pertencer.
   */
  public async findByIdAndCompanyId(
    id: string,
    companyId: string,
  ): Promise<RoleEntity | null> {
    const orm = await this.roleRepo.findOne({ where: { id, companyId } });
    return orm ? this.toDomain(orm) : null;
  }

  /**
   * Lista cargos da empresa com paginação, busca por nome e filtro por status.
   *
   * @param companyId Empresa da sessão.
   * @param filters Filtros e paginação.
   * @returns Dados da página e total sem paginação.
   */
  public async list(
    companyId: string,
    filters: ListRolesRepositoryFilters,
  ): Promise<{ data: RoleEntity[]; count: number }> {
    const where: FindOptionsWhere<RoleOrmEntity> = { companyId };
    if (filters.search) {
      where.name = ILike(`%${filters.search}%`);
    }
    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const [rows, count] = await this.roleRepo.findAndCount({
      where,
      order: { name: 'ASC' },
      take: filters.limit,
      skip: filters.offset,
    });

    return { data: rows.map((row) => this.toDomain(row)), count };
  }

  /**
   * Cria um cargo na empresa.
   *
   * @param data Dados de criação (inclui `companyId`).
   * @returns Cargo criado.
   */
  public async create(data: CreateRoleRepositoryData): Promise<RoleEntity> {
    const orm = this.roleRepo.create({
      companyId: data.companyId,
      name: data.name,
      description: data.description,
      isAdmin: data.isAdmin,
    });
    const saved = await this.roleRepo.save(orm);
    return this.toDomain(saved);
  }

  /**
   * Atualiza um cargo da empresa (nome/descrição/isActive).
   *
   * @param id Id do cargo.
   * @param companyId Empresa da sessão.
   * @param data Campos a atualizar.
   * @returns Cargo atualizado ou `null` se não existir/não pertencer.
   */
  public async updateByIdAndCompanyId(
    id: string,
    companyId: string,
    data: UpdateRoleRepositoryData,
  ): Promise<RoleEntity | null> {
    const orm = await this.roleRepo.findOne({ where: { id, companyId } });
    if (!orm) {
      return null;
    }

    if (data.name !== undefined) {
      orm.name = data.name;
    }
    if (data.description !== undefined) {
      orm.description = data.description;
    }
    if (data.isActive !== undefined) {
      orm.isActive = data.isActive;
    }

    const saved = await this.roleRepo.save(orm);
    return this.toDomain(saved);
  }

  /**
   * Exclui fisicamente um cargo da empresa, em **cascata** (ADR 0004 §5): numa
   * única transação remove os vínculos em `role_permission`, desvincula os
   * usuários (`user_role`) e exclui o cargo. A exclusão é irreversível.
   *
   * @param id Id do cargo.
   * @param companyId Empresa da sessão.
   * @returns Snapshot do cargo excluído ou `null` se não existir/não pertencer.
   */
  public async deleteByIdAndCompanyId(
    id: string,
    companyId: string,
  ): Promise<RoleEntity | null> {
    const orm = await this.roleRepo.findOne({ where: { id, companyId } });
    if (!orm) {
      return null;
    }

    await this.roleRepo.manager.transaction(async (manager) => {
      await manager.delete(RolePermissionOrmEntity, { roleId: id, companyId });
      await manager.delete(UserRoleOrmEntity, { roleId: id, companyId });
      await manager.delete(RoleOrmEntity, { id, companyId });
    });

    return this.toDomain(orm);
  }

  /**
   * Mapeia a ORM entity para a entidade de domínio.
   *
   * @param orm Registro ORM.
   * @returns Cargo de domínio.
   */
  private toDomain(orm: RoleOrmEntity): RoleEntity {
    return {
      id: orm.id,
      companyId: orm.companyId,
      name: orm.name,
      description: orm.description,
      isAdmin: orm.isAdmin,
      isActive: orm.isActive,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    };
  }
}
