// NestJS
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';

// Types
import type { EntranceEntity } from '../../../domain/entities/entrance.entity';
import type {
  CreateEntranceRepositoryData,
  EntranceRepository,
  ListEntrancesRepositoryFilters,
  UpdateEntranceRepositoryData,
} from '../../../domain/repositories/entrance.repository';

// TypeORM
import { EntranceOrmEntity } from './entrance.orm-entity';

/**
 * Implementação TypeORM do `EntranceRepository`.
 *
 * Todas as operações são escopadas por `company_id` (sufixo `AndCompanyId`) —
 * portarias nunca vazam entre empresas (ADR 0002/0006).
 */
@Injectable()
export class EntrancesTypeormRepository implements EntranceRepository {
  constructor(
    @InjectRepository(EntranceOrmEntity)
    private readonly entranceRepo: Repository<EntranceOrmEntity>,
  ) {}

  /**
   * Busca uma portaria por id dentro da empresa.
   *
   * @param id Id da portaria.
   * @param companyId Empresa da sessão.
   * @returns Portaria da empresa ou `null` se não existir/não pertencer.
   */
  public async findByIdAndCompanyId(
    id: string,
    companyId: string,
  ): Promise<EntranceEntity | null> {
    const orm = await this.entranceRepo.findOne({ where: { id, companyId } });
    return orm ? this.toDomain(orm) : null;
  }

  /**
   * Lista portarias da empresa com paginação, busca por nome e filtro de
   * estado.
   *
   * @param companyId Empresa da sessão.
   * @param filters Filtros e paginação.
   * @returns Dados da página e total sem paginação.
   */
  public async list(
    companyId: string,
    filters: ListEntrancesRepositoryFilters,
  ): Promise<{ data: EntranceEntity[]; count: number }> {
    const where: FindOptionsWhere<EntranceOrmEntity> = { companyId };
    if (filters.search) {
      where.name = ILike(`%${filters.search}%`);
    }
    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const [rows, count] = await this.entranceRepo.findAndCount({
      where,
      order: { name: 'ASC' },
      take: filters.limit,
      skip: filters.offset,
    });

    return { data: rows.map((row) => this.toDomain(row)), count };
  }

  /**
   * Cria uma portaria na empresa.
   *
   * @param data Dados de criação (inclui `companyId`).
   * @returns Portaria criada.
   */
  public async create(
    data: CreateEntranceRepositoryData,
  ): Promise<EntranceEntity> {
    const orm = this.entranceRepo.create({
      companyId: data.companyId,
      name: data.name,
    });
    const saved = await this.entranceRepo.save(orm);
    return this.toDomain(saved);
  }

  /**
   * Atualiza uma portaria da empresa (nome).
   *
   * @param id Id da portaria.
   * @param companyId Empresa da sessão.
   * @param data Campos a atualizar.
   * @returns Portaria atualizada ou `null` se não existir/não pertencer.
   */
  public async updateByIdAndCompanyId(
    id: string,
    companyId: string,
    data: UpdateEntranceRepositoryData,
  ): Promise<EntranceEntity | null> {
    const orm = await this.entranceRepo.findOne({ where: { id, companyId } });
    if (!orm) {
      return null;
    }

    if (data.name !== undefined) {
      orm.name = data.name;
    }
    if (data.isActive !== undefined) {
      orm.isActive = data.isActive;
    }

    const saved = await this.entranceRepo.save(orm);
    return this.toDomain(saved);
  }

  /**
   * Desativa uma portaria da empresa (soft: `is_active = false`).
   *
   * @param id Id da portaria.
   * @param companyId Empresa da sessão.
   * @returns Portaria desativada ou `null` se não existir/não pertencer.
   */
  public async deactivateByIdAndCompanyId(
    id: string,
    companyId: string,
  ): Promise<EntranceEntity | null> {
    const orm = await this.entranceRepo.findOne({ where: { id, companyId } });
    if (!orm) {
      return null;
    }

    orm.isActive = false;
    const saved = await this.entranceRepo.save(orm);
    return this.toDomain(saved);
  }

  /**
   * Mapeia a ORM entity para a entidade de domínio.
   *
   * @param orm Registro ORM.
   * @returns Portaria de domínio.
   */
  private toDomain(orm: EntranceOrmEntity): EntranceEntity {
    return {
      id: orm.id,
      companyId: orm.companyId,
      name: orm.name,
      isActive: orm.isActive,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    };
  }
}
