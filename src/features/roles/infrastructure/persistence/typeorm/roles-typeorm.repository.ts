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
   * Lista cargos da empresa com paginação e busca por nome.
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
   * Atualiza um cargo da empresa (nome/descrição).
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

    const saved = await this.roleRepo.save(orm);
    return this.toDomain(saved);
  }

  /**
   * Desativa um cargo da empresa (soft: `is_active = false`).
   *
   * @param id Id do cargo.
   * @param companyId Empresa da sessão.
   * @returns Cargo desativado ou `null` se não existir/não pertencer.
   */
  public async deactivateByIdAndCompanyId(
    id: string,
    companyId: string,
  ): Promise<RoleEntity | null> {
    const orm = await this.roleRepo.findOne({ where: { id, companyId } });
    if (!orm) {
      return null;
    }

    orm.isActive = false;
    const saved = await this.roleRepo.save(orm);
    return this.toDomain(saved);
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
