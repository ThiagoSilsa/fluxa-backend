// NestJS
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

// Repositories
import { VEHICLE_QR_REPOSITORY } from '../../domain/repositories/vehicle-qr.repository';
import { VEHICLE_REPOSITORY } from '../../domain/repositories/vehicle.repository';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { VehicleQrRepository } from '../../domain/repositories/vehicle-qr.repository';
import type { VehicleRepository } from '../../domain/repositories/vehicle.repository';
import type { GetVehicleQrInputDto } from '../dto/get-vehicle-qr-input.dto';

/**
 * Revoga o QR code **ativo** de um veículo da empresa da sessão **sem**
 * emitir outro (ex.: adesivo comprometido). O QR passa a "expirado" (ADR 0009
 * §2).
 */
@Injectable()
export class RevokeVehicleQrUseCase {
  private readonly logger = new Logger(RevokeVehicleQrUseCase.name);

  constructor(
    @Inject(VEHICLE_QR_REPOSITORY)
    private readonly vehicleQrRepository: VehicleQrRepository,
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: VehicleRepository,
  ) {}

  /**
   * Revoga o QR ativo do veículo da empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Id do veículo.
   * @throws {NotFoundException} Quando o veículo não existe na empresa.
   * @throws {ConflictException} Quando não há QR ativo para revogar.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: GetVehicleQrInputDto,
  ): Promise<void> {
    const vehicle = await this.vehicleRepository.findByIdAndCompanyId(
      input.vehicleId,
      actor.companyId,
    );
    if (!vehicle) {
      throw new NotFoundException('Veículo não encontrado.');
    }

    const active =
      await this.vehicleQrRepository.findActiveByVehicleIdAndCompanyId(
        input.vehicleId,
        actor.companyId,
      );
    if (!active) {
      throw new ConflictException('Nenhum QR code ativo para revogar.');
    }

    const revoked = await this.vehicleQrRepository.deactivateByIdAndCompanyId(
      active.id,
      actor.companyId,
    );
    if (!revoked) {
      throw new NotFoundException('QR code não encontrado.');
    }
  }
}
