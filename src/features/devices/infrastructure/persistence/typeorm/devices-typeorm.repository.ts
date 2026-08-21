// NestJS
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';

// Types
import type {
  DeviceEntity,
  DeviceWithEntranceEntity,
} from '../../../domain/entities/device.entity';
import type {
  CreateDeviceRepositoryData,
  DeviceRepository,
  DeviceSortBy,
  ListDevicesRepositoryFilters,
  UpdateDeviceRepositoryData,
} from '../../../domain/repositories/device.repository';

// TypeORM
import { DeviceOrmEntity } from './device.orm-entity';

/**
 * Propriedades de ordenação permitidas na listagem (whitelist — ADR 0008 §5).
 * São nomes de propriedade da ORM entity (não colunas cruas).
 */
const DEVICE_SORT_COLUMNS: Record<DeviceSortBy, keyof DeviceOrmEntity> = {
  name: 'name',
  createdAt: 'createdAt',
  lastSyncAt: 'lastSyncAt',
};

/**
 * Implementação TypeORM do `DeviceRepository`.
 *
 * Todas as operações são escopadas por `company_id` (sufixo `AndCompanyId`) —
 * dispositivos nunca vazam entre empresas (ADR 0008 §1).
 */
@Injectable()
export class DevicesTypeormRepository implements DeviceRepository {
  constructor(
    @InjectRepository(DeviceOrmEntity)
    private readonly deviceRepo: Repository<DeviceOrmEntity>,
  ) {}

  /**
   * Busca um dispositivo por id dentro da empresa (com a portaria agregada).
   *
   * @param id Id do dispositivo.
   * @param companyId Empresa da sessão.
   * @returns Dispositivo da empresa ou `null` se não existir/não pertencer.
   */
  public async findByIdAndCompanyId(
    id: string,
    companyId: string,
  ): Promise<DeviceWithEntranceEntity | null> {
    const orm = await this.deviceRepo.findOne({
      where: { id, companyId },
      relations: { entrance: true },
    });
    return orm ? this.toDomainWithEntrance(orm) : null;
  }

  /**
   * Lista dispositivos da empresa com paginação, busca, filtro de estado e
   * ordenação (com a portaria agregada).
   *
   * @param companyId Empresa da sessão.
   * @param filters Filtros, ordenação e paginação.
   * @returns Dados da página e total sem paginação.
   */
  public async list(
    companyId: string,
    filters: ListDevicesRepositoryFilters,
  ): Promise<{ data: DeviceWithEntranceEntity[]; count: number }> {
    const where: FindOptionsWhere<DeviceOrmEntity> = { companyId };
    if (filters.search) {
      where.name = ILike(`%${filters.search}%`);
    }
    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const orderByColumn =
      filters.sortBy && DEVICE_SORT_COLUMNS[filters.sortBy]
        ? DEVICE_SORT_COLUMNS[filters.sortBy]
        : 'name';
    const orderByDirection = filters.sortOrder === 'DESC' ? 'DESC' : 'ASC';

    const [rows, count] = await this.deviceRepo.findAndCount({
      where,
      relations: { entrance: true },
      order: {
        [orderByColumn]: orderByDirection,
      },
      take: filters.limit,
      skip: filters.offset,
    });

    return { data: rows.map((row) => this.toDomainWithEntrance(row)), count };
  }

  /**
   * Cria um dispositivo na empresa.
   *
   * @param data Dados de criação (inclui `companyId` e `token` gerado).
   * @returns Dispositivo criado.
   */
  public async create(data: CreateDeviceRepositoryData): Promise<DeviceEntity> {
    const orm = this.deviceRepo.create({
      companyId: data.companyId,
      name: data.name,
      token: data.token,
      platform: data.platform,
      entranceId: data.entranceId ?? null,
    });
    const saved = await this.deviceRepo.save(orm);
    return this.toDomain(saved);
  }

  /**
   * Atualiza um dispositivo da empresa (nome, vínculo com portaria, status).
   *
   * @param id Id do dispositivo.
   * @param companyId Empresa da sessão.
   * @param data Campos a atualizar.
   * @returns Dispositivo atualizado ou `null` se não existir/não pertencer.
   */
  public async updateByIdAndCompanyId(
    id: string,
    companyId: string,
    data: UpdateDeviceRepositoryData,
  ): Promise<DeviceEntity | null> {
    const orm = await this.deviceRepo.findOne({ where: { id, companyId } });
    if (!orm) {
      return null;
    }

    if (data.name !== undefined) {
      orm.name = data.name;
    }
    if (data.entranceId !== undefined) {
      orm.entranceId = data.entranceId;
    }
    if (data.isActive !== undefined) {
      orm.isActive = data.isActive;
    }

    const saved = await this.deviceRepo.save(orm);
    return this.toDomain(saved);
  }

  /**
   * Rotaciona o token de um dispositivo da empresa (novo token — ADR 0008 §3).
   *
   * @param id Id do dispositivo.
   * @param companyId Empresa da sessão.
   * @param token Novo token.
   * @returns Dispositivo atualizado ou `null` se não existir/não pertencer.
   */
  public async rotateTokenByIdAndCompanyId(
    id: string,
    companyId: string,
    token: string,
  ): Promise<DeviceEntity | null> {
    const orm = await this.deviceRepo.findOne({ where: { id, companyId } });
    if (!orm) {
      return null;
    }

    orm.token = token;
    const saved = await this.deviceRepo.save(orm);
    return this.toDomain(saved);
  }

  /**
   * Exclui fisicamente um dispositivo da empresa.
   *
   * @param id Id do dispositivo.
   * @param companyId Empresa da sessão.
   * @returns Dispositivo excluído ou `null` se não existir/não pertencer.
   */
  public async deleteByIdAndCompanyId(
    id: string,
    companyId: string,
  ): Promise<DeviceEntity | null> {
    const orm = await this.deviceRepo.findOne({ where: { id, companyId } });
    if (!orm) {
      return null;
    }

    const deleted = await this.deviceRepo.remove(orm);
    return this.toDomain(deleted);
  }

  /**
   * Mapeia a ORM entity para a entidade de domínio (sem a portaria agregada).
   *
   * @param orm Registro TypeORM.
   * @returns Dispositivo de domínio.
   */
  private toDomain(orm: DeviceOrmEntity): DeviceEntity {
    return {
      id: orm.id,
      companyId: orm.companyId,
      name: orm.name,
      token: orm.token,
      platform: orm.platform,
      appVersion: orm.appVersion,
      entranceId: orm.entranceId,
      lastSyncAt: orm.lastSyncAt,
      isActive: orm.isActive,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    };
  }

  /**
   * Mapeia a ORM entity (com a portaria carregada) para a entidade de domínio
   * com o resumo da portaria.
   *
   * @param orm Registro TypeORM (com `entrance`).
   * @returns Dispositivo de domínio com a portaria agregada.
   */
  private toDomainWithEntrance(orm: DeviceOrmEntity): DeviceWithEntranceEntity {
    return {
      ...this.toDomain(orm),
      entrance: orm.entrance
        ? { id: orm.entrance.id, name: orm.entrance.name }
        : null,
    };
  }
}
