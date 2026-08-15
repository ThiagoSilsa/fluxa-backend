// NestJS
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

// Types
import type { UserCompanyEntity } from '../../../domain/entities/user-company.entity';
import type {
  CreateUserCompanyRepositoryData,
  ListUsersRepositoryFilters,
  UpdateUserCompanyRepositoryData,
  UserCompanyRepository,
  UserCompanyWithUserEntity,
} from '../../../domain/repositories/user-company.repository';

// TypeORM
import { UserCompanyOrmEntity } from '../../../../users/infrastructure/persistence/typeorm/user-company.orm-entity';

/**
 * Implementação TypeORM do `UserCompanyRepository` (vínculos pessoa ↔ empresa).
 */
@Injectable()
export class UserCompanyTypeormRepository implements UserCompanyRepository {
  constructor(
    @InjectRepository(UserCompanyOrmEntity)
    private readonly userCompanyRepo: Repository<UserCompanyOrmEntity>,
  ) {}

  /**
   * Vínculos ativos da pessoa (com empresa ativa), para o seletor de empresa.
   *
   * @param userId Id da pessoa.
   * @returns Vínculos ativos ordenados pelo nome da empresa.
   */
  public async findActiveByUserId(
    userId: string,
  ): Promise<UserCompanyEntity[]> {
    const links = await this.userCompanyRepo.find({
      where: { userId, isActive: true },
      relations: { company: true },
    });
    return links
      .filter((link) => link.company?.isActive === true)
      .map((link) => this.toDomain(link))
      .sort((a, b) => a.companyName.localeCompare(b.companyName));
  }

  /**
   * Verifica se a pessoa tem vínculo ativo com a empresa (e a empresa ativa).
   *
   * @param userId Id da pessoa.
   * @param companyId Id da empresa.
   * @returns `true` se o vínculo ativo existir e a empresa estiver ativa.
   */
  public async existsActive(
    userId: string,
    companyId: string,
  ): Promise<boolean> {
    const link = await this.userCompanyRepo.findOne({
      where: { userId, companyId, isActive: true },
      relations: { company: true },
    });
    return link !== null && link.company?.isActive === true;
  }

  /**
   * Quantidade de vínculos ativos da pessoa (com empresa ativa).
   *
   * @param userId Id da pessoa.
   * @returns Número de vínculos ativos (0 = não entra em lugar nenhum).
   */
  public async countActiveByUserId(userId: string): Promise<number> {
    const links = await this.userCompanyRepo.find({
      where: { userId, isActive: true },
      relations: { company: true },
    });
    return links.filter((link) => link.company?.isActive === true).length;
  }

  /**
   * Busca o vínculo da pessoa com a empresa (com dados da pessoa) — usado
   * pela feature `users` (detalhe, validação de vínculo nas operações).
   *
   * @param userId Id da pessoa.
   * @param companyId Id da empresa da sessão.
   * @returns Pessoa + vínculo, ou `null` se o vínculo não existir.
   */
  public async findByUserIdAndCompanyId(
    userId: string,
    companyId: string,
  ): Promise<UserCompanyWithUserEntity | null> {
    const link = await this.userCompanyRepo.findOne({
      where: { userId, companyId },
      relations: { user: true },
    });
    return link ? this.toDomainWithUser(link) : null;
  }

  /**
   * Verifica se a pessoa já tem vínculo com a empresa (ativo ou inativo).
   *
   * @param userId Id da pessoa.
   * @param companyId Id da empresa da sessão.
   * @returns `true` se o vínculo existir (independente de `is_active`).
   */
  public async existsByUserIdAndCompanyId(
    userId: string,
    companyId: string,
  ): Promise<boolean> {
    const count = await this.userCompanyRepo.count({
      where: { userId, companyId },
    });
    return count > 0;
  }

