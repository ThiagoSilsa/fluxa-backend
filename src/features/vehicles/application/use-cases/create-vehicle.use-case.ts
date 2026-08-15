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
import type {
  VehicleEntity,
  VehicleWithTypeEntity,
} from '../../domain/entities/vehicle.entity';
import type { VehicleTypeRepository } from '../../domain/repositories/vehicle-type.repository';
import type { VehicleRepository } from '../../domain/repositories/vehicle.repository';
import type { CreateVehicleInputDto } from '../dto/create-vehicle-input.dto';
import type { VehicleResponse } from '../dto/vehicle-response';

/**
 * Cria um veículo na empresa da sessão (ADR 0006 §§3–6).
 *
 * - Placa normalizada e validada (formato brasileiro antigo/Mercosul) → 400;
 * - `free_pass = true` exige `GRANT_FREE_PASS` (além de `MANAGE_VEHICLES`) →
 *   403;
 * - `is_blocked` é derivado — rejeitado (400) se enviado;
 * - `vehicle_type_id` deve existir na empresa (404) e estar ativo (400);
 * - Placa duplicada → 409 (tradução do unique; nunca 500 cru).
 */
@Injectable()
export class CreateVehicleUseCase {
  private readonly logger = new Logger(CreateVehicleUseCase.name);

  constructor(
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: VehicleRepository,
    @Inject(VEHICLE_TYPE_REPOSITORY)
    private readonly vehicleTypeRepository: VehicleTypeRepository,
  ) {}

  /**
   * Cria o veículo com `companyId` da sessão.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Dados de criação (placa, tipo, campos opcionais).
   * @returns Veículo criado com o tipo agregado.
   * @throws {BadRequestException} Placa inválida, tipo inativo ou
   * `is_blocked` enviado.
   * @throws {ForbiddenException} `free_pass = true` sem `GRANT_FREE_PASS`.
   * @throws {NotFoundException} Tipo de veículo não existe na empresa.
   * @throws {ConflictException} Placa já cadastrada (concorrência).
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: CreateVehicleInputDto,
  ): Promise<VehicleResponse> {
    const plate = normalizePlate(input.plate);
    if (!isValidBrazilianPlate(plate)) {
      throw new BadRequestException('Placa em formato inválido.');
    }
    if (input.isBlocked !== undefined) {
      throw new BadRequestException(
        'O campo is_blocked é derivado do bloqueio e não pode ser definido pelo cadastro.',
      );
    }
    this.ensureFreePassAllowed(actor, input.freePass);

    const type = await this.vehicleTypeRepository.findByIdAndCompanyId(
      input.vehicleTypeId,
      actor.companyId,
    );
    if (!type) {
      throw new NotFoundException('Tipo de veículo não encontrado.');
    }
    if (!type.isActive) {
      throw new BadRequestException(
        'Tipo de veículo inativo não pode ser usado.',
      );
    }

    let saved: VehicleEntity;
    try {
      saved = await this.vehicleRepository.create({
        plate,
        companyId: actor.companyId,
        model: input.model ?? null,
        color: input.color ?? null,
        observation: input.observation ?? null,
        freePass: input.freePass,
        vehicleTypeId: input.vehicleTypeId,
      });
    } catch (error) {
      if (error instanceof QueryFailedError) {
        throw new ConflictException('Placa já cadastrada para esta empresa.');
      }
      throw error;
    }

    const withType: VehicleWithTypeEntity = {
      ...saved,
      vehicleType: {
        id: type.id,
        code: type.code,
        name: type.name,
        isFleet: type.isFleet,
      },
    };
    return toVehicleResponse(withType);
  }

  /**
   * Valida a concessão de livre acesso: `free_pass = true` exige
   * `GRANT_FREE_PASS` (ou `is_admin` — bypass do ADR 0004 §2).
   *
   * @param actor Ator autenticado.
   * @param freePass Valor enviado no body.
   * @throws {ForbiddenException} Concessão sem a permissão específica.
   */
  private ensureFreePassAllowed(
    actor: AuthenticatedUserEntity,
    freePass: boolean,
  ): void {
    if (
      freePass === true &&
      !actor.isAdmin &&
      !actor.permissions.includes(PermissionCode.GRANT_FREE_PASS)
    ) {
      throw new ForbiddenException(
        'Conceder livre acesso exige permissão específica.',
      );
    }
  }
}
