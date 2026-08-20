// NestJS
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';

// Types
import type {
  UserVehicleEntity,
  UserVehicleWithUserEntity,
} from '../../../domain/entities/user-vehicle.entity';
import type {
  AssignDriverRepositoryData,
  UpdateDriverRepositoryData,
  UserVehicleRepository,
} from '../../../domain/repositories/user-vehicle.repository';

// TypeORM
import { UserVehicleOrmEntity } from './user-vehicle.orm-entity';

/**
 * Implementação TypeORM do `UserVehicleRepository`.
 *
 * A tabela não tem `is_active` — a remoção é física. `is_primary = true`
 * **desmarca o primário anterior** do mesmo veículo na mesma transação
 * (invariante de 1 primário — ADR 0006 §9); o unique parcial é a salvaguarda
 * de concorrência (409 no use case).
 */
@Injectable()
export class UserVehiclesTypeormRepository implements UserVehicleRepository {
  constructor(
    @InjectRepository(UserVehicleOrmEntity)
    private readonly userVehicleRepo: Repository<UserVehicleOrmEntity>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Cria o vínculo — se `isPrimary`, desmarca o primário anterior do veículo
   * na mesma transação.
   *
   * @param data Dados do vínculo (inclui `companyId`).
   * @returns Vínculo criado.
   */
  public async create(
    data: AssignDriverRepositoryData,
  ): Promise<UserVehicleEntity> {
    return this.dataSource.transaction(async (manager) => {
      if (data.isPrimary) {
        await manager.update(
          UserVehicleOrmEntity,
          { vehicleId: data.vehicleId, companyId: data.companyId },
          { isPrimary: false },
        );
      }

      const orm = manager.create(UserVehicleOrmEntity, {
        companyId: data.companyId,
        userId: data.userId,
        vehicleId: data.vehicleId,
        isPrimary: data.isPrimary,
        canDrive: data.canDrive,
      });
      const saved = await manager.save(orm);
      return this.toDomain(saved);
    });
  }

  /**
   * Insere vários vínculos em lote (chunks de 500 — ADR 0007 §8). Se algum
   * vínculo do lote marca `isPrimary`, os primários anteriores dos veículos
   * envolvidos são desmarcados na mesma transação (invariante de 1 primário —
   * ADR 0006 §9).
   *
   * @param data Lista de dados do vínculo (inclui `companyId`).
   * @returns Vínculos criados.
   */
  public async createBatch(
    data: AssignDriverRepositoryData[],
  ): Promise<UserVehicleEntity[]> {
    if (data.length === 0) {
      return [];
    }

    return this.dataSource.transaction(async (manager) => {
      const primaryVehicleIds = [
        ...new Set(
          data.filter((item) => item.isPrimary).map((item) => item.vehicleId),
        ),
      ];

      if (primaryVehicleIds.length > 0) {
        await manager.update(
          UserVehicleOrmEntity,
          {
            vehicleId: In(primaryVehicleIds),
            companyId: data[0].companyId,
            isPrimary: true,
          },
          { isPrimary: false },
        );
      }

      const entities = data.map((item) =>
        manager.create(UserVehicleOrmEntity, {
          companyId: item.companyId,
          userId: item.userId,
          vehicleId: item.vehicleId,
          isPrimary: item.isPrimary,
          canDrive: item.canDrive,
        }),
      );

      const saved = await manager.save(entities);
      return saved.map((row) => this.toDomain(row));
    });
  }

  /**
   * Lista os vínculos do veículo na empresa, com o nome do motorista
   * (primários primeiro).
   *
   * @param vehicleId Id do veículo.
   * @param companyId Empresa da sessão.
   * @returns Vínculos do veículo.
   */
  public async findByVehicleIdAndCompanyId(
    vehicleId: string,
    companyId: string,
  ): Promise<UserVehicleWithUserEntity[]> {
    const rows = await this.userVehicleRepo.find({
      where: { vehicleId, companyId },
      relations: { user: true },
      order: { isPrimary: 'DESC', createdAt: 'ASC' },
    });
    return rows.map((row) => this.toDomainWithUser(row));
  }

  /**
   * Lista os vínculos de vários veículos na empresa (sem o motorista) —
   * importador de vínculo usuário-veículo (ADR 0007 §8).
   *
   * @param vehicleIds Ids dos veículos.
   * @param companyId Empresa da sessão.
   * @returns Vínculos encontrados para os veículos informados.
   */
  public async findByVehicleIdsAndCompanyId(
    vehicleIds: string[],
    companyId: string,
  ): Promise<UserVehicleEntity[]> {
    if (vehicleIds.length === 0) {
      return [];
    }

    const rows = await this.userVehicleRepo.find({
      where: { companyId, vehicleId: In(vehicleIds) },
    });

    return rows.map((row) => this.toDomain(row));
  }

  /**
   * Busca o vínculo de um motorista com um veículo na empresa.
   *
   * @param userId Id do motorista.
   * @param vehicleId Id do veículo.
   * @param companyId Empresa da sessão.
   * @returns Vínculo (com o motorista) ou `null` se não existir.
   */
  public async findByUserIdAndVehicleIdAndCompanyId(
    userId: string,
    vehicleId: string,
    companyId: string,
  ): Promise<UserVehicleWithUserEntity | null> {
    const orm = await this.userVehicleRepo.findOne({
      where: { userId, vehicleId, companyId },
      relations: { user: true },
    });
    return orm ? this.toDomainWithUser(orm) : null;
  }

  /**
   * Atualiza o vínculo — se `isPrimary = true`, desmarca o primário anterior
   * do veículo na mesma transação.
   *
   * @param id Id do vínculo.
   * @param companyId Empresa da sessão.
   * @param data Campos a atualizar.
   * @returns Vínculo atualizado ou `null` se não existir/não pertencer.
   */
  public async updateByIdAndCompanyId(
    id: string,
    companyId: string,
    data: UpdateDriverRepositoryData,
  ): Promise<UserVehicleEntity | null> {
    return this.dataSource.transaction(async (manager) => {
      const orm = await manager.findOne(UserVehicleOrmEntity, {
        where: { id, companyId },
      });
      if (!orm) {
        return null;
      }

      if (data.isPrimary === true && !orm.isPrimary) {
        await manager.update(
          UserVehicleOrmEntity,
          { vehicleId: orm.vehicleId, companyId },
          { isPrimary: false },
        );
      }
      if (data.isPrimary !== undefined) {
        orm.isPrimary = data.isPrimary;
      }
      if (data.canDrive !== undefined) {
        orm.canDrive = data.canDrive;
      }

      const saved = await manager.save(orm);
      return this.toDomain(saved);
    });
  }

  /**
   * Remove o vínculo **fisicamente** (a tabela não tem `is_active`).
   *
   * @param id Id do vínculo.
   * @param companyId Empresa da sessão.
   */
  public async removeByIdAndCompanyId(
    id: string,
    companyId: string,
  ): Promise<void> {
    await this.userVehicleRepo.delete({ id, companyId });
  }

  /**
   * Mapeia a ORM entity para a entidade de domínio (sem o motorista).
   *
   * @param orm Registro ORM.
   * @returns Vínculo de domínio.
   */
  private toDomain(orm: UserVehicleOrmEntity): UserVehicleEntity {
    return {
      id: orm.id,
      companyId: orm.companyId,
      userId: orm.userId,
      vehicleId: orm.vehicleId,
      isPrimary: orm.isPrimary,
      canDrive: orm.canDrive,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    };
  }

  /**
   * Mapeia a ORM entity (com o motorista carregado) para a entidade de
   * domínio com o motorista.
   *
   * @param orm Registro ORM (com `user` carregado).
   * @returns Vínculo de domínio com o motorista.
   */
  private toDomainWithUser(
    orm: UserVehicleOrmEntity,
  ): UserVehicleWithUserEntity {
    return {
      ...this.toDomain(orm),
      user: { id: orm.user.id, name: orm.user.name },
    };
  }
}
