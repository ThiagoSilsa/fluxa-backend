// NestJS
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, In, Repository } from 'typeorm';

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
import { VehicleDepartmentOrmEntity } from '../../../../vehicles/infrastructure/persistence/typeorm/vehicle-department.orm-entity';

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
   * Busca departamentos da empresa cujos nomes estão na lista (exato) —
   * usado pelo importador para detectar duplicados (ADR 0007 §8).
   *
   * @param names Nomes a buscar (exatos).
   * @param companyId Empresa da sessão.
   * @returns Departamentos encontrados com um dos nomes.
   */
  public async findByNamesAndCompanyId(
    names: string[],
    companyId: string,
  ): Promise<DepartmentEntity[]> {
    if (names.length === 0) {
      return [];
    }

    const rows = await this.departmentRepo.find({
      where: { companyId, name: In(names) },
    });

    return rows.map((row) => this.toDomain(row));
  }

  /**
   * Insere vários departamentos em lote (chunks de 500 — ADR 0007 §8).
   *
   * @param data Lista de dados de criação (inclui `companyId`).
   * @returns Departamentos criados.
   */
  public async createBatch(
    data: CreateDepartmentRepositoryData[],
  ): Promise<DepartmentEntity[]> {
    if (data.length === 0) {
      return [];
    }

    const entities = data.map((item) =>
      this.departmentRepo.create({
        companyId: item.companyId,
        name: item.name,
        description: item.description,
        parkingSpace: item.parkingSpace,
      }),
    );

    const saved = await this.departmentRepo.save(entities);
    return saved.map((row) => this.toDomain(row));
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
   * Conta vínculos `vehicle_department` da empresa que referenciam um
   * departamento.
   *
   * @param departmentId Id do departamento.
   * @param companyId Empresa da sessão.
   * @returns Quantidade de vínculos que referenciam o departamento.
   */
  public async countVehicleDepartmentsByDepartmentIdAndCompanyId(
    departmentId: string,
    companyId: string,
  ): Promise<number> {
    return this.departmentRepo.manager.count(VehicleDepartmentOrmEntity, {
      where: { departmentId, companyId },
    });
  }

  /**
   * Exclui fisicamente um departamento da empresa.
   *
   * @param id Id do departamento.
   * @param companyId Empresa da sessão.
   * @returns Departamento excluído ou `null` se não existir/não pertencer.
   */
  public async deleteByIdAndCompanyId(
    id: string,
    companyId: string,
  ): Promise<DepartmentEntity | null> {
    const orm = await this.departmentRepo.findOne({ where: { id, companyId } });
    if (!orm) {
      return null;
    }

    const domain = this.toDomain(orm);
    await this.departmentRepo.delete({ id, companyId });
    return domain;
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