  /**
   * Lista os usuários com vínculo na empresa (paginado, com busca e filtros).
   *
   * @param companyId Id da empresa da sessão.
   * @param filters Filtros e paginação.
   * @returns Página de usuários e total sem paginação.
   */
  public async listByCompanyId(
    companyId: string,
    filters: ListUsersRepositoryFilters,
  ): Promise<{ data: UserCompanyWithUserEntity[]; count: number }> {
    const qb = this.userCompanyRepo
      .createQueryBuilder('uc')
      .innerJoinAndSelect('uc.user', 'u')
      .where('uc.company_id = :companyId', { companyId });

    if (filters.search) {
      qb.andWhere('(u.name ILIKE :search OR u.email ILIKE :search)', {
        search: `%${filters.search}%`,
      });
    }
    if (filters.type) {
      qb.andWhere('uc.type = :type', { type: filters.type });
    }
    if (filters.isActive !== undefined) {
      qb.andWhere('uc.is_active = :isActive', { isActive: filters.isActive });
    }

    qb.orderBy('u.name', 'ASC')
      .addOrderBy('u.email', 'ASC')
      .skip(filters.offset)
      .take(filters.limit);

    const [rows, count] = await qb.getManyAndCount();
    return { data: rows.map((row) => this.toDomainWithUser(row)), count };
  }

  /**
   * Cria um vínculo pessoa ↔ empresa (usado ao vincular pessoa já existente).
   *
   * @param data Dados do vínculo (inclui `companyId` da sessão).
   * @returns Vínculo criado.
   */
  public async create(
    data: CreateUserCompanyRepositoryData,
  ): Promise<UserCompanyEntity> {
    const orm = this.userCompanyRepo.create({
      userId: data.userId,
      companyId: data.companyId,
      type: data.type,
      isActive: data.isActive,
    });
    const saved = await this.userCompanyRepo.save(orm);
    return this.toDomain(saved);
  }

  /**
   * Atualiza o vínculo (`type`/`is_active`).
   *
   * @param id Id do vínculo.
   * @param data Campos a atualizar.
   * @returns Vínculo atualizado ou `null` se não existir.
   */
  public async updateById(
    id: string,
    data: UpdateUserCompanyRepositoryData,
  ): Promise<UserCompanyEntity | null> {
    const orm = await this.userCompanyRepo.findOne({ where: { id } });
    if (!orm) {
      return null;
    }
    if (data.type !== undefined) {
      orm.type = data.type;
    }
    if (data.isActive !== undefined) {
      orm.isActive = data.isActive;
    }
    const saved = await this.userCompanyRepo.save(orm);
    return this.toDomain(saved);
  }

  /**
   * Mapeia ORM (vínculo + empresa) para a entidade de domínio.
   *
   * @param link Vínculo pessoa ↔ empresa (ORM).
   * @returns Vínculo de domínio.
   */
  private toDomain(link: UserCompanyOrmEntity): UserCompanyEntity {
    return {
      id: link.id,
      userId: link.userId,
      companyId: link.companyId,
      companyName: link.company?.name ?? '',
      type: link.type,
      isActive: link.isActive,
    };
  }

  /**
   * Mapeia ORM (vínculo + pessoa) para a entidade de domínio com dados da
   * pessoa (listagem/detalhe da feature `users`).
   *
   * @param link Vínculo pessoa ↔ empresa (ORM) com `user` carregado.
   * @returns Pessoa + vínculo de domínio.
   */
  private toDomainWithUser(
    link: UserCompanyOrmEntity,
  ): UserCompanyWithUserEntity {
    return {
      linkId: link.id,
      userId: link.userId,
      name: link.user?.name ?? '',
      email: link.user?.email ?? '',
      phone: link.user?.phone ?? null,
      document: link.user?.document ?? null,
      observation: link.user?.observation ?? null,
      photoUrl: link.user?.photoUrl ?? null,
      type: link.type,
      isActive: link.isActive,
    };
  }
}
