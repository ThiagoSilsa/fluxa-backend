// NestJS
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

// Shared
import { normalizePlate } from '../../../../../shared/utils/plate.util';

// Types
import type {
  VehicleEntity,
  VehicleWithTypeEntity,
} from '../../../domain/entities/vehicle.entity';
import type {
  CreateVehicleRepositoryData,
  ListVehiclesRepositoryFilters,
  UpdateVehicleRepositoryData,
  VehicleRepository,
} from '../../../domain/repositories/vehicle.repository';

// TypeORM
import { VehicleDepartmentOrmEntity } from './vehicle-department.orm-entity';
import { VehicleOrmEntity } from './vehicle.orm-entity';
import { UserVehicleOrmEntity } from './user-vehicle.orm-entity';

/** Mapa seguro de colunas de ordenação (whitelist — ADR 0006 §11). */
const VEHICLE_SORT_COLUMNS: Record<string, string> = {
  plate: 'vehicle.plate',
  isActive: 'vehicle.is_active',
  createdAt: 'vehicle.created_at',
};

/**
 * Implementação TypeORM do `VehicleRepository`.
 *
 * Todas as operações são escopadas por `company_id` (sufixo `AndCompanyId`) —
 * veículos nunca vazam entre empresas (ADR 0002/0006). A busca por placa
 * normaliza o termo antes de consultar.
 */
@Injectable()
export class VehiclesTypeormRepository implements VehicleRepository {
  constructor(
    @InjectRepository(VehicleOrmEntity)
    private readonly vehicleRepo: Repository<VehicleOrmEntity>,
  ) {}

  /**
   * Busca um veículo por id dentro da empresa (com o tipo agregado).
   *
   * @param id Id do veículo.
   * @param companyId Empresa da sessão.
   * @returns Veículo da empresa ou `null` se não existir/não pertencer.
   */
  public async findByIdAndCompanyId(
    id: string,
    companyId: string,
  ): Promise<VehicleWithTypeEntity | null> {
    const orm = await this.vehicleRepo.findOne({
      where: { id, companyId },
      relations: { vehicleType: true },
    });
    return orm ? this.toDomainWithType(orm) : null;
  }

  /**
   * Busca um veículo por **placa normalizada** dentro da empresa (com o tipo
   * agregado) — fluxo de acesso/bloqueio (ADR 0010).
   *
   * @param plate Placa normalizada.
   * @param companyId Empresa da sessão.
   * @returns Veículo da empresa ou `null` se não existir/não pertencer.
   */
  public async findByPlateAndCompanyId(
    plate: string,
    companyId: string,
  ): Promise<VehicleWithTypeEntity | null> {
    const orm = await this.vehicleRepo.findOne({
      where: { plate, companyId },
      relations: { vehicleType: true },
    });
    return orm ? this.toDomainWithType(orm) : null;
  }

