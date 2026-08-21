// NestJS
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';

// Node
import { randomUUID } from 'crypto';

// Constants
import {
  AccessStatus,
  MovementType,
} from '../../../domain/constants/access.constant';

// Types
import type { VehicleAccessEntity } from '../../../domain/entities/vehicle-access.entity';
import type { VehicleMovementEntity } from '../../../domain/entities/vehicle-movement.entity';
import type {
  CloseOpenAccessesRepositoryData,
  CreateEntryAccessRepositoryData,
  CreateNoExitRepositoryData,
  EntryResult,
  VehicleAccessRepository,
} from '../../../domain/repositories/vehicle-access.repository';

// TypeORM
import { VehicleAccessOrmEntity } from './vehicle-access.orm-entity';
import { VehicleMovementOrmEntity } from './vehicle-movement.orm-entity';

/**
 * Implementação TypeORM do `VehicleAccessRepository`.
 *
 * **Ledger consistente** (ADR 0010 §6): as escritas que mudam o estado de um
 * acesso (`vehicle_access`) e os eventos de movimento (`vehicle_movement`)
 * rodam em **transação** — nunca 2 `INSIDE` do mesmo veículo (regra 9) e o
 * ledger nunca fica pela metade. Os movimentos de reentrada/encerramento
 * geram `idempotency_key` própria (uuid) — a do request fica no movimento
 * principal (ENTRY/EXIT do NO_EXIT).
 */
@Injectable()
export class VehicleAccessesTypeormRepository implements VehicleAccessRepository {
  constructor(
    @InjectRepository(VehicleAccessOrmEntity)
    private readonly vehicleAccessRepo: Repository<VehicleAccessOrmEntity>,
    @InjectRepository(VehicleMovementOrmEntity)
    private readonly vehicleMovementRepo: Repository<VehicleMovementOrmEntity>,
  ) {}

  /**
   * Lista os acessos `INSIDE` abertos de um veículo cadastrado.
   *
   * @param vehicleId Id do veículo.
   * @param companyId Empresa da sessão.
   * @returns Acessos abertos.
   */
  public async findOpenByVehicleIdAndCompanyId(
    vehicleId: string,
    companyId: string,
  ): Promise<VehicleAccessEntity[]> {
    const rows = await this.vehicleAccessRepo.find({
      where: { vehicleId, companyId, status: AccessStatus.INSIDE },
      order: { entryAt: 'DESC' },
    });
    return rows.map((row) => this.toDomain(row));
  }

  /**
   * Lista os acessos `INSIDE` abertos por placa temporária.
   *
   * @param plate Placa normalizada.
   * @param companyId Empresa da sessão.
   * @returns Acessos abertos.
   */
  public async findOpenByTemporaryPlateAndCompanyId(
    plate: string,
    companyId: string,
  ): Promise<VehicleAccessEntity[]> {
    const rows = await this.vehicleAccessRepo.find({
      where: { temporaryPlate: plate, companyId, status: AccessStatus.INSIDE },
      order: { entryAt: 'DESC' },
    });
    return rows.map((row) => this.toDomain(row));
  }

