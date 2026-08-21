// NestJS
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';

// Constants
import { AccessRequestStatus } from '../../../domain/constants/access-request.constant';

// Types
import type { AccessRequestEntity } from '../../../domain/entities/access-request.entity';
import type {
  AccessRequestRepository,
  CreateAccessRequestRepositoryData,
  ListAccessRequestsRepositoryFilters,
  UpdateAccessRequestStatusRepositoryData,
} from '../../../domain/repositories/access-request.repository';

// TypeORM
import { AccessRequestOrmEntity } from './access-request.orm-entity';

/**
 * Implementação TypeORM do `AccessRequestRepository`.
 *
 * Todas as operações são escopadas por `company_id`. O `status_history`
 * (jsonb) recebe append a cada transição `[{status, at, by}]`.
 */
@Injectable()
export class AccessRequestsTypeormRepository implements AccessRequestRepository {
  constructor(
    @InjectRepository(AccessRequestOrmEntity)
    private readonly accessRequestRepo: Repository<AccessRequestOrmEntity>,
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
  ): Promise<AccessRequestEntity | null> {
    const orm = await this.accessRequestRepo.findOne({
      where: { id, companyId },
    });
    return orm ? this.toDomain(orm) : null;
  }

  /**
   * Busca a solicitação **aberta** da placa (`PENDING`/`IN_CONTACT` — unique
   * parcial), para duplicidade.
   *
   * @param plate Placa normalizada.
   * @param companyId Empresa da sessão.
   * @returns Solicitação aberta da placa ou `null`.
   */
  public async findOpenByPlateAndCompanyId(
    plate: string,
    companyId: string,
  ): Promise<AccessRequestEntity | null> {
    const orm = await this.accessRequestRepo.findOne({
      where: [
        { plate, companyId, status: AccessRequestStatus.PENDING },
        { plate, companyId, status: AccessRequestStatus.IN_CONTACT },
      ],
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
    filters: ListAccessRequestsRepositoryFilters,
  ): Promise<{ data: AccessRequestEntity[]; count: number }> {
    const where: FindOptionsWhere<AccessRequestOrmEntity> = { companyId };
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.plate) {
      where.plate = ILike(`%${filters.plate}%`);
    }

    const [rows, count] = await this.accessRequestRepo.findAndCount({
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
    data: CreateAccessRequestRepositoryData,
  ): Promise<AccessRequestEntity> {
    const orm = this.accessRequestRepo.create({
      companyId: data.companyId,
      idempotencyKey: data.idempotencyKey,
      type: data.type,
      plate: data.plate,
      vehicleId: data.vehicleId,
      userId: data.userId,
      requestedBy: data.requestedBy,
      requestedAt: new Date(),
      contactChannel: data.contactChannel,
      contactPhone: data.contactPhone,
      departmentId: data.departmentId,
      payload: data.payload,
      statusHistory: [
        {
          status: AccessRequestStatus.PENDING,
          at: new Date(),
          by: data.requestedBy,
        },
      ],
    });
    const saved = await this.accessRequestRepo.save(orm);
    return this.toDomain(saved);
  }

  /**
   * Transiciona o status de uma solicitação (append no `status_history`) e
   * aplica os campos opcionais de resolução/aceite quando informados.
   *
   * @param id Id da solicitação.
   * @param companyId Empresa da sessão.
   * @param data Novo status e campos de avaliação/resolução.
   * @returns Solicitação atualizada ou `null` se não existir/não pertencer.
   */
  public async updateStatusByIdAndCompanyId(
    id: string,
    companyId: string,
    data: UpdateAccessRequestStatusRepositoryData,
  ): Promise<AccessRequestEntity | null> {
    const orm = await this.accessRequestRepo.findOne({
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
      data.status !== AccessRequestStatus.PENDING
    ) {
      orm.handledAt = new Date();
    }
    if (data.observation !== undefined) {
      orm.observation = data.observation;
    }
    if (data.resolvedUserId !== undefined) {
      orm.resolvedUserId = data.resolvedUserId;
    }
    if (data.resolvedVehicleId !== undefined) {
      orm.resolvedVehicleId = data.resolvedVehicleId;
    }
    if (data.entryAuthorized !== undefined) {
      orm.entryAuthorized = data.entryAuthorized;
      if (data.entryAuthorized) {
        orm.authorizedBy = data.authorizedBy ?? orm.authorizedBy;
        orm.authorizedAt = new Date();
      }
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

    const saved = await this.accessRequestRepo.save(orm);
    return this.toDomain(saved);
  }

  /**
   * Mapeia a ORM entity para a entidade de domínio.
   *
   * @param orm Registro TypeORM.
   * @returns Solicitação de domínio.
   */
  private toDomain(orm: AccessRequestOrmEntity): AccessRequestEntity {
    return {
      id: orm.id,
      companyId: orm.companyId,
      idempotencyKey: orm.idempotencyKey,
      type: orm.type,
      plate: orm.plate,
      vehicleId: orm.vehicleId,
      userId: orm.userId,
      status: orm.status,
      entryAuthorized: orm.entryAuthorized,
      authorizedBy: orm.authorizedBy,
      authorizedAt: orm.authorizedAt,
      requestedBy: orm.requestedBy,
      requestedAt: orm.requestedAt,
      handledBy: orm.handledBy,
      handledAt: orm.handledAt,
      contactChannel: orm.contactChannel,
      contactPhone: orm.contactPhone,
      departmentId: orm.departmentId,
      payload: orm.payload,
      statusHistory: orm.statusHistory,
      resolvedUserId: orm.resolvedUserId,
      resolvedVehicleId: orm.resolvedVehicleId,
      observation: orm.observation,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    };
  }
}
