// NestJS
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Shared
import { normalizeEmail } from '../../../../shared/utils/email.util';
import { PasswordHashUseCase } from '../../../../shared/security/password-hash.use-case';

// Repositories
import { ACCESS_REQUEST_REPOSITORY } from '../../domain/repositories/access-request.repository';
import { USER_REPOSITORY } from '../../../users/domain/repositories/user.repository';
import { USER_VEHICLE_REPOSITORY } from '../../../vehicles/domain/repositories/user-vehicle.repository';
import { VEHICLE_REPOSITORY } from '../../../vehicles/domain/repositories/vehicle.repository';
import { VEHICLE_TYPE_REPOSITORY } from '../../../vehicles/domain/repositories/vehicle-type.repository';

// Constants
import {
  AccessRequestStatus,
  AccessRequestType,
} from '../../domain/constants/access-request.constant';
import { UserType } from '../../../auth/domain/constants/user-type.constant';

// Mapper
import { toAccessRequestResponse } from '../utils/access-request-response.mapper';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { AccessRequestEntity } from '../../domain/entities/access-request.entity';
import type { AccessRequestRepository } from '../../domain/repositories/access-request.repository';
import type { UserRepository } from '../../../users/domain/repositories/user.repository';
import type { UserVehicleRepository } from '../../../vehicles/domain/repositories/user-vehicle.repository';
import type { VehicleRepository } from '../../../vehicles/domain/repositories/vehicle.repository';
import type { VehicleTypeRepository } from '../../../vehicles/domain/repositories/vehicle-type.repository';
import type { AcceptAccessRequestInputDto } from '../dto/accept-access-request-input.dto';
import type { AccessRequestResponse } from '../dto/access-request-response';

/**
 * Resultado da resolução retroativa (cadastros criados/vinculados no aceite).
 */
interface ResolutionResult {
  resolvedUserId: string;
  resolvedVehicleId: string;
}

/**
 * Aceita uma solicitação de acesso (exclusivo da administração) com
 * **resolução retroativa** (regra 44 — opção A).
 *
 * Por cenário:
 * - `NEW_USER` — cria `user` (`VISITOR`) e vincula ao veículo existente;
 * - `NEW_VEHICLE` — cria `vehicle` (tipo escolhido pela admin — regra 22) e
 *   vincula ao usuário existente;
 * - `LINK` — cria apenas o vínculo `user_vehicle`;
 * - `BOTH` — cria `user` + `vehicle` + vínculo.
 *
 * O `can_drive` (default true) e `is_primary` (opcional, 1 por veículo) são
 * definidos no aceite (regra 42). A solicitação vai para `REGISTERED` com
 * `entry_authorized = true` (ADR 0010 §4 — liberação da entrada temporária).
 * A resolução retroativa dos `vehicle_access` (preencher veículo/condutor nas
 * visitas da placa) fica para o access core (M3 — dono do repositório).
 */
@Injectable()
export class AcceptAccessRequestUseCase {
  private readonly logger = new Logger(AcceptAccessRequestUseCase.name);

  constructor(
    @Inject(ACCESS_REQUEST_REPOSITORY)
    private readonly accessRequestRepository: AccessRequestRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: VehicleRepository,
    @Inject(VEHICLE_TYPE_REPOSITORY)
    private readonly vehicleTypeRepository: VehicleTypeRepository,
    @Inject(USER_VEHICLE_REPOSITORY)
    private readonly userVehicleRepository: UserVehicleRepository,
    private readonly passwordHash: PasswordHashUseCase,
    private readonly config: ConfigService,
  ) {}