  /**
   * Registra uma entrada (INSIDE + movimento ENTRY), fechando acessos INSIDE
   * anteriores na mesma transação (regra 9 — reentrada).
   *
   * @param data Dados da entrada.
   * @returns Entrada registrada.
   */
  public async createEntry(
    data: CreateEntryAccessRepositoryData,
  ): Promise<EntryResult> {
    return this.vehicleAccessRepo.manager.transaction(async (manager) => {
      // Reentrada: fecha os INSIDE abertos do mesmo veículo/placa temporária
      // com forced_exit + movimento EXIT (regra 9 — nunca 2 INSIDE).
      const openWhere: FindOptionsWhere<VehicleAccessOrmEntity>[] = [];
      if (data.vehicleId) {
        openWhere.push({
          companyId: data.companyId,
          status: AccessStatus.INSIDE,
          vehicleId: data.vehicleId,
        });
      } else if (data.temporaryPlate) {
        openWhere.push({
          companyId: data.companyId,
          status: AccessStatus.INSIDE,
          temporaryPlate: data.temporaryPlate,
        });
      }
      const open =
        openWhere.length > 0
          ? await manager.find(VehicleAccessOrmEntity, { where: openWhere })
          : [];

      let previousClosed: EntryResult['previousClosed'] = null;
      for (const previous of open) {
        previous.status = AccessStatus.OUT;
        previous.forcedExit = true;
        previous.exitAt = data.occurredAt;
        previous.closedBy = data.doormanId;
        previous.closedAt = data.occurredAt;
        await manager.save(previous);

        const exitMovement = manager.create(VehicleMovementOrmEntity, {
          companyId: data.companyId,
          accessId: previous.id,
          vehicleId: previous.vehicleId,
          type: MovementType.EXIT,
          occurredAt: data.occurredAt,
          plateSnapshot: data.plateSnapshot,
          driverUserId: previous.driverUserId,
          departmentId: previous.departmentId,
          source: data.source,
          entranceId: data.entranceId,
          doormanId: data.doormanId,
          syncStatus: data.syncStatus,
          idempotencyKey: randomUUID(),
        });
        const savedExit = await manager.save(exitMovement);
        previousClosed = {
          access: this.toDomain(previous),
          movement: this.toMovementDomain(savedExit),
        };
      }

      // Nova entrada.
      const access = manager.create(VehicleAccessOrmEntity, {
        companyId: data.companyId,
        vehicleId: data.vehicleId,
        temporaryPlate: data.temporaryPlate,
        driverUserId: data.driverUserId,
        temporaryDriverName: data.temporaryDriverName,
        departmentId: data.departmentId,
        accessRequestId: data.accessRequestId,
        overCapacity: data.overCapacity,
        status: AccessStatus.INSIDE,
        forcedExit: false,
        entryAt: data.occurredAt,
      });
      const savedAccess = await manager.save(access);

      const movement = manager.create(VehicleMovementOrmEntity, {
        companyId: data.companyId,
        accessId: savedAccess.id,
        vehicleId: data.vehicleId,
        type: MovementType.ENTRY,
        occurredAt: data.occurredAt,
        plateSnapshot: data.plateSnapshot,
        driverUserId: data.driverUserId,
        departmentId: data.departmentId,
        source: data.source,
        entranceId: data.entranceId,
        doormanId: data.doormanId,
        syncStatus: data.syncStatus,
        idempotencyKey: data.idempotencyKey,
      });
      const savedMovement = await manager.save(movement);

      return {
        access: this.toDomain(savedAccess),
        movement: this.toMovementDomain(savedMovement),
        previousClosed,
      };
    });
  }

  /**
   * Encerra os acessos abertos informados (`OUT`) e gera os movimentos EXIT
   * na mesma transação (regra 10).
   *
   * @param data Dados do encerramento.
   * @returns Acessos encerrados com seus movimentos EXIT.
   */
  public async closeOpenAndCreateExitMovements(
    data: CloseOpenAccessesRepositoryData,
  ): Promise<
    { access: VehicleAccessEntity; movement: VehicleMovementEntity }[]
  > {
    return this.vehicleAccessRepo.manager.transaction(async (manager) => {
      const result: {
        access: VehicleAccessEntity;
        movement: VehicleMovementEntity;
      }[] = [];

      for (const id of data.accessIds) {
        const orm = await manager.findOne(VehicleAccessOrmEntity, {
          where: { id, companyId: data.companyId, status: AccessStatus.INSIDE },
        });
        if (!orm) {
          continue;
        }

        orm.status = AccessStatus.OUT;
        orm.exitAt = data.occurredAt;
        orm.closedBy = data.doormanId;
        orm.closedAt = data.occurredAt;
        await manager.save(orm);

        const movement = manager.create(VehicleMovementOrmEntity, {
          companyId: data.companyId,
          accessId: orm.id,
          vehicleId: orm.vehicleId,
          type: MovementType.EXIT,
          occurredAt: data.occurredAt,
          plateSnapshot: data.plateSnapshot,
          driverUserId: orm.driverUserId,
          departmentId: orm.departmentId,
          source: data.source,
          entranceId: data.entranceId,
          doormanId: data.doormanId,
          syncStatus: data.syncStatus,
          idempotencyKey: randomUUID(),
        });
        const savedMovement = await manager.save(movement);

        result.push({
          access: this.toDomain(orm),
          movement: this.toMovementDomain(savedMovement),
        });
      }

      return result;
    });
  }

