// NestJS
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';

// Constants
import { VehicleBlockStatus } from '../../../domain/constants/block.constant';

// Types
import type { VehicleBlockEntity } from '../../../domain/entities/vehicle-block.entity';
import type {
  CreateVehicleBlockRepositoryData,
  ListVehicleBlocksRepositoryFilters,
  RevokeVehicleBlockRepositoryData,
  VehicleBlockRepository,
} from '../../../domain/repositories/vehicle-block.repository';

// TypeORM
import { VehicleBlockOrmEntity } from './vehicle-block.orm-entity';
import { VehicleOrmEntity } from '../../../../vehicles/infrastructure/persistence/typeorm/vehicle.orm-entity';

/**
 * Implementação TypeORM do `VehicleBlockRepository`.
 *
 * **Dono da coluna derivada `vehicle.is_blocked`** (ADR 0010 §2): as escritas
 * que mudam o estado de bloqueio (create/revoke) e o vínculo por placa rodam
 * em **transação** com a atualização do veículo. Bloqueio por placa de
 * veículo não cadastrado é vinculado **preguiçosamente** ao resolver a placa
 * (regra 19 — vincula, não revoga).
 */
@Injectable()
export class VehicleBlocksTypeormRepository implements VehicleBlockRepository {
  constructor(
    @InjectRepository(VehicleBlockOrmEntity)
    private readonly vehicleBlockRepo: Repository<VehicleBlockOrmEntity>,
  ) {}

  /**
   * Busca um bloqueio por id dentro da empresa.
   *
   * @param id Id do bloqueio.
   * @param companyId Empresa da sessão.
   * @returns Bloqueio da empresa ou `null` se não existir/não pertencer.
   */
  public async findByIdAndCompanyId(
    id: string,
    companyId: string,
  ): Promise<VehicleBlockEntity | null> {
    const orm = await this.vehicleBlockRepo.findOne({
      where: { id, companyId },
    });
    return orm ? this.toDomain(orm) : null;
  }

  /**
   * Busca o bloqueio **ativo** do veículo cadastrado (unique parcial).
   *
   * @param vehicleId Id do veículo.
   * @param companyId Empresa da sessão.
   * @returns Bloqueio ativo do veículo ou `null`.
   */
  public async findActiveByVehicleIdAndCompanyId(
    vehicleId: string,
    companyId: string,
  ): Promise<VehicleBlockEntity | null> {
    const orm = await this.vehicleBlockRepo.findOne({
      where: { vehicleId, companyId, status: VehicleBlockStatus.ACTIVE },
    });
    return orm ? this.toDomain(orm) : null;
  }

  /**
   * Busca o bloqueio **ativo** pela placa e, se o veículo já estiver
   * cadastrado, **vincula o bloqueio pela placa** em transação (regra 19 —
   * preenche `vehicle_id` + `is_blocked`, sem revogar).
   *
   * @param plate Placa normalizada.
   * @param companyId Empresa da sessão.
   * @returns Bloqueio ativo (resolvido/linkado) ou `null`.
   */
  public async findActiveByPlateAndCompanyId(
    plate: string,
    companyId: string,
  ): Promise<VehicleBlockEntity | null> {
    return this.vehicleBlockRepo.manager.transaction(async (manager) => {
      const orm = await manager.findOne(VehicleBlockOrmEntity, {
        where: { plate, companyId, status: VehicleBlockStatus.ACTIVE },
        order: { vehicleId: 'DESC' },
      });
      if (!orm) {
        return null;
      }

      // Vínculo preguiçoso: bloqueio por placa de veículo não cadastrado +
      // veículo agora cadastrado → vincula (regra 19).
      if (!orm.vehicleId) {
        const vehicle = await manager.findOne(VehicleOrmEntity, {
          where: { plate, companyId },
        });
        if (vehicle) {
          orm.vehicleId = vehicle.id;
          await manager.save(orm);
          vehicle.isBlocked = true;
          await manager.save(vehicle);
        }
      }

      return this.toDomain(orm);
    });
  }

