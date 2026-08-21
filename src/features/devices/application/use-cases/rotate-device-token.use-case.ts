// NestJS
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

// Repository
import { DEVICE_REPOSITORY } from '../../domain/repositories/device.repository';

// Mapper
import { toDeviceResponse } from '../utils/device-response.mapper';

// Utils
import { buildDeviceWithEntrance } from '../utils/build-device-with-entrance';
import { generateDeviceToken } from '../utils/generate-device-token';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { DeviceRepository } from '../../domain/repositories/device.repository';
import type { GetDeviceInputDto } from '../dto/get-device-input.dto';
import type { DeviceWithTokenResponse } from '../dto/device-response';

/**
 * Rotaciona o token de um dispositivo da empresa da sessão.
 *
 * Gera um novo token (mesmo mecanismo da criação) e o devolve **uma única
 * vez** nesta resposta; o token anterior deixa de valer (o aparelho antigo
 * para de sincronizar na fase do sync — ADR 0008 §3). O dispositivo mantém
 * id, nome, plataforma, vínculo e status.
 */
@Injectable()
export class RotateDeviceTokenUseCase {
  private readonly logger = new Logger(RotateDeviceTokenUseCase.name);

  constructor(
    @Inject(DEVICE_REPOSITORY)
    private readonly deviceRepository: DeviceRepository,
  ) {}

  /**
   * Rotaciona o token do dispositivo da empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Id do dispositivo.
   * @returns Dispositivo atualizado + novo token (exibido uma única vez).
   * @throws {NotFoundException} Quando o dispositivo não existe na empresa.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: GetDeviceInputDto,
  ): Promise<DeviceWithTokenResponse> {
    const existing = await this.deviceRepository.findByIdAndCompanyId(
      input.id,
      actor.companyId,
    );
    if (!existing) {
      throw new NotFoundException('Dispositivo não encontrado.');
    }

    const token = generateDeviceToken();
    const updated = await this.deviceRepository.rotateTokenByIdAndCompanyId(
      input.id,
      actor.companyId,
      token,
    );
    if (!updated) {
      throw new NotFoundException('Dispositivo não encontrado.');
    }

    return {
      device: toDeviceResponse(
        buildDeviceWithEntrance(updated, existing.entrance),
      ),
      token,
    };
  }
}
