// NestJS
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

// Shared
import { PermissionCode } from '../../../../shared/constants/access-control.constant';
import {
  isValidBrazilianPlate,
  normalizePlate,
} from '../../../../shared/utils/plate.util';

// Repositories
import { VEHICLE_TYPE_REPOSITORY } from '../../domain/repositories/vehicle-type.repository';
import { VEHICLE_REPOSITORY } from '../../domain/repositories/vehicle.repository';

// Mapper
import { toVehicleResponse } from '../utils/vehicle-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { VehicleTypeRepository } from '../../domain/repositories/vehicle-type.repository';
import type { VehicleRepository } from '../../domain/repositories/vehicle.repository';
import type { UpdateVehicleInputDto } from '../dto/update-vehicle-input.dto';
import type { VehicleResponse } from '../dto/vehicle-response';

/**
 * Atualiza um veículo da empresa da sessão (PATCH parcial — ADR 0006 §§3–6).
 *
 * - `is_blocked` é derivado — rejeitado (400) se enviado;
 * - `free_pass = true` exige `GRANT_FREE_PASS` (além de `MANAGE_VEHICLES`) →
 *   403;
 * - `plate` é normalizada e validada (400) — conflito → 409;
 * - `vehicle_type_id` deve existir na empresa (404) e estar ativo (400);
 * - Violação de unique (placa em concorrência) é traduzida em 409.
 */
@Injectable()
export class UpdateVehicleUseCase {
  private readonly logger = new Logger(UpdateVehicleUseCase.name);

  constructor(
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: VehicleRepository,
    @Inject(VEHICLE_TYPE_REPOSITORY)
    private readonly vehicleTypeRepository: VehicleTypeRepository,
  ) {}

  /**
   * Atualiza o veículo da empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Id e campos a atualizar.
   * @returns Veículo atualizado com o tipo agregado.
   * @throws {BadRequestException} Placa inválida, tipo inativo ou
   * `is_blocked` enviado.
   * @throws {ForbiddenException} `free_pass = true` sem `GRANT_FREE_PASS`.
   * @throws {NotFoundException} Veículo ou tipo não existe na empresa.
   * @throws {ConflictException} Placa já cadastrada (concorrência).
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: UpdateVehicleInputDto,
  ): Promise<VehicleResponse> {
    const existing = await this.vehicleRepository.findByIdAndCompanyId(
      input.id,
      actor.companyId,
    );
    if (!existing) {
      throw new NotFoundException('Veículo não encontrado.');
    }
    if (input.isBlocked !== undefined) {
      throw new BadRequestException(
        'O campo is_blocked é derivado do bloqueio e não pode ser definido pelo cadastro.',
      );
    }
    if (input.freePass === true) {
      this.ensureFreePassAllowed(actor);
    }

    let plate: string | undefined;
    if (input.plate !== undefined) {
      plate = normalizePlate(input.plate);
      if (!isValidBrazilianPlate(plate)) {
        throw new BadRequestException('Placa em formato inválido.');
      }
    }

    if (input.vehicleTypeId !== undefined) {
      await this.ensureActiveVehicleType(input.vehicleTypeId, actor.companyId);
    }

    try {
      const updated = await this.vehicleRepository.updateByIdAndCompanyId(
        input.id,
        actor.companyId,
        {
          plate,
          model: input.model,
          color: input.color,
          observation: input.observation,
          freePass: input.freePass,
          vehicleTypeId: input.vehicleTypeId,
          isActive: input.isActive,
        },
      );
      if (!updated) {
        throw new NotFoundException('Veículo não encontrado.');
      }
    } catch (error) {
      if (error instanceof QueryFailedError) {
        throw new ConflictException('Placa já cadastrada para esta empresa.');
      }
      throw error;
    }

    const withType = await this.vehicleRepository.findByIdAndCompanyId(
      input.id,
      actor.companyId,
    );
    if (!withType) {
      throw new NotFoundException('Veículo não encontrado.');
    }
    return toVehicleResponse(withType);
  }

  /**
   * Valida a concessão de livre acesso: `free_pass = true` exige
   * `GRANT_FREE_PASS` (ou `is_admin` — bypass do ADR 0004 §2).
   *
   * @param actor Ator autenticado.
   * @throws {ForbiddenException} Concessão sem a permissão específica.
   */
  private ensureFreePassAllowed(actor: AuthenticatedUserEntity): void {
    if (
      !actor.isAdmin &&
      !actor.permissions.includes(PermissionCode.GRANT_FREE_PASS)
    ) {
      throw new ForbiddenException(
        'Conceder livre acesso exige permissão específica.',
      );
    }
  }

  /**
   * Valida que o tipo de veículo existe na empresa e está ativo.
   *
   * @param vehicleTypeId Id do tipo.
   * @param companyId Empresa da sessão.
   * @throws {NotFoundException} Tipo inexistente ou de outro tenant.
   * @throws {BadRequestException} Tipo inativo.
   */
  private async ensureActiveVehicleType(
    vehicleTypeId: string,
    companyId: string,
  ): Promise<void> {
    const type = await this.vehicleTypeRepository.findByIdAndCompanyId(
      vehicleTypeId,
      companyId,
    );
    if (!type) {
      throw new NotFoundException('Tipo de veículo não encontrado.');
    }
    if (!type.isActive) {
      throw new BadRequestException(
        'Tipo de veículo inativo não pode ser usado.',
      );
    }
  }
}
