// NestJS
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

// Types
import type { PermissionEntity } from '../../../domain/entities/permission.entity';
import type { PermissionRepository } from '../../../domain/repositories/permission.repository';

// TypeORM
import { PermissionOrmEntity } from './permission.orm-entity';

/**
 * Implementação TypeORM do `PermissionRepository`.
 *
 * Catálogo global (sem `company_id`) — leitura apenas (ADR 0004).
 */
@Injectable()
export class PermissionsTypeormRepository implements PermissionRepository {
  constructor(
    @InjectRepository(PermissionOrmEntity)
    private readonly permissionRepo: Repository<PermissionOrmEntity>,
  ) {}

  /**
   * Lista todo o catálogo de permissões, ordenado por código.
   *
   * @returns Catálogo global completo.
   */
  public async listAll(): Promise<PermissionEntity[]> {
    const rows = await this.permissionRepo.find({ order: { code: 'ASC' } });
    return rows.map((row) => this.toDomain(row));
  }

  /**
   * Verifica se uma permissão existe no catálogo global.
   *
   * @param id Id da permissão.
   * @returns `true` quando a permissão existe.
   */
  public async existsById(id: string): Promise<boolean> {
    const found = await this.permissionRepo.findOne({
      where: { id },
      select: { id: true },
    });
    return found !== null;
  }

  /**
   * Busca uma permissão do catálogo global.
   *
   * @param id Id da permissão.
   * @returns Permissão ou `null` se não existir.
   */
  public async findById(id: string): Promise<PermissionEntity | null> {
    const orm = await this.permissionRepo.findOne({ where: { id } });
    return orm ? this.toDomain(orm) : null;
  }

  /**
   * Mapeia a ORM entity para a entidade de domínio.
   *
   * @param orm Registro ORM.
   * @returns Permissão de domínio.
   */
  private toDomain(orm: PermissionOrmEntity): PermissionEntity {
    return {
      id: orm.id,
      code: orm.code,
      description: orm.description,
    };
  }
}
