// NestJS
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

// Types
import type { VehicleTypeEntity } from '../../../domain/entities/vehicle-type.entity';
import type {
  CreateVehicleTypeRepositoryData,
  ListVehicleTypesRepositoryFilters,
  UpdateVehicleTypeRepositoryData,
  VehicleTypeRepository,
} from '../../../domain/repositories/vehicle-type.repository';

// TypeORM
import { VehicleOrmEntity } from './vehicle.orm-entity';
import { VehicleTypeOrmEntity } from './vehicle-type.orm-entity';

/**
 * Implementação TypeORM do `VehicleTypeRepository`.
 *
 * Todas as operações são escopadas por `company_id` (sufixo `AndCompanyId`) —
 * tipos de veículo nunca vazam entre empresas (ADR 0002/0006).
 */
@Injectable()
export class VehicleTypesTypeormRepository implements VehicleTypeRepository {
  constructor(
    @InjectRepository(VehicleTypeOrmEntity)
    private readonly vehicleTypeRepo: Repository<VehicleTypeOrmEntity>,
  ) {}

  /**
   * Busca um tipo por id dentro da empresa.
   *
   * @param id Id do tipo.
   * @param companyId Empresa da sessão.
   * @returns Tipo da empresa ou `null` se não existir/não pertencer.
   */
  public async findByIdAndCompanyId(
    id: string,
    companyId: string,
  ): Promise<VehicleTypeEntity | null> {
    const orm = await this.vehicleTypeRepo.findOne({
      where: { id, companyId },
    });
    return orm ? this.toDomain(orm) : null;
  }

  /**
   * Lista tipos da empresa com paginação, busca (código/nome) e filtros.
   *
   * @param companyId Empresa da sessão.
   * @param filters Filtros e paginação.
   * @returns Dados da página e total sem paginação.
   */
  public async list(
    companyId: string,
    filters: ListVehicleTypesRepositoryFilters,
  ): Promise<{ data: VehicleTypeEntity[]; count: number }> {
    const query = this.vehicleTypeRepo
      .createQueryBuilder('vehicle_type')
      .where('vehicle_type.company_id = :companyId', { companyId });

    if (filters.search) {
      const term = `%${filters.search}%`;
      query.andWhere(
        '(vehicle_type.code ILIKE :code OR vehicle_type.name ILIKE :name)',
        { code: term, name: term },
      );
    }
    if (filters.isFleet !== undefined) {
      query.andWhere('vehicle_type.is_fleet = :isFleet', {
        isFleet: filters.isFleet,
      });
    }
    if (filters.isActive !== undefined) {
      query.andWhere('vehicle_type.is_active = :isActive', {
        isActive: filters.isActive,
      });
    }

    const [rows, count] = await query
      .orderBy('vehicle_type.code', 'ASC')
      .take(filters.limit)
      .skip(filters.offset)
      .getManyAndCount();

    return { data: rows.map((row) => this.toDomain(row)), count };
  }

  /**
   * Cria um tipo na empresa.
   *
   * @param data Dados de criação (inclui `companyId`).
   * @returns Tipo criado.
   */
  public async create(
    data: CreateVehicleTypeRepositoryData,
  ): Promise<VehicleTypeEntity> {
    const orm = this.vehicleTypeRepo.create({
      companyId: data.companyId,
      code: data.code,
      name: data.name,
      description: data.description,
      isFleet: data.isFleet,
    });
    const saved = await this.vehicleTypeRepo.save(orm);
    return this.toDomain(saved);
  }

  /**
   * Busca tipos da empresa cujos códigos estão na lista (exatos) —
   * importador de veículos (ADR 0007 §8).
   *
   * @param codes Códigos a buscar.
   * @param companyId Empresa da sessão.
   * @returns Tipos encontrados com um dos códigos.
   */
  public async findByCodesAndCompanyId(
    codes: string[],
    companyId: string,
  ): Promise<VehicleTypeEntity[]> {
    if (codes.length === 0) {
      return [];
    }

    const rows = await this.vehicleTypeRepo.find({
      where: { companyId, code: In(codes) },
    });

    return rows.map((row) => this.toDomain(row));
  }

  /**
   * Atualiza um tipo da empresa (código/nome/descrição/classificação).
   *
   * @param id Id do tipo.
   * @param companyId Empresa da sessão.
   * @param data Campos a atualizar.
   * @returns Tipo atualizado ou `null` se não existir/não pertencer.
   */
  public async updateByIdAndCompanyId(
    id: string,
    companyId: string,
    data: UpdateVehicleTypeRepositoryData,
  ): Promise<VehicleTypeEntity | null> {
    const orm = await this.vehicleTypeRepo.findOne({
      where: { id, companyId },
    });
    if (!orm) {
      return null;
    }

    if (data.code !== undefined) {
      orm.code = data.code;
    }
    if (data.name !== undefined) {
      orm.name = data.name;
    }
    if (data.description !== undefined) {
      orm.description = data.description;
    }
    if (data.isFleet !== undefined) {
      orm.isFleet = data.isFleet;
    }
    if (data.isActive !== undefined) {
      orm.isActive = data.isActive;
    }

    const saved = await this.vehicleTypeRepo.save(orm);
    return this.toDomain(saved);
  }

  /**
   * Conta veículos da empresa que usam um tipo.
   *
   * @param vehicleTypeId Id do tipo.
   * @param companyId Empresa da sessão.
   * @returns Quantidade de veículos que referenciam o tipo.
   */
  public async countVehiclesByTypeIdAndCompanyId(
    vehicleTypeId: string,
    companyId: string,
  ): Promise<number> {
    return this.vehicleTypeRepo.manager.count(VehicleOrmEntity, {
      where: { vehicleTypeId, companyId },
    });
  }

  /**
   * Exclui fisicamente um tipo da empresa.
   *
   * @param id Id do tipo.
   * @param companyId Empresa da sessão.
   * @returns Tipo excluído ou `null` se não existir/não pertencer.
   */
  public async deleteByIdAndCompanyId(
    id: string,
    companyId: string,
  ): Promise<VehicleTypeEntity | null> {
    const orm = await this.vehicleTypeRepo.findOne({
      where: { id, companyId },
    });
    if (!orm) {
      return null;
    }

    const domain = this.toDomain(orm);
    await this.vehicleTypeRepo.delete({ id, companyId });
    return domain;
  }

  /**
   * Mapeia a ORM entity para a entidade de domínio.
   *
   * @param orm Registro ORM.
   * @returns Tipo de veículo de domínio.
   */
  private toDomain(orm: VehicleTypeOrmEntity): VehicleTypeEntity {
    return {
      id: orm.id,
      companyId: orm.companyId,
      code: orm.code,
      name: orm.name,
      description: orm.description,
      isFleet: orm.isFleet,
      isActive: orm.isActive,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    };
  }
}