  /**
   * Lista veículos da empresa com paginação, busca (placa normalizada ou
   * modelo) e filtros (com o tipo agregado).
   *
   * @param companyId Empresa da sessão.
   * @param filters Filtros e paginação.
   * @returns Dados da página e total sem paginação.
   */
  public async list(
    companyId: string,
    filters: ListVehiclesRepositoryFilters,
  ): Promise<{ data: VehicleWithTypeEntity[]; count: number }> {
    const query = this.vehicleRepo
      .createQueryBuilder('vehicle')
      .leftJoinAndSelect('vehicle.vehicleType', 'vehicleType')
      .where('vehicle.company_id = :companyId', { companyId });

    if (filters.search) {
      const plate = normalizePlate(filters.search);
      query.andWhere(
        '(vehicle.plate ILIKE :plate OR vehicle.model ILIKE :model)',
        { plate: `%${plate}%`, model: `%${filters.search}%` },
      );
    }
    if (filters.vehicleTypeId) {
      query.andWhere('vehicle.vehicle_type_id = :vehicleTypeId', {
        vehicleTypeId: filters.vehicleTypeId,
      });
    }
    if (filters.departmentId) {
      query
        .innerJoin(
          VehicleDepartmentOrmEntity,
          'vehicleDepartment',
          'vehicleDepartment.vehicle_id = vehicle.id',
        )
        .andWhere('vehicleDepartment.department_id = :departmentId', {
          departmentId: filters.departmentId,
        })
        .andWhere('vehicleDepartment.is_active = :vdActive', {
          vdActive: true,
        });
    }
    if (filters.freePass !== undefined) {
      query.andWhere('vehicle.free_pass = :freePass', {
        freePass: filters.freePass,
      });
    }
    if (filters.isActive !== undefined) {
      query.andWhere('vehicle.is_active = :isActive', {
        isActive: filters.isActive,
      });
    }

    const orderByColumn =
      filters.sortBy && VEHICLE_SORT_COLUMNS[filters.sortBy]
        ? VEHICLE_SORT_COLUMNS[filters.sortBy]
        : 'vehicle.plate';
    const orderByDirection = filters.sortOrder === 'DESC' ? 'DESC' : 'ASC';

    const [rows, count] = await query
      .orderBy(orderByColumn, orderByDirection)
      .take(filters.limit)
      .skip(filters.offset)
      .getManyAndCount();

    return { data: rows.map((row) => this.toDomainWithType(row)), count };
  }

  /**
   * Cria um veículo na empresa.
   *
   * @param data Dados de criação (inclui `companyId`).
   * @returns Veículo criado.
   */
  public async create(
    data: CreateVehicleRepositoryData,
  ): Promise<VehicleEntity> {
    const orm = this.vehicleRepo.create({
      plate: data.plate,
      companyId: data.companyId,
      model: data.model,
      color: data.color,
      observation: data.observation,
      freePass: data.freePass,
      vehicleTypeId: data.vehicleTypeId,
    });
    const saved = await this.vehicleRepo.save(orm);
    return this.toDomain(saved);
  }

  /**
   * Busca veículos da empresa cujas placas estão na lista (exatas, já
   * normalizadas) — importador (ADR 0007 §8).
   *
   * @param plates Placas a buscar.
   * @param companyId Empresa da sessão.
   * @returns Veículos encontrados com uma das placas.
   */
  public async findByPlatesAndCompanyId(
    plates: string[],
    companyId: string,
  ): Promise<VehicleEntity[]> {
    if (plates.length === 0) {
      return [];
    }

    const rows = await this.vehicleRepo.find({
      where: { companyId, plate: In(plates) },
    });

    return rows.map((row) => this.toDomain(row));
  }

  /**
   * Insere vários veículos em lote (chunks de 500 — ADR 0007 §8).
   *
   * @param data Lista de dados de criação (inclui `companyId`).
   * @returns Veículos criados.
   */
  public async createBatch(
    data: CreateVehicleRepositoryData[],
  ): Promise<VehicleEntity[]> {
    if (data.length === 0) {
      return [];
    }

    const entities = data.map((item) =>
      this.vehicleRepo.create({
        plate: item.plate,
        companyId: item.companyId,
        model: item.model,
        color: item.color,
        observation: item.observation,
        freePass: item.freePass,
        vehicleTypeId: item.vehicleTypeId,
      }),
    );

    const saved = await this.vehicleRepo.save(entities);
    return saved.map((row) => this.toDomain(row));
  }

  /**
   * Atualiza um veículo da empresa.
   *
   * @param id Id do veículo.
   * @param companyId Empresa da sessão.
   * @param data Campos a atualizar.
   * @returns Veículo atualizado ou `null` se não existir/não pertencer.
   */
  public async updateByIdAndCompanyId(
    id: string,
    companyId: string,
    data: UpdateVehicleRepositoryData,
  ): Promise<VehicleEntity | null> {
    const orm = await this.vehicleRepo.findOne({
      where: { id, companyId },
    });
    if (!orm) {
      return null;
    }

    if (data.plate !== undefined) {
      orm.plate = data.plate;
    }
    if (data.model !== undefined) {
      orm.model = data.model;
    }
    if (data.color !== undefined) {
      orm.color = data.color;
    }
    if (data.observation !== undefined) {
      orm.observation = data.observation;
    }
    if (data.freePass !== undefined) {
      orm.freePass = data.freePass;
    }
    if (data.vehicleTypeId !== undefined) {
      orm.vehicleTypeId = data.vehicleTypeId;
    }
    if (data.isActive !== undefined) {
      orm.isActive = data.isActive;
    }

    const saved = await this.vehicleRepo.save(orm);
    return this.toDomain(saved);
  }

