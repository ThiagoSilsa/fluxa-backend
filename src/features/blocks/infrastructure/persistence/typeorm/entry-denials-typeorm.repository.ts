// NestJS
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

// Types
import type { EntryDenialEntity } from '../../../domain/entities/entry-denial.entity';
import type {
  CreateEntryDenialRepositoryData,
  EntryDenialRepository,
} from '../../../domain/repositories/entry-denial.repository';

// TypeORM
import { EntryDenialOrmEntity } from './entry-denial.orm-entity';

/**
 * Implementação TypeORM do `EntryDenialRepository` — ledger de impedimentos
 * (append-only, escopado por `company_id`).
 */
@Injectable()
export class EntryDenialsTypeormRepository implements EntryDenialRepository {
  constructor(
    @InjectRepository(EntryDenialOrmEntity)
    private readonly entryDenialRepo: Repository<EntryDenialOrmEntity>,
  ) {}

  /**
   * Registra um impedimento (append-only).
   *
   * @param data Dados do impedimento.
   * @returns Impedimento registrado.
   */
  public async create(
    data: CreateEntryDenialRepositoryData,
  ): Promise<EntryDenialEntity> {
    const orm = this.entryDenialRepo.create({
      companyId: data.companyId,
      vehicleId: data.vehicleId,
      plateSnapshot: data.plateSnapshot,
      blockId: data.blockId,
      reason: data.reason,
      observation: data.observation,
      entranceId: data.entranceId,
      doormanId: data.doormanId,
      occurredAt: data.occurredAt,
      syncStatus: data.syncStatus,
      idempotencyKey: data.idempotencyKey,
    });
    const saved = await this.entryDenialRepo.save(orm);
    return this.toDomain(saved);
  }

  /**
   * Mapeia a ORM entity para a entidade de domínio.
   *
   * @param orm Registro TypeORM.
   * @returns Impedimento de domínio.
   */
  private toDomain(orm: EntryDenialOrmEntity): EntryDenialEntity {
    return {
      id: orm.id,
      companyId: orm.companyId,
      vehicleId: orm.vehicleId,
      plateSnapshot: orm.plateSnapshot,
      blockId: orm.blockId,
      reason: orm.reason,
      observation: orm.observation,
      entranceId: orm.entranceId,
      doormanId: orm.doormanId,
      occurredAt: orm.occurredAt,
      syncStatus: orm.syncStatus,
      idempotencyKey: orm.idempotencyKey,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    };
  }
}
