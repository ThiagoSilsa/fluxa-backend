// NestJS
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

// Types
import type { VehicleDepartmentEntity } from '../../../domain/entities/vehicle-department.entity';
import type { VehicleDepartmentRepository } from '../../../domain/repositories/vehicle-department.repository';

// TypeORM
import { VehicleDepartmentOrmEntity } from './vehicle-department.orm-entity';

/**
 * Implementação TypeORM do `VehicleDepartmentRepository`.
 *
 * O unique `(company_id, vehicle_id)` permite uma única linha por veículo: o
 * *upsert* reutiliza a linha existente (ativa ou inativa) em vez de criar uma
 * segunda (ADR 0006 §8).
 */
@Injectable()
export class VehicleDepartmentsTypeormRepository implements VehicleDepartmentRepository {
  constructor(
    @InjectRepository(VehicleDepartmentOrmEntity)
    private readonly vehicleDepartmentRepo: Repository<VehicleDepartmentOrmEntity>,
  ) {}

  /**
   * Define (ou substitui) o departamento padrão do veículo — cria a linha
   * única se não existir, ou reativa/atualiza a linha existente.
   *
   * @param vehicleId Id do veículo.
   * @param companyId Empresa da sessão.
   * @param departmentId Departamento padrão.
   * @returns Vínculo ativo resultante.
   */
  public async upsertByVehicleIdAndCompanyId(
    vehicleId: string,
    companyId: string,
    departmentId: string,
  ): Promise<VehicleDepartmentEntity> {
    const existing = await this.vehicleDepartmentRepo.findOne({
      where: { vehicleId, companyId },
    });

    if (existing) {
      existing.departmentId = departmentId;
      existing.isActive = true;
      const saved = await this.vehicleDepartmentRepo.save(existing);
      return this.toDomain(saved);
    }

    const orm = this.vehicleDepartmentRepo.create({
      vehicleId,
      companyId,
      departmentId,
    });
    const saved = await this.vehicleDepartmentRepo.save(orm);
    return this.toDomain(saved);
  }

  /**
   * Busca o vínculo **ativo** do veículo na empresa.
   *
   * @param vehicleId Id do veículo.
   * @param companyId Empresa da sessão.
   * @returns Vínculo ativo ou `null` se não existir/estiver inativo.
   */
  public async findActiveByVehicleIdAndCompanyId(
    vehicleId: string,
    companyId: string,
  ): Promise<VehicleDepartmentEntity | null> {
    const orm = await this.vehicleDepartmentRepo.findOne({
      where: { vehicleId, companyId, isActive: true },
    });
    return orm ? this.toDomain(orm) : null;
  }

  /**
   * Desativa o vínculo ativo do veículo (`is_active = false`).
   *
   * @param vehicleId Id do veículo.
   * @param companyId Empresa da sessão.
   * @returns Vínculo desativado ou `null` se não havia vínculo ativo.
   */
  public async deactivateByVehicleIdAndCompanyId(
    vehicleId: string,
    companyId: string,
  ): Promise<VehicleDepartmentEntity | null> {
    const orm = await this.vehicleDepartmentRepo.findOne({
      where: { vehicleId, companyId, isActive: true },
    });
    if (!orm) {
      return null;
    }

    orm.isActive = false;
    const saved = await this.vehicleDepartmentRepo.save(orm);
    return this.toDomain(saved);
  }

  /**
   * Mapeia a ORM entity para a entidade de domínio.
   *
   * @param orm Registro ORM.
   * @returns Vínculo de domínio.
   */
  private toDomain(orm: VehicleDepartmentOrmEntity): VehicleDepartmentEntity {
    return {
      id: orm.id,
      companyId: orm.companyId,
      vehicleId: orm.vehicleId,
      departmentId: orm.departmentId,
      isActive: orm.isActive,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    };
  }
}