  /**
   * Atualiza o `is_blocked` de um veículo da empresa (derivado — ADR 0010 §2:
   * a feature de bloqueio é a única que escreve essa coluna).
   *
   * @param id Id do veículo.
   * @param companyId Empresa da sessão.
   * @param isBlocked Novo valor derivado.
   * @returns Veículo atualizado ou `null` se não existir/não pertencer.
   */
  public async updateIsBlockedByIdAndCompanyId(
    id: string,
    companyId: string,
    isBlocked: boolean,
  ): Promise<VehicleEntity | null> {
    const orm = await this.vehicleRepo.findOne({ where: { id, companyId } });
    if (!orm) {
      return null;
    }

    orm.isBlocked = isBlocked;
    const saved = await this.vehicleRepo.save(orm);
    return this.toDomain(saved);
  }

  /**
   * Conta vínculos da empresa que referenciam um veículo — `vehicle_department`
   * (departamento padrão) + `user_vehicle` (motoristas).
   *
   * @param vehicleId Id do veículo.
   * @param companyId Empresa da sessão.
   * @returns Quantidade de vínculos que referenciam o veículo.
   */
  public async countVehicleLinksByVehicleIdAndCompanyId(
    vehicleId: string,
    companyId: string,
  ): Promise<number> {
    const [departments, drivers] = await Promise.all([
      this.vehicleRepo.manager.count(VehicleDepartmentOrmEntity, {
        where: { vehicleId, companyId },
      }),
      this.vehicleRepo.manager.count(UserVehicleOrmEntity, {
        where: { vehicleId, companyId },
      }),
    ]);

    return departments + drivers;
  }

  /**
   * Exclui fisicamente um veículo da empresa.
   *
   * @param id Id do veículo.
   * @param companyId Empresa da sessão.
   * @returns Veículo excluído ou `null` se não existir/não pertencer.
   */
  public async deleteByIdAndCompanyId(
    id: string,
    companyId: string,
  ): Promise<VehicleEntity | null> {
    const orm = await this.vehicleRepo.findOne({
      where: { id, companyId },
    });
    if (!orm) {
      return null;
    }

    const domain = this.toDomain(orm);
    await this.vehicleRepo.delete({ id, companyId });
    return domain;
  }

  /**
   * Mapeia a ORM entity para a entidade de domínio (sem o tipo agregado).
   *
   * @param orm Registro ORM.
   * @returns Veículo de domínio.
   */
  private toDomain(orm: VehicleOrmEntity): VehicleEntity {
    return {
      id: orm.id,
      plate: orm.plate,
      companyId: orm.companyId,
      model: orm.model,
      color: orm.color,
      observation: orm.observation,
      isBlocked: orm.isBlocked,
      freePass: orm.freePass,
      vehicleTypeId: orm.vehicleTypeId,
      isActive: orm.isActive,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    };
  }

  /**
   * Mapeia a ORM entity (com o tipo carregado) para a entidade de domínio com
   * o tipo agregado.
   *
   * @param orm Registro ORM (com `vehicleType` carregado).
   * @returns Veículo de domínio com o tipo.
   */
  private toDomainWithType(orm: VehicleOrmEntity): VehicleWithTypeEntity {
    return {
      ...this.toDomain(orm),
      vehicleType: orm.vehicleType
        ? {
            id: orm.vehicleType.id,
            code: orm.vehicleType.code,
            name: orm.vehicleType.name,
            isFleet: orm.vehicleType.isFleet,
          }
        : null,
    };
  }
}
