// NestJS
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';

// Types
import type { DepartmentEntity } from '../../../domain/entities/department.entity';
import type {
  CreateDepartmentRepositoryData,
  DepartmentRepository,
  ListDepartmentsRepositoryFilters,
  UpdateDepartmentRepositoryData,
} from '../../../domain/repositories/department.repository';

// TypeORM
import { DepartmentOrmEntity } from './department.orm-entity';

/**
 * Implementação TypeORM do `DepartmentRepository`.
 *
 * Todas as operações são escopadas por `company_id` (sufixo `AndCompanyId`) —
 * departamentos nunca vazam entre empresas (ADR 0002/0006).
 */
@Injectable()
export class DepartmentsTypeormRepository implements DepartmentRepository {
  constructor(
    @InjectRepository(DepartmentOrmEntity)
    private readonly departmentRepo: Repository<DepartmentOrmEntity>,
  ) {}

  /**
   * Busca um departamento por id dentro da empresa.
   *
   * @param id Id do departamento.
   * @param companyId Empresa da sessão.
   * @returns Departamento da empresa ou `null` se não existir/não pertencer.
   */
  public async findByIdAndCompanyId(
    id: string,
    companyId: string,
  ): Promise<DepartmentEntity | null> {
    const orm = await this.departmentRepo.findOne({ where: { id, companyId } });
    return orm ? this.toDomain(orm) : null;
  }

  /**
   * Lista departamentos da empresa com paginação, busca por nome e filtro de
   * estado.
   *
   * @param companyId Empresa da sessão.
   * @param filters Filtros e paginação.
   * @returns Dados da página e total sem paginação.
   */
  public async list(
    companyId: string,
    filters: ListDepartmentsRepositoryFilters,
  ): Promise<{ data: DepartmentEntity[]; count: number }> {
    const where: FindOptionsWhere<DepartmentOrmEntity> = { companyId };
    if (filters.search) {
      where.name = ILike(`%${filters.search}%`);
    }
    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const [rows, count] = await this.departmentRepo.findAndCount({
      where,
      order: { name: 'ASC' },
      take: filters.limit,
      skip: filters.offset,
    });

    return { data: rows.map((row) => this.toDomain(row)), count };
  }

  /**
   * Cria um departamento na empresa.
   *
   * @param data Dados de criação (inclui `companyId`).
   * @returns Departamento criado.
   */
  public async create(
    data: CreateDepartmentRepositoryData,
  ): Promise<DepartmentEntity> {
    const orm = this.departmentRepo.create({
      companyId: data.companyId,
      name: data.name,
      description: data.description,
      parkingSpace: data.parkingSpace,
    });
    const saved = await this.departmentRepo.save(orm);
    return this.toDomain(saved);
  }

  /**
   * Atualiza um departamento da empresa (nome/descrição/vagas).
   *
   * @param id Id do departamento.
   * @param companyId Empresa da sessão.
   * @param data Campos a atualizar.
   * @returns Departamento atualizado ou `null` se não existir/não pertencer.
   */
  public async updateByIdAndCompanyId(
    id: string,
    companyId: string,
    data: UpdateDepartmentRepositoryData,
  ): Promise<DepartmentEntity | null> {
    const orm = await this.departmentRepo.findOne({ where: { id, companyId } });
    if (!orm) {
      return null;
    }

    if (data.name !== undefined) {
      orm.name = data.name;
    }
    if (data.description !== undefined) {
      orm.description = data.description;
    }
    if (data.parkingSpace !== undefined) {
      orm.parkingSpace = data.parkingSpace;
    }
    if (data.isActive !== undefined) {
      orm.isActive = data.isActive;
    }

    const saved = await this.departmentRepo.save(orm);
    return this.toDomain(saved);
  }

  /**
   * Desativa um departamento da empresa (soft: `is_active = false`).
   *
   * @param id Id do departamento.
   * @param companyId Empresa da sessão.
   * @returns Departamento desativado ou `null` se não existir/não pertencer.
   */
  public async deactivateByIdAndCompanyId(
    id: string,
    companyId: string,
  ): Promise<DepartmentEntity | null> {
    const orm = await this.departmentRepo.findOne({ where: { id, companyId } });
    if (!orm) {
      return null;
    }

    orm.isActive = false;
    const saved = await this.departmentRepo.save(orm);
    return this.toDomain(saved);
  }

  /**
   * Mapeia a ORM entity para a entidade de domínio.
   *
   * @param orm Registro ORM.
   * @returns Departamento de domínio.
   */
  private toDomain(orm: DepartmentOrmEntity): DepartmentEntity {
    return {
      id: orm.id,
      companyId: orm.companyId,
      name: orm.name,
      description: orm.description,
      parkingSpace: orm.parkingSpace,
      isActive: orm.isActive,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    };
  }
}
