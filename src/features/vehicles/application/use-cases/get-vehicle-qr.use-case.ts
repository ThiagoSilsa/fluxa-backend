// NestJS
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

// Repositories
import { VEHICLE_QR_REPOSITORY } from '../../domain/repositories/vehicle-qr.repository';
import { VEHICLE_REPOSITORY } from '../../domain/repositories/vehicle.repository';

// Mapper
import { toVehicleQrResponse } from '../utils/vehicle-qr-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { VehicleQrRepository } from '../../domain/repositories/vehicle-qr.repository';
import type { VehicleRepository } from '../../domain/repositories/vehicle.repository';
import type { GetVehicleQrInputDto } from '../dto/get-vehicle-qr-input.dto';
import type { VehicleQrResponse } from '../dto/vehicle-qr-response';

/**
 * Devolve o QR **ativo** de um veículo da empresa da sessão — usado para
 * **reimprimir** o mesmo adesivo (a imagem é regenerada no client a partir do
 * `code`; ADR 0009 §2/§5).
 */
@Injectable()
export class GetVehicleQrUseCase {
  private readonly logger = new Logger(GetVehicleQrUseCase.name);

  constructor(
    @Inject(VEHICLE_QR_REPOSITORY)
    private readonly vehicleQrRepository: VehicleQrRepository,
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: VehicleRepository,
  ) {}

  /**
   * Reimprime o QR ativo do veículo da empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Id do veículo.
   * @returns QR ativo (mesmo `code`).
   * @throws {NotFoundException} Veículo não existe na empresa ou não há QR
   * ativo (nunca emitido, revogado ou reemitido).
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: GetVehicleQrInputDto,
  ): Promise<VehicleQrResponse> {
    const vehicle = await this.vehicleRepository.findByIdAndCompanyId(
      input.vehicleId,
      actor.companyId,
    );
    if (!vehicle) {
      throw new NotFoundException('Veículo não encontrado.');
    }

    const qr = await this.vehicleQrRepository.findActiveByVehicleIdAndCompanyId(
      input.vehicleId,
      actor.companyId,
    );
    if (!qr) {
      throw new NotFoundException('QR code não encontrado para este veículo.');
    }

    return toVehicleQrResponse(qr);
  }
}
