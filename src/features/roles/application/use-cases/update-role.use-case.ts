// NestJS
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

// Repository
import { ROLE_REPOSITORY } from '../../domain/repositories/role.repository';

// Mapper
import { toRoleResponse } from '../utils/role-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { RoleResponse } from '../dto/role-response';
import type { UpdateRoleInputDto } from '../dto/update-role-input.dto';
import type {
  RoleRepository,
  UpdateRoleRepositoryData,
} from '../../domain/repositories/role.repository';

/**
 * Atualiza nome/descrição/isActive de um cargo da empresa da sessão.
 *
 * `isAdmin` não é alterável pelo CRUD (ADR 0004) e cargos de administração são
 * imutáveis.
 */
@Injectable()
export class UpdateRoleUseCase {
  private readonly logger = new Logger(UpdateRoleUseCase.name);

  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: RoleRepository,
  ) {}

  /**
   * Atualiza o cargo (nome/descrição/isActive) da empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Id e campos a atualizar.
   * @returns Cargo atualizado.
   * @throws {NotFoundException} Quando o cargo não existe na empresa.
   * @throws {BadRequestException} Quando o cargo é `is_admin` (imutável).
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: UpdateRoleInputDto,
  ): Promise<RoleResponse> {
    const existing = await this.roleRepository.findByIdAndCompanyId(
      input.id,
      actor.companyId,
    );
    if (!existing) {
      throw new NotFoundException('Cargo não encontrado.');
    }
    if (existing.isAdmin) {
      throw new BadRequestException(
        'Cargos de administração não podem ser editados.',
      );
    }

    const data: UpdateRoleRepositoryData = {
      name: input.name,
      description: input.description,
    };
    if (input.isActive !== undefined) {
      data.isActive = input.isActive;
    }

    const updated = await this.roleRepository.updateByIdAndCompanyId(
      input.id,
      actor.companyId,
      data,
    );
    if (!updated) {
      throw new NotFoundException('Cargo não encontrado.');
    }
    return toRoleResponse(updated);
  }
}
