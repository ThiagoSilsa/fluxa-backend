// NestJS
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

// Types
import type { UserRoleWithRoleEntity } from '../../../domain/entities/user-role.entity';
import type { UserRoleRepository } from '../../../domain/repositories/user-role.repository';

// TypeORM
import { UserRoleOrmEntity } from '../../../../roles/infrastructure/persistence/typeorm/user-role.orm-entity';

/**
 * Implementação TypeORM do `UserRoleRepository` (cargos de usuário).
 *
 * Tudo é escopado por `company_id` — cargos de uma empresa nunca vazam para
 * outra (ADR 0002/0004).
 */
@Injectable()
export class UserRoleTypeormRepository implements UserRoleRepository {
  constructor(
    @InjectRepository(UserRoleOrmEntity)
    private readonly userRoleRepo: Repository<UserRoleOrmEntity>,
  ) {}

  /**
   * Verifica se o usuário tem o cargo na empresa.
   *
   * @param userId Id da pessoa.
   * @param roleId Id do cargo.
   * @param companyId Empresa da sessão.
   * @returns `true` se o vínculo existir.
   */
  public async exists(
    userId: string,
    roleId: string,
    companyId: string,
  ): Promise<boolean> {
    const count = await this.userRoleRepo.count({
      where: { userId, roleId, companyId },
    });
    return count > 0;
  }

  /**
   * Lista os cargos do usuário na empresa (com dados do cargo).
   *
   * @param userId Id da pessoa.
   * @param companyId Empresa da sessão.
   * @returns Vínculos `user_role` com dados do cargo.
   */
  public async listByUserIdAndCompanyId(
    userId: string,
    companyId: string,
  ): Promise<UserRoleWithRoleEntity[]> {
    const rows = await this.userRoleRepo.find({
      where: { userId, companyId },
      relations: { role: true },
      order: { createdAt: 'ASC' },
    });
    return rows.map((row) => this.toDomain(row));
  }

  /**
   * Atribui um cargo ao usuário na empresa.
   *
   * @param userId Id da pessoa.
   * @param roleId Id do cargo.
   * @param companyId Empresa da sessão.
   * @returns Promise resolvida quando o vínculo é criado.
   */
  public async create(
    userId: string,
    roleId: string,
    companyId: string,
  ): Promise<void> {
    const orm = this.userRoleRepo.create({ userId, roleId, companyId });
    await this.userRoleRepo.save(orm);
  }

  /**
   * Remove o cargo do usuário na empresa.
   *
   * @param userId Id da pessoa.
   * @param roleId Id do cargo.
   * @param companyId Empresa da sessão.
   * @returns `true` se o vínculo existia e foi removido.
   */
  public async remove(
    userId: string,
    roleId: string,
    companyId: string,
  ): Promise<boolean> {
    const result = await this.userRoleRepo.delete({
      userId,
      roleId,
      companyId,
    });
    return (result.affected ?? 0) > 0;
  }

  /**
   * Mapeia a ORM entity (vínculo + cargo) para a entidade de domínio.
   *
   * @param orm Registro ORM do `user_role`.
   * @returns Vínculo com dados do cargo.
   */
  private toDomain(orm: UserRoleOrmEntity): UserRoleWithRoleEntity {
    return {
      userRoleId: orm.id,
      userId: orm.userId,
      roleId: orm.roleId,
      roleName: orm.role?.name ?? '',
      roleIsAdmin: orm.role?.isAdmin ?? false,
      roleIsActive: orm.role?.isActive ?? false,
      createdAt: orm.createdAt,
    };
  }
}