  /**
   * Registra uma saída sem entrada (`NO_EXIT` + movimento EXIT) na mesma
   * transação (regra 11).
   *
   * @param data Dados da saída sem entrada.
   * @returns Acesso NO_EXIT e movimento EXIT.
   */
  public async createNoExit(
    data: CreateNoExitRepositoryData,
  ): Promise<{ access: VehicleAccessEntity; movement: VehicleMovementEntity }> {
    return this.vehicleAccessRepo.manager.transaction(async (manager) => {
      const access = manager.create(VehicleAccessOrmEntity, {
        companyId: data.companyId,
        vehicleId: data.vehicleId,
        temporaryPlate: data.temporaryPlate,
        driverUserId: data.driverUserId,
        temporaryDriverName: data.temporaryDriverName,
        departmentId: null,
        accessRequestId: null,
        overCapacity: false,
        status: AccessStatus.NO_EXIT,
        forcedExit: false,
        exitAt: data.occurredAt,
        closedBy: data.doormanId,
        closedAt: data.occurredAt,
      });
      const savedAccess = await manager.save(access);

      const movement = manager.create(VehicleMovementOrmEntity, {
        companyId: data.companyId,
        accessId: savedAccess.id,
        vehicleId: data.vehicleId,
        type: MovementType.EXIT,
        occurredAt: data.occurredAt,
        plateSnapshot: data.temporaryPlate ?? '',
        driverUserId: data.driverUserId,
        departmentId: null,
        source: data.source,
        entranceId: data.entranceId,
        doormanId: data.doormanId,
        syncStatus: data.syncStatus,
        idempotencyKey: data.idempotencyKey,
      });
      const savedMovement = await manager.save(movement);

      return {
        access: this.toDomain(savedAccess),
        movement: this.toMovementDomain(savedMovement),
      };
    });
  }

  /**
   * Conta os acessos `INSIDE` de um departamento.
   *
   * @param departmentId Id do departamento.
   * @param companyId Empresa da sessão.
   * @returns Quantidade de veículos dentro.
   */
  public async countInsideByDepartmentIdAndCompanyId(
    departmentId: string,
    companyId: string,
  ): Promise<number> {
    return this.vehicleAccessRepo.count({
      where: { departmentId, companyId, status: AccessStatus.INSIDE },
    });
  }

  /**
   * Conta os acessos `INSIDE` da empresa.
   *
   * @param companyId Empresa da sessão.
   * @returns Quantidade de veículos dentro.
   */
  public async countInsideByCompanyId(companyId: string): Promise<number> {
    return this.vehicleAccessRepo.count({
      where: { companyId, status: AccessStatus.INSIDE },
    });
  }

  /**
   * Mapeia a ORM entity para a entidade de domínio.
   *
   * @param orm Registro TypeORM.
   * @returns Acesso de domínio.
   */
  private toDomain(orm: VehicleAccessOrmEntity): VehicleAccessEntity {
    return {
      id: orm.id,
      companyId: orm.companyId,
      vehicleId: orm.vehicleId,
      temporaryPlate: orm.temporaryPlate,
      driverUserId: orm.driverUserId,
      temporaryDriverName: orm.temporaryDriverName,
      departmentId: orm.departmentId,
      accessRequestId: orm.accessRequestId,
      overCapacity: orm.overCapacity,
      status: orm.status,
      forcedExit: orm.forcedExit,
      entryAt: orm.entryAt,
      exitAt: orm.exitAt,
      closedBy: orm.closedBy,
      closedAt: orm.closedAt,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    };
  }

  /**
   * Mapeia a ORM entity de movimento para a entidade de domínio.
   *
   * @param orm Registro TypeORM de movimento.
   * @returns Movimento de domínio.
   */
  private toMovementDomain(
    orm: VehicleMovementOrmEntity,
  ): VehicleMovementEntity {
    return {
      id: orm.id,
      companyId: orm.companyId,
      accessId: orm.accessId,
      vehicleId: orm.vehicleId,
      type: orm.type,
      occurredAt: orm.occurredAt,
      plateSnapshot: orm.plateSnapshot,
      driverUserId: orm.driverUserId,
      departmentId: orm.departmentId,
      source: orm.source,
      entranceId: orm.entranceId,
      doormanId: orm.doormanId,
      syncStatus: orm.syncStatus,
      idempotencyKey: orm.idempotencyKey,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    };
  }
}
