// NestJS
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

// Repositories
import { USER_COMPANY_REPOSITORY } from '../../../auth/domain/repositories/user-company.repository';
import { USER_ROLE_REPOSITORY } from '../../domain/repositories/user-role.repository';

// Mapper
import { toUserRoleResponse } from '../utils/user-role-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { UserCompanyRepository } from '../../../auth/domain/repositories/user-company.repository';
import type { UserRoleRepository } from '../../domain/repositories/user-role.repository';
import type { ListUserRolesInputDto } from '../dto/list-user-roles-input.dto';
import type { ListUserRolesResponse } from '../dto/user-role-response';

/**
 * Lista os cargos de um usuário na empresa da sessão (ADR 0005 §5).
 *
 * Escopo por `user_company`: usuário sem vínculo com a empresa → 404.
 */
@Injectable()
export class ListUserRolesUseCase {
  private readonly logger = new Logger(ListUserRolesUseCase.name);

  constructor(
    @Inject(USER_COMPANY_REPOSITORY)
    private readonly userCompanyRepository: UserCompanyRepository,
    @Inject(USER_ROLE_REPOSITORY)
    private readonly userRoleRepository: UserRoleRepository,
  ) {}

  /**
   * Lista os cargos do usuário na empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Id da pessoa.
   * @returns Cargos do usuário na empresa.
   * @throws {NotFoundException} Usuário sem vínculo com a empresa.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: ListUserRolesInputDto,
  ): Promise<ListUserRolesResponse> {
    const link = await this.userCompanyRepository.findByUserIdAndCompanyId(
      input.userId,
      actor.companyId,
    );
    if (!link) {
      throw new NotFoundException('Usuário não encontrado.');
    }

    const roles = await this.userRoleRepository.listByUserIdAndCompanyId(
      input.userId,
      actor.companyId,
    );

    return {
      userId: input.userId,
      roles: roles.map(toUserRoleResponse),
    };
  }
}
