import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserCompanyEntity } from '../../../domain/entities/user-company.entity';
import { UserCompanyRepository } from '../../../domain/repositories/user-company.repository';
import { UserCompanyOrmEntity } from './user-company.orm-entity';

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
      .map((link) => this.toEntity(link))
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
   * Mapeia ORM (vínculo + empresa) para a entidade de domínio.
   *
   * @param link Vínculo pessoa ↔ empresa (ORM).
   * @returns Vínculo de domínio.
   */
  private toEntity(link: UserCompanyOrmEntity): UserCompanyEntity {
    return {
      id: link.id,
      userId: link.userId,
      companyId: link.companyId,
      companyName: link.company?.name ?? '',
      type: link.type,
      isActive: link.isActive,
    };
  }
}
