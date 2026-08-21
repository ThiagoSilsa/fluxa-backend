// NestJS
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

// Repository
import { ROLE_REPOSITORY } from '../../domain/repositories/role.repository';

// Mapper
import { toRoleResponse } from '../utils/role-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { GetRoleInputDto } from '../dto/get-role-input.dto';
import type { RoleResponse } from '../dto/role-response';
import type { RoleRepository } from '../../domain/repositories/role.repository';

/**
 * Busca um cargo por id na empresa da sessão.
 */
@Injectable()
export class GetRoleUseCase {
  private readonly logger = new Logger(GetRoleUseCase.name);

  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: RoleRepository,
  ) {}

  /**
   * Detalha um cargo da empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Id do cargo.
   * @returns Cargo da empresa.
   * @throws {NotFoundException} Quando o cargo não existe na empresa (cross-tenant
   * não é revelado — mesma resposta).
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: GetRoleInputDto,
  ): Promise<RoleResponse> {
    const role = await this.roleRepository.findByIdAndCompanyId(
      input.id,
      actor.companyId,
    );
    if (!role) {
      throw new NotFoundException('Cargo não encontrado.');
    }
    return toRoleResponse(role);
  }
}
