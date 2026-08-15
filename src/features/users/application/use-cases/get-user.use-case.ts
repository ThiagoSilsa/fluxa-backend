// NestJS
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

// Repository
import { USER_COMPANY_REPOSITORY } from '../../../auth/domain/repositories/user-company.repository';

// Mapper
import { toUserResponse } from '../utils/user-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { UserCompanyRepository } from '../../../auth/domain/repositories/user-company.repository';
import type { GetUserInputDto } from '../dto/get-user-input.dto';
import type { UserResponse } from '../dto/user-response';

/**
 * Detalha um usuário com vínculo na empresa da sessão.
 *
 * Escopo por `user_company` (ADR 0002): usuário de outra empresa → 404 (não
 * revela se a pessoa existe em outro lugar).
 */
@Injectable()
export class GetUserUseCase {
  private readonly logger = new Logger(GetUserUseCase.name);

  constructor(
    @Inject(USER_COMPANY_REPOSITORY)
    private readonly userCompanyRepository: UserCompanyRepository,
  ) {}

  /**
   * Busca o usuário (pessoa + vínculo) na empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Id da pessoa.
   * @returns Dados do usuário.
   * @throws {NotFoundException} Quando o usuário não tem vínculo com a empresa.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: GetUserInputDto,
  ): Promise<UserResponse> {
    const link = await this.userCompanyRepository.findByUserIdAndCompanyId(
      input.id,
      actor.companyId,
    );
    if (!link) {
      throw new NotFoundException('Usuário não encontrado.');
    }
    return toUserResponse(link);
  }
}
