// NestJS
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

// Repository
import { VEHICLE_REPOSITORY } from '../../domain/repositories/vehicle.repository';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { GetVehicleInputDto } from '../dto/get-vehicle-input.dto';
import type { VehicleRepository } from '../../domain/repositories/vehicle.repository';

/**
 * Exclui fisicamente um veículo da empresa da sessão.
 *
 * A exclusão é **bloqueada (409)** quando há vínculos da empresa apontando
 * para o veículo — `vehicle_department` (departamento padrão) ou `user_vehicle`
 * (motoristas) — ADR 0006 §9/§10; sem vínculos, o registro é removido de vez.
 * A suspensão reversível continua disponível via `PATCH` com `isActive: false`.
 */
@Injectable()
export class DeleteVehicleUseCase {
  private readonly logger = new Logger(DeleteVehicleUseCase.name);

  constructor(
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: VehicleRepository,
  ) {}

  /**
   * Exclui o veículo da empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Id do veículo.
   * @throws {NotFoundException} Quando o veículo não existe na empresa.
   * @throws {ConflictException} Quando há vínculos (departamento padrão ou
   * motoristas) referenciando o veículo.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: GetVehicleInputDto,
  ): Promise<void> {
    const existing = await this.vehicleRepository.findByIdAndCompanyId(
      input.id,
      actor.companyId,
    );
    if (!existing) {
      throw new NotFoundException('Veículo não encontrado.');
    }

    const linksUsing =
      await this.vehicleRepository.countVehicleLinksByVehicleIdAndCompanyId(
        input.id,
        actor.companyId,
      );
    if (linksUsing > 0) {
      throw new ConflictException(
        'Veículo em uso por vínculos e não pode ser excluído.',
      );
    }

    const deleted = await this.vehicleRepository.deleteByIdAndCompanyId(
      input.id,
      actor.companyId,
    );
    if (!deleted) {
      throw new NotFoundException('Veículo não encontrado.');
    }
  }
}
