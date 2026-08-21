// NestJS
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

// Node
import { randomUUID } from 'crypto';

// Shared
import {
  isValidBrazilianPlate,
  normalizePlate,
} from '../../../../shared/utils/plate.util';
import { normalizeEmail } from '../../../../shared/utils/email.util';

// Repositories
import { ACCESS_REQUEST_REPOSITORY } from '../../domain/repositories/access-request.repository';
import { USER_COMPANY_REPOSITORY } from '../../../auth/domain/repositories/user-company.repository';
import { USER_REPOSITORY } from '../../../users/domain/repositories/user.repository';
import { DEPARTMENT_REPOSITORY } from '../../../departments/domain/repositories/department.repository';
import { VEHICLE_REPOSITORY } from '../../../vehicles/domain/repositories/vehicle.repository';

// Constants
import {
  AccessRequestType,
  ContactChannel,
} from '../../domain/constants/access-request.constant';

// Mapper
import { toAccessRequestResponse } from '../utils/access-request-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { AccessRequestRepository } from '../../domain/repositories/access-request.repository';
import type { UserCompanyRepository } from '../../../auth/domain/repositories/user-company.repository';
import type { UserRepository } from '../../../users/domain/repositories/user.repository';
import type { DepartmentRepository } from '../../../departments/domain/repositories/department.repository';
import type { VehicleRepository } from '../../../vehicles/domain/repositories/vehicle.repository';
import type { CreateAccessRequestInputDto } from '../dto/create-access-request-input.dto';
import type { AccessRequestResponse } from '../dto/access-request-response';

/**
 * Cria uma solicitação de acesso pelo porteiro (`access_request`, PENDING —
 * regra 41).
 *
 * Valida o cenário (`NEW_USER`/`NEW_VEHICLE`/`LINK`/`BOTH`), o contato
 * obrigatório (regra 43), o departamento já criado (regra 46) e a
 * **duplicidade**: solicitação aberta (`PENDING`/`IN_CONTACT`) da mesma placa
 * → **409** (unique parcial).
 */
@Injectable()
export class CreateAccessRequestUseCase {
  private readonly logger = new Logger(CreateAccessRequestUseCase.name);

  constructor(
    @Inject(ACCESS_REQUEST_REPOSITORY)
    private readonly accessRequestRepository: AccessRequestRepository,
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: VehicleRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(USER_COMPANY_REPOSITORY)
    private readonly userCompanyRepository: UserCompanyRepository,
    @Inject(DEPARTMENT_REPOSITORY)
    private readonly departmentRepository: DepartmentRepository,
  ) {}

