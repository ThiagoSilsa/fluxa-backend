// NestJS
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';

// Types
import type { UserEntity } from '../../../domain/entities/user.entity';
import type {
  CreateUserRepositoryData,
  UpdateUserRepositoryData,
  UserRepository,
} from '../../../domain/repositories/user.repository';

// TypeORM
import { UserCompanyOrmEntity } from './user-company.orm-entity';
import { UserOrmEntity } from './user.orm-entity';
import { UserRoleOrmEntity } from '../../../../roles/infrastructure/persistence/typeorm/user-role.orm-entity';

/**
 * Implementação TypeORM do `UserRepository` (pessoas — identidade global).
 *
 * A pessoa é a identidade (ADR 0002): sem `companyId`; a participação numa
 * empresa é o vínculo `user_company`, criado **na mesma transação** que a
 * pessoa (pessoa sem vínculo não pode existir).
 */
@Injectable()
export class UsersTypeormRepository implements UserRepository {
  constructor(
    @InjectRepository(UserOrmEntity)
    private readonly userRepo: Repository<UserOrmEntity>,
    @InjectRepository(UserCompanyOrmEntity)
    private readonly userCompanyRepo: Repository<UserCompanyOrmEntity>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Busca a pessoa por e-mail (identidade global).
   *
   * @param email E-mail normalizado (lowercase + trim).
   * @returns Pessoa ou `null` se não existir.
   */
  public async findByEmail(email: string): Promise<UserEntity | null> {
    const orm = await this.userRepo.findOne({ where: { email } });
    return orm ? this.toDomain(orm) : null;
  }

  /**
   * Busca a pessoa por id.
   *
   * @param id Id da pessoa.
   * @returns Pessoa ou `null` se não existir.
   */
  public async findById(id: string): Promise<UserEntity | null> {
    const orm = await this.userRepo.findOne({ where: { id } });
    return orm ? this.toDomain(orm) : null;
  }

  /**
   * Busca a pessoa por documento (único global).
   *
   * @param document Documento.
   * @returns Pessoa ou `null` se não existir.
   */
  public async findByDocument(document: string): Promise<UserEntity | null> {
    const orm = await this.userRepo.findOne({ where: { document } });
    return orm ? this.toDomain(orm) : null;
  }

  /**
   * Busca as pessoas pelos e-mails (identidade global) — importador de
   * usuários (ADR 0007 §8).
   *
   * @param emails E-mails normalizados.
   * @returns Pessoas encontradas com um dos e-mails.
   */
  public async findByEmails(emails: string[]): Promise<UserEntity[]> {
    if (emails.length === 0) {
      return [];
    }

    const rows = await this.userRepo.find({ where: { email: In(emails) } });
    return rows.map((row) => this.toDomain(row));
  }

  /**
   * Cria a pessoa **e o vínculo** com a empresa na mesma transação (ADR 0002).
   *
   * @param data Dados da pessoa + vínculo a criar junto.
   * @returns Pessoa criada.
   */
  public async create(data: CreateUserRepositoryData): Promise<UserEntity> {
    return this.dataSource.transaction(async (manager) => {
      const user = manager.create(UserOrmEntity, {
        name: data.name,
        email: data.email,
        password: data.passwordHash,
        phone: data.phone,
        document: data.document,
      });
      const savedUser = await manager.save(user);

      const link = manager.create(UserCompanyOrmEntity, {
        userId: savedUser.id,
        companyId: data.companyId,
        type: data.type,
        isActive: data.isActive,
      });
      await manager.save(link);

      // Cargo único por empresa (ADR 0005 §5): criado na MESMA transação
      // quando `roleId` é informado — evita pessoa sem cargo após o create.
      if (data.roleId) {
        const userRole = manager.create(UserRoleOrmEntity, {
          userId: savedUser.id,
          companyId: data.companyId,
          roleId: data.roleId,
        });
        await manager.save(userRole);
      }

      return this.toDomain(savedUser);
    });
  }

  /**
   * Insere várias pessoas **e vínculos** em lote (chunks de 500 — ADR 0007
   * §8), cada pessoa com o `user_company` (e `user_role` quando `roleId`
   * informado) na mesma transação.
   *
   * @param data Lista de dados da pessoa + vínculo a criar junto.
   * @returns Pessoas criadas.
   */
  public async createBatch(
    data: CreateUserRepositoryData[],
  ): Promise<UserEntity[]> {
    if (data.length === 0) {
      return [];
    }

    return this.dataSource.transaction(async (manager) => {
      const created: UserEntity[] = [];

      for (const item of data) {
        const user = manager.create(UserOrmEntity, {
          name: item.name,
          email: item.email,
          password: item.passwordHash,
          phone: item.phone,
          document: item.document,
        });
        const savedUser = await manager.save(user);

        const link = manager.create(UserCompanyOrmEntity, {
          userId: savedUser.id,
          companyId: item.companyId,
          type: item.type,
          isActive: item.isActive,
        });
        await manager.save(link);

        // Cargo único por empresa (ADR 0005 §5) — na MESMA transação.
        if (item.roleId) {
          const userRole = manager.create(UserRoleOrmEntity, {
            userId: savedUser.id,
            companyId: item.companyId,
            roleId: item.roleId,
          });
          await manager.save(userRole);
        }

        created.push(this.toDomain(savedUser));
      }

      return created;
    });
  }

  /**
   * Atualiza parcialmente a pessoa (dados da pessoa — refletem em todas as
   * empresas onde participa).
   *
   * @param id Id da pessoa.
   * @param data Campos a atualizar.
   * @returns Pessoa atualizada ou `null` se não existir.
   */
  public async updateById(
    id: string,
    data: UpdateUserRepositoryData,
  ): Promise<UserEntity | null> {
    const orm = await this.userRepo.findOne({ where: { id } });
    if (!orm) {
      return null;
    }

    if (data.name !== undefined) {
      orm.name = data.name;
    }
    if (data.email !== undefined) {
      orm.email = data.email;
    }
    if (data.phone !== undefined) {
      orm.phone = data.phone;
    }
    if (data.document !== undefined) {
      orm.document = data.document;
    }

    const saved = await this.userRepo.save(orm);
    return this.toDomain(saved);
  }

  /**
   * Altera o hash da senha da pessoa (troca de senha — provisoriamente por
   * `MANAGE_USERS`; vale para todos os vínculos da pessoa).
   *
   * @param id Id da pessoa.
   * @param passwordHash Novo hash bcrypt.
   * @returns Promise resolvida quando a senha é gravada.
   */
  public async updatePasswordById(
    id: string,
    passwordHash: string,
  ): Promise<void> {
    await this.userRepo.update({ id }, { password: passwordHash });
  }

  /**
   * Exclui a participação do usuário na empresa — em uma transação remove o
   * cargo (`user_role`) e o vínculo (`user_company`). Se for a **última
   * empresa** da pessoa (nenhum outro vínculo restante) **e a pessoa não tiver
   * histórico operacional**, exclui também a pessoa (`user`).
   *
   * @param userId Id da pessoa.
   * @param companyId Empresa da sessão.
   * @param linkId Id do vínculo `user_company` a remover.
   * @returns `true` se a pessoa também foi excluída; `false` se a pessoa
   * permanece (tem outra empresa ou histórico operacional).
   */
  public async removeCompanyLink(
    userId: string,
    companyId: string,
    linkId: string,
  ): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      await manager.delete(UserRoleOrmEntity, { userId, companyId });
      await manager.delete(UserCompanyOrmEntity, { id: linkId });

      const remainingLinks = await manager.count(UserCompanyOrmEntity, {
        where: { userId },
      });
      if (remainingLinks > 0) {
        return false;
      }

      const hasReferences = await this.hasOperationalReferences(
        manager,
        userId,
      );
      if (hasReferences) {
        return false;
      }

      await manager.delete(UserOrmEntity, { id: userId });
      return true;
    });
  }

  /**
   * Verifica se a pessoa tem referências operacionais (histórico) em outras
   * tabelas — impede a exclusão da pessoa sem destruir histórico.
   *
   * @param manager EntityManager (vê o estado da transação).
   * @param userId Id da pessoa.
   * @returns `true` se alguma tabela referenciar a pessoa.
   */
  private async hasOperationalReferences(
    manager: EntityManager,
    userId: string,
  ): Promise<boolean> {
    const references: Array<[string, string]> = [
      ['user_vehicle', 'user_id'],
      ['vehicle_qr_code', 'issued_by'],
      ['vehicle_block', 'blocked_by'],
      ['vehicle_block', 'revoked_by'],
      ['entry_denial', 'doorman_id'],
      ['block_request', 'requested_by'],
      ['block_request', 'handled_by'],
      ['vehicle_access', 'driver_user_id'],
      ['vehicle_access', 'closed_by'],
      ['vehicle_movement', 'driver_user_id'],
      ['vehicle_movement', 'doorman_id'],
      ['access_request', 'user_id'],
      ['access_request', 'authorized_by'],
      ['access_request', 'requested_by'],
      ['access_request', 'handled_by'],
      ['access_request', 'resolved_user_id'],
      ['import_job', 'created_by'],
    ];

    const checks = references
      .map(
        ([table, column]) =>
          `EXISTS (SELECT 1 FROM "${table}" WHERE "${column}" = $1)`,
      )
      .join(' OR ');

    const rows: Array<{ has_refs: boolean }> = await manager.query(
      `SELECT ${checks} AS "has_refs"`,
      [userId],
    );

    return rows[0]?.has_refs ?? false;
  }

  /**
   * Mapeia a ORM entity para a entidade de domínio.
   *
   * @param orm Registro ORM da pessoa.
   * @returns Pessoa de domínio.
   */
  private toDomain(orm: UserOrmEntity): UserEntity {
    return {
      id: orm.id,
      name: orm.name,
      email: orm.email,
      passwordHash: orm.password,
      phone: orm.phone,
      document: orm.document,
      photoUrl: orm.photoUrl,
      lastLoginAt: orm.lastLoginAt,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    };
  }
}