  /**
   * Aceita a solicitação da empresa do ator e resolve os cadastros/vínculo.
   *
   * @param actor Ator autenticado (admin — empresa da sessão).
   * @param input Id da solicitação + tipo do veículo/vínculo a definir.
   * @returns Solicitação registrada (REGISTERED, entry_authorized = true).
   * @throws {NotFoundException} Solicitação/veículo/usuário/tipo não existem.
   * @throws {ConflictException} Solicitação não está aberta ou vínculo já existe.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: AcceptAccessRequestInputDto,
  ): Promise<AccessRequestResponse> {
    const request = await this.accessRequestRepository.findByIdAndCompanyId(
      input.requestId,
      actor.companyId,
    );
    if (!request) {
      throw new NotFoundException('Solicitação não encontrada.');
    }
    if (
      request.status !== AccessRequestStatus.PENDING &&
      request.status !== AccessRequestStatus.IN_CONTACT
    ) {
      throw new ConflictException(
        'Apenas solicitações pendentes ou em contato podem ser aceitas.',
      );
    }

    const resolution = await this.resolveCadastros(actor, request, input);

    const registered =
      await this.accessRequestRepository.updateStatusByIdAndCompanyId(
        request.id,
        actor.companyId,
        {
          status: AccessRequestStatus.REGISTERED,
          handledBy: actor.id,
          observation: input.observation?.trim() || null,
          resolvedUserId: resolution.resolvedUserId,
          resolvedVehicleId: resolution.resolvedVehicleId,
          entryAuthorized: true,
          authorizedBy: actor.id,
        },
      );
    if (!registered) {
      throw new NotFoundException('Solicitação não encontrada.');
    }

    const requestedBy = await this.resolveUser(request.requestedBy);
    return toAccessRequestResponse(
      registered,
      requestedBy ?? { id: request.requestedBy, name: '—' },
      { id: actor.id, name: actor.name },
      { id: actor.id, name: actor.name },
    );
  }

  /**
   * Resolve os cadastros/vínculo conforme o cenário (regras 41–44).
   *
   * @param actor Ator autenticado (admin).
   * @param request Solicitação a aceitar.
   * @param input Dados do aceite (tipo do veículo/vínculo).
   * @returns Ids do usuário e veículo resolvidos.
   */
  private async resolveCadastros(
    actor: AuthenticatedUserEntity,
    request: AccessRequestEntity,
    input: AcceptAccessRequestInputDto,
  ): Promise<ResolutionResult> {
    switch (request.type) {
      case AccessRequestType.NEW_USER: {
        const vehicle = await this.requireVehicle(actor, request.vehicleId);
        const user = await this.createVisitorUser(actor, request);
        await this.createLink(actor, user.id, vehicle.id, input, false);
        return { resolvedUserId: user.id, resolvedVehicleId: vehicle.id };
      }
      case AccessRequestType.NEW_VEHICLE: {
        const user = await this.requireUser(request.userId);
        const vehicle = await this.createVehicle(actor, request, input);
        await this.createLink(actor, user.id, vehicle.id, input, false);
        return { resolvedUserId: user.id, resolvedVehicleId: vehicle.id };
      }
      case AccessRequestType.LINK: {
        const vehicle = await this.requireVehicle(actor, request.vehicleId);
        const user = await this.requireUser(request.userId);
        await this.createLink(actor, user.id, vehicle.id, input, true);
        return { resolvedUserId: user.id, resolvedVehicleId: vehicle.id };
      }
      case AccessRequestType.BOTH: {
        const user = await this.createVisitorUser(actor, request);
        const vehicle = await this.createVehicle(actor, request, input);
        await this.createLink(actor, user.id, vehicle.id, input, false);
        return { resolvedUserId: user.id, resolvedVehicleId: vehicle.id };
      }
      default:
        throw new ConflictException('Tipo de solicitação inválido.');
    }
  }

  /**
   * Cria o usuário visitante (`VISITOR`) a partir do payload — senha padrão
   * da administração (mesmo padrão do importador de usuários).
   *
   * @param actor Ator autenticado (admin).
   * @param request Solicitação com o payload do motorista.
   * @returns Usuário criado.
   */
  private async createVisitorUser(
    actor: AuthenticatedUserEntity,
    request: AccessRequestEntity,
  ) {
    const name = request.payload?.driver?.name?.trim();
    const email = normalizeEmail(request.payload?.driver?.email ?? '');
    if (!name || !email) {
      throw new ConflictException('Dados do motorista incompletos no payload.');
    }
    const existing = await this.userRepository.findByEmail(email);
    if (existing) {
      throw new ConflictException('E-mail já cadastrado.');
    }

    const defaultPassword = this.config.get<string>(
      'ADMIN_DEFAULT_PASSWORD',
      'admin123',
    );

    return this.userRepository.create({
      name,
      email,
      passwordHash: this.passwordHash.execute(defaultPassword),
      phone: request.payload?.driver?.phone?.trim() || null,
      document: request.payload?.driver?.document?.trim() || null,
      companyId: actor.companyId,
      type: UserType.VISITOR,
      isActive: true,
    });
  }

