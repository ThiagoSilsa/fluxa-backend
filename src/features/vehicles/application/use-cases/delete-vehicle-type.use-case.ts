// NestJS
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

// Repository
import { VEHICLE_TYPE_REPOSITORY } from '../../domain/repositories/vehicle-type.repository';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { GetVehicleTypeInputDto } from '../dto/get-vehicle-type-input.dto';
import type { VehicleTypeRepository } from '../../domain/repositories/vehicle-type.repository';

/**
 * Exclui fisicamente um tipo de veículo da empresa da sessão.
 *
 * A exclusão é **bloqueada (409)** quando há veículos da empresa usando o
 * tipo (FK `vehicle.vehicle_type_id` — ADR 0006 §6); sem referências, o
 * registro é removido de vez. A suspensão reversível continua disponível via
 * `PATCH` com `isActive: false`.
 */
@Injectable()
export class DeleteVehicleTypeUseCase {
  private readonly logger = new Logger(DeleteVehicleTypeUseCase.name);

  constructor(
    @Inject(VEHICLE_TYPE_REPOSITORY)
    private readonly vehicleTypeRepository: VehicleTypeRepository,
  ) {}

  /**
   * Exclui o tipo da empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Id do tipo.
   * @throws {NotFoundException} Quando o tipo não existe na empresa.
   * @throws {ConflictException} Quando há veículos da empresa usando o tipo.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: GetVehicleTypeInputDto,
  ): Promise<void> {
    const existing = await this.vehicleTypeRepository.findByIdAndCompanyId(
      input.id,
      actor.companyId,
    );
    if (!existing) {
      throw new NotFoundException('Tipo de veículo não encontrado.');
    }

    const vehiclesUsing =
      await this.vehicleTypeRepository.countVehiclesByTypeIdAndCompanyId(
        input.id,
        actor.companyId,
      );
    if (vehiclesUsing > 0) {
      throw new ConflictException(
        'Tipo de veículo em uso por veículos e não pode ser excluído.',
      );
    }

    const deleted = await this.vehicleTypeRepository.deleteByIdAndCompanyId(
      input.id,
      actor.companyId,
    );
    if (!deleted) {
      throw new NotFoundException('Tipo de veículo não encontrado.');
    }
  }
}