  /**
   * Lista bloqueios da empresa com paginação e filtro de status/placa.
   *
   * @param companyId Empresa da sessão.
   * @param filters Filtros e paginação.
   * @returns Dados da página e total sem paginação.
   */
  public async list(
    companyId: string,
    filters: ListVehicleBlocksRepositoryFilters,
  ): Promise<{ data: VehicleBlockEntity[]; count: number }> {
    const where: FindOptionsWhere<VehicleBlockOrmEntity> = { companyId };
    if (filters.search) {
      where.plate = ILike(`%${filters.search}%`);
    }
    if (filters.status) {
      where.status = filters.status;
    }

    const [rows, count] = await this.vehicleBlockRepo.findAndCount({
      where,
      order: { blockedAt: 'DESC' },
      take: filters.limit,
      skip: filters.offset,
    });

    return { data: rows.map((row) => this.toDomain(row)), count };
  }

  /**
   * Cria um bloqueio ativo e, se houver veículo vinculado, seta
   * `vehicle.is_blocked = true` **na mesma transação** (ADR 0010 §2).
   *
   * @param data Dados de criação.
   * @returns Bloqueio criado.
   */
  public async create(
    data: CreateVehicleBlockRepositoryData,
  ): Promise<VehicleBlockEntity> {
    return this.vehicleBlockRepo.manager.transaction(async (manager) => {
      const orm = manager.create(VehicleBlockOrmEntity, {
        companyId: data.companyId,
        vehicleId: data.vehicleId,
        plate: data.plate,
        blockType: data.blockType,
        reason: data.reason,
        blockedBy: data.blockedBy,
        blockedAt: new Date(),
      });
      const saved = await manager.save(orm);

      if (data.vehicleId) {
        await manager.update(
          VehicleOrmEntity,
          { id: data.vehicleId, companyId: data.companyId },
          { isBlocked: true },
        );
      }

      return this.toDomain(saved);
    });
  }

  /**
   * Revoga um bloqueio ativo (`ACTIVE → REVOKED` + motivo) e recalcula
   * `vehicle.is_blocked` (false se não restar bloqueio ativo) **na mesma
   * transação** (ADR 0010 §2).
   *
   * @param id Id do bloqueio.
   * @param companyId Empresa da sessão.
   * @param data Dados de revogação.
   * @returns Bloqueio revogado ou `null` se não existir/não pertencer.
   */
  public async revokeByIdAndCompanyId(
    id: string,
    companyId: string,
    data: RevokeVehicleBlockRepositoryData,
  ): Promise<VehicleBlockEntity | null> {
    return this.vehicleBlockRepo.manager.transaction(async (manager) => {
      const orm = await manager.findOne(VehicleBlockOrmEntity, {
        where: { id, companyId },
      });
      if (!orm) {
        return null;
      }

      orm.status = VehicleBlockStatus.REVOKED;
      orm.revokedBy = data.revokedBy;
      orm.revokedAt = new Date();
      orm.revokedReason = data.revokedReason;
      const saved = await manager.save(orm);

      if (orm.vehicleId) {
        const stillBlocked = await manager.findOne(VehicleBlockOrmEntity, {
          where: {
            vehicleId: orm.vehicleId,
            companyId,
            status: VehicleBlockStatus.ACTIVE,
          },
        });
        if (!stillBlocked) {
          await manager.update(
            VehicleOrmEntity,
            { id: orm.vehicleId, companyId },
            { isBlocked: false },
          );
        }
      }

      return this.toDomain(saved);
    });
  }

  /**
   * Mapeia a ORM entity para a entidade de domínio.
   *
   * @param orm Registro TypeORM.
   * @returns Bloqueio de domínio.
   */
  private toDomain(orm: VehicleBlockOrmEntity): VehicleBlockEntity {
    return {
      id: orm.id,
      companyId: orm.companyId,
      vehicleId: orm.vehicleId,
      plate: orm.plate,
      blockType: orm.blockType,
      reason: orm.reason,
      status: orm.status,
      blockedBy: orm.blockedBy,
      blockedAt: orm.blockedAt,
      revokedBy: orm.revokedBy,
      revokedAt: orm.revokedAt,
      revokedReason: orm.revokedReason,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    };
  }
}
