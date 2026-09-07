// NestJS
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';

// Constants
import { BlockRequestStatus } from '../../../domain/constants/block.constant';

// Types
import type { BlockRequestEntity } from '../../../domain/entities/block-request.entity';
import type {
  BlockRequestRepository,
  CreateBlockRequestRepositoryData,
  ListBlockRequestsRepositoryFilters,
  UpdateBlockRequestStatusRepositoryData,
} from '../../../domain/repositories/block-request.repository';

// TypeORM
import { BlockRequestOrmEntity } from './block-request.orm-entity';

/**
 * Implementação TypeORM do `BlockRequestRepository`.
 *
 * Todas as operações são escopadas por `company_id`. O `status_history`
 * (jsonb) recebe append a cada transição (`[{status, at, by}]`).
 */
@Injectable()
export class BlockRequestsTypeormRepository implements BlockRequestRepository {
  constructor(
    @InjectRepository(BlockRequestOrmEntity)
    private readonly blockRequestRepo: Repository<BlockRequestOrmEntity>,
  ) {}

  /**
   * Busca uma solicitação por id dentro da empresa.
   *
   * @param id Id da solicitação.
   * @param companyId Empresa da sessão.
   * @returns Solicitação da empresa ou `null` se não existir/não pertencer.
   */
  public async findByIdAndCompanyId(
    id: string,
    companyId: string,
  ): Promise<BlockRequestEntity | null> {
    const orm = await this.blockRequestRepo.findOne({
      where: { id, companyId },
    });
    return orm ? this.toDomain(orm) : null;
  }

  /**
   * Busca a solicitação **pendente** da placa (unique parcial).
   *
   * @param plate Placa normalizada.
   * @param companyId Empresa da sessão.
   * @returns Solicitação pendente da placa ou `null`.
   */
  public async findPendingByPlateAndCompanyId(
    plate: string,
    companyId: string,
  ): Promise<BlockRequestEntity | null> {
    const orm = await this.blockRequestRepo.findOne({
      where: { plate, companyId, status: BlockRequestStatus.PENDING },
    });
    return orm ? this.toDomain(orm) : null;
  }

  /**
   * Lista solicitações da empresa com paginação e filtros.
   *
   * @param companyId Empresa da sessão.
   * @param filters Filtros e paginação.
   * @returns Dados da página e total sem paginação.
   */
  public async list(
    companyId: string,
    filters: ListBlockRequestsRepositoryFilters,
  ): Promise<{ data: BlockRequestEntity[]; count: number }> {
    const where: FindOptionsWhere<BlockRequestOrmEntity> = { companyId };
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.requestedBy) {
      where.requestedBy = filters.requestedBy;
    }

    const [rows, count] = await this.blockRequestRepo.findAndCount({
      where,
      order: { requestedAt: 'DESC' },
      take: filters.limit,
      skip: filters.offset,
    });

    return { data: rows.map((row) => this.toDomain(row)), count };
  }

  /**
   * Cria uma solicitação (`PENDING`) na empresa, com o `status_history`
   * inicial `[{status: PENDING, at, by}]`.
   *
   * @param data Dados de criação.
   * @returns Solicitação criada.
   */
  public async create(
    data: CreateBlockRequestRepositoryData,
  ): Promise<BlockRequestEntity> {
    const orm = this.blockRequestRepo.create({
      companyId: data.companyId,
      vehicleId: data.vehicleId,
      plate: data.plate,
      reason: data.reason,
      requestedBy: data.requestedBy,
      requestedAt: new Date(),
      syncStatus: data.syncStatus,
      idempotencyKey: data.idempotencyKey,
      statusHistory: [
        {
          status: BlockRequestStatus.PENDING,
          at: new Date(),
          by: data.requestedBy,
        },
      ],
    });
    const saved = await this.blockRequestRepo.save(orm);
    return this.toDomain(saved);
  }

  /**
   * Transiciona o status de uma solicitação (append no `status_history`).
   *
   * @param id Id da solicitação.
   * @param companyId Empresa da sessão.
   * @param data Novos status/campos de avaliação.
   * @returns Solicitação atualizada ou `null` se não existir/não pertencer.
   */
  public async updateStatusByIdAndCompanyId(
    id: string,
    companyId: string,
    data: UpdateBlockRequestStatusRepositoryData,
  ): Promise<BlockRequestEntity | null> {
    const orm = await this.blockRequestRepo.findOne({
      where: { id, companyId },
    });
    if (!orm) {
      return null;
    }

    orm.status = data.status;
    if (data.handledBy !== undefined) {
      orm.handledBy = data.handledBy;
    }
    if (
      data.handledBy !== undefined ||
      data.status !== BlockRequestStatus.PENDING
    ) {
      orm.handledAt = new Date();
    }
    if (data.observation !== undefined) {
      orm.observation = data.observation;
    }
    if (data.resolvedBlockId !== undefined) {
      orm.resolvedBlockId = data.resolvedBlockId;
    }

    const history = Array.isArray(orm.statusHistory) ? orm.statusHistory : [];
    orm.statusHistory = [
      ...history,
      {
        status: data.status,
        at: new Date(),
        by: data.handledBy ?? orm.requestedBy,
      },
    ];

    const saved = await this.blockRequestRepo.save(orm);
    return this.toDomain(saved);
  }

  /**
   * Mapeia a ORM entity para a entidade de domínio.
   *
   * @param orm Registro TypeORM.
   * @returns Solicitação de domínio.
   */
  private toDomain(orm: BlockRequestOrmEntity): BlockRequestEntity {
    return {
      id: orm.id,
      companyId: orm.companyId,
      vehicleId: orm.vehicleId,
      plate: orm.plate,
      reason: orm.reason,
      status: orm.status,
      requestedBy: orm.requestedBy,
      requestedAt: orm.requestedAt,
      handledBy: orm.handledBy,
      handledAt: orm.handledAt,
      observation: orm.observation,
      statusHistory: orm.statusHistory,
      resolvedBlockId: orm.resolvedBlockId,
      syncStatus: orm.syncStatus,
      idempotencyKey: orm.idempotencyKey,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    };
  }
}
