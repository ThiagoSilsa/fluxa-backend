// NestJS
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

// Repository
import { DEVICE_REPOSITORY } from '../../domain/repositories/device.repository';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { DeviceRepository } from '../../domain/repositories/device.repository';
import type { GetDeviceInputDto } from '../dto/get-device-input.dto';

/**
 * Exclui fisicamente um dispositivo da empresa da sessão.
 *
 * Diferente dos catálogos de `vehicle_type`/`department`/`entrance`/`vehicle`
 * (ADR 0006 §2), o `device` **não tem FK de referência** — a exclusão física
 * é permitida (204); a suspensão reversível continua disponível via `PATCH`
 * com `isActive: false` (ADR 0008 §6).
 */
@Injectable()
export class DeleteDeviceUseCase {
  private readonly logger = new Logger(DeleteDeviceUseCase.name);

  constructor(
    @Inject(DEVICE_REPOSITORY)
    private readonly deviceRepository: DeviceRepository,
  ) {}

  /**
   * Exclui o dispositivo da empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Id do dispositivo.
   * @throws {NotFoundException} Quando o dispositivo não existe na empresa.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: GetDeviceInputDto,
  ): Promise<void> {
    const existing = await this.deviceRepository.findByIdAndCompanyId(
      input.id,
      actor.companyId,
    );
    if (!existing) {
      throw new NotFoundException('Dispositivo não encontrado.');
    }

    const deleted = await this.deviceRepository.deleteByIdAndCompanyId(
      input.id,
      actor.companyId,
    );
    if (!deleted) {
      throw new NotFoundException('Dispositivo não encontrado.');
    }
  }
}
