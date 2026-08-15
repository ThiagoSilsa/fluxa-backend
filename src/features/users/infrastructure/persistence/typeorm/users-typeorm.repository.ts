// NestJS
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

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
        observation: data.observation,
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
    if (data.observation !== undefined) {
      orm.observation = data.observation;
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
      observation: orm.observation,
      photoUrl: orm.photoUrl,
      lastLoginAt: orm.lastLoginAt,
      createdAt: orm.createdAt,
      updatedAt: orm.updatedAt,
    };
  }
}
