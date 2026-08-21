// NestJS
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

// Types
import type { VehicleQrEntity } from '../../../domain/entities/vehicle-qr.entity';
import type {
  CreateVehicleQrRepositoryData,
  VehicleQrRepository,
} from '../../../domain/repositories/vehicle-qr.repository';

// TypeORM
import { VehicleQrOrmEntity } from './vehicle-qr.orm-entity';

/**
 * Implementação TypeORM do `VehicleQrRepository`.
 *
 * Todas as operações são escopadas por `company_id` (sufixo `AndCompanyId`) —
 * QR codes nunca vazam entre empresas (ADR 0009 §2).
 */
@Injectable()
export class VehicleQrTypeormRepository implements VehicleQrRepository {
  constructor(
    @InjectRepository(VehicleQrOrmEntity)
    private readonly vehicleQrRepo: Repository<VehicleQrOrmEntity>,
  ) {}

  /**
   * Busca o QR **ativo** de um veículo da empresa (único por veículo).
   *
   * @param vehicleId Id do veículo.
   * @param companyId Empresa da sessão.
   * @returns QR ativo ou `null` (nunca emitido, revogado ou reemitido).
   */
  public async findActiveByVehicleIdAndCompanyId(
    vehicleId: string,
    companyId: string,
  ): Promise<VehicleQrEntity | null> {
    const orm = await this.vehicleQrRepo.findOne({
      where: { vehicleId, companyId, isActive: true },
    });
    return orm ? this.toDomain(orm) : null;
  }

  /**
   * Busca um QR pelo `code` dentro da empresa (para a resolução — ADR 0009
   * §4). O chamador distingue ativo/revogado pelo `isActive`.
   *
   * @param code Token do QR (lido pelo scanner).
   * @param companyId Empresa da sessão.
   * @returns QR encontrado ou `null` (desconhecido/outro tenant).
   */
  public async findByCodeAndCompanyId(
    code: string,
    companyId: string,
  ): Promise<VehicleQrEntity | null> {
    const orm = await this.vehicleQrRepo.findOne({
      where: { code, companyId },
    });
    return orm ? this.toDomain(orm) : null;
  }

  /**
   * Cria um QR ativo para o veículo da empresa.
   *
   * @param data Dados de criação (inclui `companyId`, `vehicleId` e `code`).
   * @returns QR criado.
   */
  public async create(
    data: CreateVehicleQrRepositoryData,
  ): Promise<VehicleQrEntity> {
    const orm = this.vehicleQrRepo.create({
      companyId: data.companyId,
      vehicleId: data.vehicleId,
      code: data.code,
      issuedBy: data.issuedBy,
    });
    const saved = await this.vehicleQrRepo.save(orm);
    return this.toDomain(saved);
  }

  /**
   * Desativa um QR da empresa (`is_active = false` — revogar sem reemitir).
   *
   * @param id Id do QR.
   * @param companyId Empresa da sessão.
   * @returns `true` se um QR foi desativado, `false` se não existia.
   */
  public async deactivateByIdAndCompanyId(
    id: string,
    companyId: string,
  ): Promise<boolean> {
    const result = await this.vehicleQrRepo.update(
      { id, companyId },
      { isActive: false },
    );
    return (result.affected ?? 0) > 0;
  }

  /**
   * Reemite o QR do veículo em **transação**: desativa o QR ativo atual e
   * cria um novo com `code` novo (adesivo novo — ADR 0009 §2).
   *
   * @param vehicleId Id do veículo.
   * @param companyId Empresa da sessão.
   * @param data Novo código + emissor.
   * @returns Novo QR criado.
   */
  public async reissue(
    vehicleId: string,
    companyId: string,
    data: { code: string; issuedBy: string },
  ): Promise<VehicleQrEntity> {
    return this.vehicleQrRepo.manager.transaction(async (manager) => {
      const active = await manager.findOne(VehicleQrOrmEntity, {
        where: { vehicleId, companyId, isActive: true },
      });
      if (active) {
        active.isActive = false;
        await manager.save(active);
      }

      const orm = manager.create(VehicleQrOrmEntity, {
        companyId,
        vehicleId,
        code: data.code,
        issuedBy: data.issuedBy,
      });
      const saved = await manager.save(orm);
      return this.toDomain(saved);
    });
  }

  /**
   * Mapeia a ORM entity para a entidade de domínio.
   *
   * @param orm Registro TypeORM.
   * @returns QR de domínio.
   */
  private toDomain(orm: VehicleQrOrmEntity): VehicleQrEntity {
    return {
      id: orm.id,
      companyId: orm.companyId,
      vehicleId: orm.vehicleId,
      code: orm.code,
      isActive: orm.isActive,
      issuedBy: orm.issuedBy,
      printedAt: orm.printedAt,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    };
  }
}