  /**
   * Cria o veículo a partir do payload + tipo escolhido pela admin (regra 22).
   *
   * @param actor Ator autenticado (admin).
   * @param request Solicitação com o payload do veículo.
   * @param input Dados do aceite (vehicleTypeId).
   * @returns Veículo criado.
   */
  private async createVehicle(
    actor: AuthenticatedUserEntity,
    request: AccessRequestEntity,
    input: AcceptAccessRequestInputDto,
  ) {
    if (!input.vehicleTypeId) {
      throw new ConflictException(
        'Selecione o tipo do veículo para criar (NEW_VEHICLE/BOTH).',
      );
    }
    const type = await this.vehicleTypeRepository.findByIdAndCompanyId(
      input.vehicleTypeId,
      actor.companyId,
    );
    if (!type) {
      throw new NotFoundException('Tipo de veículo não encontrado.');
    }

    const existing = await this.vehicleRepository.findByPlateAndCompanyId(
      request.plate,
      actor.companyId,
    );
    if (existing) {
      throw new ConflictException('Veículo já cadastrado.');
    }

    return this.vehicleRepository.create({
      plate: request.plate,
      companyId: actor.companyId,
      model: request.payload?.vehicle?.model?.trim() || null,
      color: request.payload?.vehicle?.color?.trim() || null,
      observation: null,
      freePass: false,
      vehicleTypeId: input.vehicleTypeId,
    });
  }

  /**
   * Cria o vínculo `user_vehicle` (regra 42) — `can_drive` default true,
   * `is_primary` opcional (1 primário por veículo).
   *
   * @param actor Ator autenticado (admin).
   * @param userId Usuário a vincular.
   * @param vehicleId Veículo a vincular.
   * @param input Dados do aceite.
   * @param allowExisting Em LINK, se o vínculo já existe → 409.
   */
  private async createLink(
    actor: AuthenticatedUserEntity,
    userId: string,
    vehicleId: string,
    input: AcceptAccessRequestInputDto,
    allowExisting: boolean,
  ): Promise<void> {
    const existing =
      await this.userVehicleRepository.findByUserIdAndVehicleIdAndCompanyId(
        userId,
        vehicleId,
        actor.companyId,
      );
    if (existing) {
      if (allowExisting) {
        throw new ConflictException('Vínculo motorista-veículo já existe.');
      }
      return;
    }

    await this.userVehicleRepository.create({
      companyId: actor.companyId,
      userId,
      vehicleId,
      isPrimary: input.isPrimary,
      canDrive: input.canDrive,
    });
  }

  /**
   * Valida que o veículo existe na empresa.
   *
   * @param actor Ator autenticado.
   * @param vehicleId Id do veículo (ou null).
   * @returns Veículo da empresa.
   */
  private async requireVehicle(
    actor: AuthenticatedUserEntity,
    vehicleId: string | null,
  ) {
    if (!vehicleId) {
      throw new ConflictException('Veículo da solicitação não informado.');
    }
    const vehicle = await this.vehicleRepository.findByIdAndCompanyId(
      vehicleId,
      actor.companyId,
    );
    if (!vehicle) {
      throw new NotFoundException('Veículo da solicitação não encontrado.');
    }
    return vehicle;
  }

  /**
   * Valida que o usuário existe (identidade global).
   *
   * @param userId Id do usuário (ou null).
   * @returns Usuário existente.
   */
  private async requireUser(userId: string | null) {
    if (!userId) {
      throw new ConflictException('Usuário da solicitação não informado.');
    }
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('Usuário da solicitação não encontrado.');
    }
    return user;
  }

  /**
   * Resolve o resumo do usuário (id + nome) ou `null`.
   *
   * @param userId Id do usuário.
   * @returns Resumo do usuário ou `null`.
   */
  private async resolveUser(
    userId: string,
  ): Promise<{ id: string; name: string } | null> {
    const user = await this.userRepository.findById(userId);
    return user ? { id: user.id, name: user.name } : null;
  }
}
