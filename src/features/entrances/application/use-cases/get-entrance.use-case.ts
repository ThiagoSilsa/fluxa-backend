// NestJS
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

// Repository
import { ENTRANCE_REPOSITORY } from '../../domain/repositories/entrance.repository';

// Mapper
import { toEntranceResponse } from '../utils/entrance-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { EntranceResponse } from '../dto/entrance-response';
import type { GetEntranceInputDto } from '../dto/get-entrance-input.dto';
import type { EntranceRepository } from '../../domain/repositories/entrance.repository';

/**
 * Busca uma portaria por id na empresa da sessão.
 */
@Injectable()
export class GetEntranceUseCase {
  private readonly logger = new Logger(GetEntranceUseCase.name);

  constructor(
    @Inject(ENTRANCE_REPOSITORY)
    private readonly entranceRepository: EntranceRepository,
  ) {}

  /**
   * Detalha uma portaria da empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Id da portaria.
   * @returns Portaria da empresa.
   * @throws {NotFoundException} Quando a portaria não existe na empresa
   * (cross-tenant não é revelado — mesma resposta, ADR 0006 §1).
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: GetEntranceInputDto,
  ): Promise<EntranceResponse> {
    const entrance = await this.entranceRepository.findByIdAndCompanyId(
      input.id,
      actor.companyId,
    );
    if (!entrance) {
      throw new NotFoundException('Portaria não encontrada.');
    }
    return toEntranceResponse(entrance);
  }
}
