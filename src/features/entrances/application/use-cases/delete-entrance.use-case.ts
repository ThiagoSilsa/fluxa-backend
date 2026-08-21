// NestJS
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

// Repository
import { ENTRANCE_REPOSITORY } from '../../domain/repositories/entrance.repository';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { GetEntranceInputDto } from '../dto/get-entrance-input.dto';
import type { EntranceRepository } from '../../domain/repositories/entrance.repository';

/**
 * Exclui fisicamente uma portaria da empresa da sessão.
 *
 * A exclusão é **bloqueada (409)** quando há dispositivos da empresa
 * vinculados à portaria (tabela `device`, FK `device.entrance_id` — ADR 0006
 * §5); sem vínculos, o registro é removido de vez. A suspensão reversível
 * continua disponível via `PATCH` com `isActive: false`.
 */
@Injectable()
export class DeleteEntranceUseCase {
  private readonly logger = new Logger(DeleteEntranceUseCase.name);

  constructor(
    @Inject(ENTRANCE_REPOSITORY)
    private readonly entranceRepository: EntranceRepository,
  ) {}

  /**
   * Exclui a portaria da empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Id da portaria.
   * @throws {NotFoundException} Quando a portaria não existe na empresa.
   * @throws {ConflictException} Quando há dispositivos da empresa vinculados à
   * portaria (device).
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: GetEntranceInputDto,
  ): Promise<void> {
    const existing = await this.entranceRepository.findByIdAndCompanyId(
      input.id,
      actor.companyId,
    );
    if (!existing) {
      throw new NotFoundException('Portaria não encontrada.');
    }

    const devicesUsing =
      await this.entranceRepository.countDevicesByEntranceIdAndCompanyId(
        input.id,
        actor.companyId,
      );
    if (devicesUsing > 0) {
      throw new ConflictException(
        'Portaria em uso por dispositivos e não pode ser excluída.',
      );
    }

    const deleted = await this.entranceRepository.deleteByIdAndCompanyId(
      input.id,
      actor.companyId,
    );
    if (!deleted) {
      throw new NotFoundException('Portaria não encontrada.');
    }
  }
}