  /**
   * Cria a solicitação na empresa do ator.
   *
   * @param actor Ator autenticado (porteiro — empresa da sessão).
   * @param input Placa, cenário e dados.
   * @returns Solicitação criada (PENDING).
   * @throws {BadRequestException} Placa/cenário/contato/dados inválidos.
   * @throws {NotFoundException} Veículo/usuário/departamento não existem.
   * @throws {ConflictException} Já existe solicitação aberta da placa.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: CreateAccessRequestInputDto,
  ): Promise<AccessRequestResponse> {
    const plate = normalizePlate(input.plate);
    if (!isValidBrazilianPlate(plate)) {
      throw new BadRequestException('Placa inválida.');
    }

    const payload = input.payload ?? {};
    const contactPhone = input.contactPhone?.trim() || null;

    await this.validateScenario(actor, input, plate, payload, contactPhone);

    // Duplicidade: solicitação aberta (PENDING/IN_CONTACT) da mesma placa.
    const open = await this.accessRequestRepository.findOpenByPlateAndCompanyId(
      plate,
      actor.companyId,
    );
    if (open) {
      throw new ConflictException(
        'Já existe uma solicitação de acesso aberta para esta placa.',
      );
    }

    const request = await this.accessRequestRepository.create({
      companyId: actor.companyId,
      idempotencyKey: randomUUID(),
      type: input.type,
      plate,
      vehicleId: input.vehicleId ?? null,
      userId: input.userId ?? null,
      requestedBy: actor.id,
      contactChannel: contactPhone
        ? (input.contactChannel ?? ContactChannel.WHATSAPP)
        : null,
      contactPhone,
      departmentId: input.departmentId ?? null,
      payload,
    });

    return toAccessRequestResponse(
      request,
      { id: actor.id, name: actor.name },
      null,
      null,
    );
  }

  /**
   * Valida o cenário da solicitação (regras 41–43 e 46).
   *
   * @param actor Ator autenticado.
   * @param input Entrada do use case.
   * @param plate Placa normalizada.
   * @param payload Payload da solicitação.
   * @param contactPhone Telefone de contato (normalizado).
   */
  private async validateScenario(
    actor: AuthenticatedUserEntity,
    input: CreateAccessRequestInputDto,
    plate: string,
    payload: CreateAccessRequestInputDto['payload'],
    contactPhone: string | null,
  ): Promise<void> {
    switch (input.type) {
      case AccessRequestType.NEW_USER: {
        if (!input.vehicleId) {
          throw new BadRequestException(
            'Informe o veículo para a solicitação (NEW_USER).',
          );
        }
        const vehicle = await this.vehicleRepository.findByIdAndCompanyId(
          input.vehicleId,
          actor.companyId,
        );
        if (!vehicle) {
          throw new NotFoundException('Veículo não encontrado.');
        }
        this.requireDriverPayload(payload);
        this.requireContact(contactPhone);
        break;
      }
      case AccessRequestType.NEW_VEHICLE: {
        if (!input.userId) {
          throw new BadRequestException(
            'Informe o usuário para a solicitação (NEW_VEHICLE).',
          );
        }
        await this.requireUserInCompany(actor, input.userId);
        this.requireVehiclePayload(payload);
        this.requireContact(contactPhone);
        break;
      }
      case AccessRequestType.LINK: {
        if (!input.vehicleId || !input.userId) {
          throw new BadRequestException(
            'Informe veículo e usuário para a solicitação (LINK).',
          );
        }
        const vehicle = await this.vehicleRepository.findByIdAndCompanyId(
          input.vehicleId,
          actor.companyId,
        );
        if (!vehicle) {
          throw new NotFoundException('Veículo não encontrado.');
        }
        await this.requireUserInCompany(actor, input.userId);
        break;
      }
      case AccessRequestType.BOTH: {
        this.requireDriverPayload(payload);
        this.requireVehiclePayload(payload);
        this.requireContact(contactPhone);
        break;
      }
      default:
        throw new BadRequestException('Tipo de solicitação inválido.');
    }

    // Departamento alvo — só aceita depto já criado (regra 46).
    if (input.departmentId) {
      const department = await this.departmentRepository.findByIdAndCompanyId(
        input.departmentId,
        actor.companyId,
      );
      if (!department) {
        throw new NotFoundException('Departamento não encontrado.');
      }
    }

    // E-mail global único (fail-fast antes de aceitar a solicitação).
    const driverEmail = payload.driver?.email?.trim();
    if (driverEmail) {
      const existing = await this.userRepository.findByEmail(
        normalizeEmail(driverEmail),
      );
      if (existing) {
        throw new ConflictException('E-mail já cadastrado.');
      }
    }
  }

  /**
   * Valida os dados do motorista no payload (NEW_USER/BOTH).
   *
   * @param payload Payload da solicitação.
   */
  private requireDriverPayload(
    payload: CreateAccessRequestInputDto['payload'],
  ): void {
    const name = payload?.driver?.name?.trim();
    const email = payload?.driver?.email?.trim();
    if (!name) {
      throw new BadRequestException('Informe o nome do motorista.');
    }
    if (!email) {
      throw new BadRequestException('Informe o e-mail do motorista.');
    }
  }

  /**
   * Valida os dados do veículo no payload (NEW_VEHICLE/BOTH).
   *
   * @param payload Payload da solicitação.
   */
  private requireVehiclePayload(
    payload: CreateAccessRequestInputDto['payload'],
  ): void {
    if (!payload?.vehicle) {
      throw new BadRequestException(
        'Informe os dados do veículo (modelo/cor).',
      );
    }
  }

  /**
   * Exige o telefone de contato (regra 43 — NEW_USER/NEW_VEHICLE/BOTH).
   *
   * @param contactPhone Telefone normalizado.
   */
  private requireContact(contactPhone: string | null): void {
    if (!contactPhone) {
      throw new BadRequestException(
        'O telefone de contato é obrigatório nesta solicitação.',
      );
    }
  }

  /**
   * Valida que o usuário tem vínculo com a empresa (NEW_VEHICLE/LINK).
   *
   * @param actor Ator autenticado.
   * @param userId Id do usuário.
   */
  private async requireUserInCompany(
    actor: AuthenticatedUserEntity,
    userId: string,
  ): Promise<void> {
    const user = await this.userCompanyRepository.findByUserIdAndCompanyId(
      userId,
      actor.companyId,
    );
    if (!user) {
      throw new NotFoundException('Usuário não encontrado.');
    }
  }
}
