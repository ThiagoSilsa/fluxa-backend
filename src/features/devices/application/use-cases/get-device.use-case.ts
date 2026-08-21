// NestJS
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

// Repository
import { DEVICE_REPOSITORY } from '../../domain/repositories/device.repository';

// Mapper
import { toDeviceResponse } from '../utils/device-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { DeviceRepository } from '../../domain/repositories/device.repository';
import type { GetDeviceInputDto } from '../dto/get-device-input.dto';
import type { DeviceResponse } from '../dto/device-response';

/**
 * Busca um dispositivo por id na empresa da sessão.
 */
@Injectable()
export class GetDeviceUseCase {
  private readonly logger = new Logger(GetDeviceUseCase.name);

  constructor(
    @Inject(DEVICE_REPOSITORY)
    private readonly deviceRepository: DeviceRepository,
  ) {}

  /**
   * Detalha um dispositivo da empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Id do dispositivo.
   * @returns Dispositivo da empresa.
   * @throws {NotFoundException} Quando o dispositivo não existe na empresa
   * (cross-tenant não é revelado — mesma resposta, ADR 0008 §1).
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: GetDeviceInputDto,
  ): Promise<DeviceResponse> {
    const device = await this.deviceRepository.findByIdAndCompanyId(
      input.id,
      actor.companyId,
    );
    if (!device) {
      throw new NotFoundException('Dispositivo não encontrado.');
    }
    return toDeviceResponse(device);
  }
}
