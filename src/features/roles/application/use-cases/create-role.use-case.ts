// NestJS
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';

// Repository
import { ROLE_REPOSITORY } from '../../domain/repositories/role.repository';

// Mapper
import { toRoleResponse } from '../utils/role-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { CreateRoleInputDto } from '../dto/create-role-input.dto';
import type { RoleResponse } from '../dto/role-response';
import type { RoleRepository } from '../../domain/repositories/role.repository';

/**
 * Cria um cargo na empresa da sessão.
 *
 * Cargos com `is_admin` são proibidos pelo CRUD (ADR 0004): o cargo de
 * administração é responsabilidade do sistema (seed; no futuro, criado
 * automaticamente ao criar empresa).
 */
@Injectable()
export class CreateRoleUseCase {
  private readonly logger = new Logger(CreateRoleUseCase.name);

  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: RoleRepository,
  ) {}

  /**
   * Cria o cargo com `companyId` da sessão e `isAdmin = false`.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Dados de criação (nome, descrição opcional).
   * @returns Cargo criado.
   * @throws {BadRequestException} Quando `input.isAdmin` é `true`.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: CreateRoleInputDto,
  ): Promise<RoleResponse> {
    if (input.isAdmin === true) {
      throw new BadRequestException(
        'Cargos de administração não podem ser criados.',
      );
    }

    const role = await this.roleRepository.create({
      companyId: actor.companyId,
      name: input.name,
      description: input.description ?? null,
      isAdmin: false,
    });

    return toRoleResponse(role);
  }
}
