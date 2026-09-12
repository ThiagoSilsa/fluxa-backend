// NestJS
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

// Node
import { randomUUID } from 'crypto';

// Shared
import { PermissionCode } from '../../../../shared/constants/access-control.constant';
import { normalizePlate } from '../../../../shared/utils/plate.util';

// Repositories
import { ENTRY_DENIAL_REPOSITORY } from '../../domain/repositories/entry-denial.repository';
import { VEHICLE_BLOCK_REPOSITORY } from '../../domain/repositories/vehicle-block.repository';
import { VEHICLE_REPOSITORY } from '../../../vehicles/domain/repositories/vehicle.repository';
import { ENTRANCE_REPOSITORY } from '../../../entrances/domain/repositories/entrance.repository';

// Constants
import {
  EntryDenialReason,
  SyncStatus,
} from '../../domain/constants/block.constant';

// Mapper
import { toEntryDenialResponse } from '../utils/entry-denial-response.mapper';

// Use cases (pedido de bloqueio no mesmo fluxo — regras 51-53)
import { CreateBlockRequestUseCase } from './create-block-request.use-case';

// DTOs
import { CreateBlockRequestInputDto } from '../dto/create-block-request-input.dto';

// Types
import type { AuthenticatedUserEntity } from '../../../auth/domain/entities/authenticated-user.entity';
import type { EntryDenialRepository } from '../../domain/repositories/entry-denial.repository';
import type { VehicleBlockRepository } from '../../domain/repositories/vehicle-block.repository';
import type { VehicleRepository } from '../../../vehicles/domain/repositories/vehicle.repository';
import type { EntranceRepository } from '../../../entrances/domain/repositories/entrance.repository';
import type { RegisterEntryDenialInputDto } from '../dto/register-entry-denial-input.dto';
import type {
  EntryDenialBlockRequestSummary,
  RegisterEntryDenialResponse,
} from '../dto/entry-denial-response';

/**
 * Registra um impedimento de entrada (ledger `entry_denial`, append-only).
 *
 * No access core (M3) este use case é chamado **automaticamente** pelo
 * endpoint de entrada ao negar (ADR 0010 §3); aqui também é exposto como
 * endpoint manual (`REGISTER_DENIAL`) — o caminho da portaria para impedir uma
 * entrada que o sistema liberaria.
 *
 * Registra o veículo (resolvido pela placa), a **portaria** do device e o
 * porteiro; `OTHER` exige observação; e — opcionalmente, **desmarcado por
 * padrão** — cria o `block_request` no mesmo fluxo (o porteiro solicita, a
 * administração aprova: regras 51-53). O impedimento nunca cria
 * `vehicle_block` diretamente (ADR 0014 §6).
 */
@Injectable()
export class RegisterEntryDenialUseCase {
  private readonly logger = new Logger(RegisterEntryDenialUseCase.name);

  constructor(
    @Inject(ENTRY_DENIAL_REPOSITORY)
    private readonly entryDenialRepository: EntryDenialRepository,
    @Inject(VEHICLE_BLOCK_REPOSITORY)
    private readonly vehicleBlockRepository: VehicleBlockRepository,
    @Inject(VEHICLE_REPOSITORY)
    private readonly vehicleRepository: VehicleRepository,
    @Inject(ENTRANCE_REPOSITORY)
    private readonly entranceRepository: EntranceRepository,
    private readonly createBlockRequestUseCase: CreateBlockRequestUseCase,
  ) {}

  /**
   * Registra o impedimento na empresa do ator.
   *
   * @param actor Ator autenticado (empresa da sessão).
   * @param input Placa, motivo e dados opcionais.
   * @returns Impedimento registrado + resultado do pedido de bloqueio.
   * @throws {BadRequestException} Placa inválida, observação ausente em
   * `OTHER` ou portaria inativa.
   * @throws {ForbiddenException} Pedido de bloqueio sem a permissão
   * `CREATE_BLOCK_REQUEST`.
   * @throws {NotFoundException} Bloqueio/portaria informados não existem.
   */
  public async execute(
    actor: AuthenticatedUserEntity,
    input: RegisterEntryDenialInputDto,
  ): Promise<RegisterEntryDenialResponse> {
    const plate = normalizePlate(input.plate);
    if (!plate || plate.length > 10) {
      throw new BadRequestException('Placa inválida.');
    }

    const observation = input.observation?.trim() || null;
    // `OTHER` é o caso "sem motivo padronizado": sem observação não há
    // auditoria possível (a administração não sabe o que aconteceu).
    if (input.reason === EntryDenialReason.OTHER && !observation) {
      throw new BadRequestException('Informe a observação do impedimento.');
    }

    // Valida o bloqueio que motivou (se informado) — mesmo tenant.
    if (input.blockId) {
      const block = await this.vehicleBlockRepository.findByIdAndCompanyId(
        input.blockId,
        actor.companyId,
      );
      if (!block) {
        throw new NotFoundException('Bloqueio não encontrado.');
      }
    }

    // Portaria do device — mesma validação do endpoint de entrada (M4).
    const entranceId = await this.resolveEntrance(actor, input.entranceId);

    // Pedir bloqueio exige a permissão específica: o porteiro **solicita** e a
    // administração aprova — ele nunca cria `vehicle_block` (regras 51-53).
    if (input.requestBlock && !this.canRequestBlock(actor)) {
      throw new ForbiddenException(
        'Permissão insuficiente para solicitar o bloqueio.',
      );
    }

    // Resolve o veículo (cadastrado) para preencher vehicle_id.
    const vehicle = await this.vehicleRepository.findByPlateAndCompanyId(
      plate,
      actor.companyId,
    );

    const denial = await this.entryDenialRepository.create({
      companyId: actor.companyId,
      vehicleId: input.vehicleId ?? vehicle?.id ?? null,
      plateSnapshot: plate,
      blockId: input.blockId ?? null,
      reason: input.reason,
      observation,
      entranceId,
      doormanId: actor.id,
      occurredAt: new Date(),
      syncStatus: SyncStatus.SYNCED,
      idempotencyKey: randomUUID(),
    });

    const { blockRequest, blockRequestError } = await this.maybeRequestBlock(
      actor,
      plate,
      input,
      observation,
    );

    return {
      ...toEntryDenialResponse(denial),
      blockRequest,
      blockRequestError,
    };
  }

  /**
   * Valida a portaria do device (mesma regra do endpoint de entrada).
   *
   * @param actor Ator autenticado.
   * @param entranceId Portaria informada (opcional).
   * @returns Id da portaria validada ou `null`.
   * @throws {NotFoundException} Portaria não encontrada na empresa.
   * @throws {BadRequestException} Portaria inativa.
   */
  private async resolveEntrance(
    actor: AuthenticatedUserEntity,
    entranceId?: string,
  ): Promise<string | null> {
    if (!entranceId) {
      return null;
    }
    const entrance = await this.entranceRepository.findByIdAndCompanyId(
      entranceId,
      actor.companyId,
    );
    if (!entrance) {
      throw new NotFoundException('Portaria não encontrada.');
    }
    if (!entrance.isActive) {
      throw new BadRequestException('Portaria inativa.');
    }
    return entrance.id;
  }

  /**
   * O ator pode solicitar bloqueio (`CREATE_BLOCK_REQUEST` ou admin)?
   *
   * @param actor Ator autenticado.
   * @returns `true` quando pode solicitar o bloqueio.
   */
  private canRequestBlock(actor: AuthenticatedUserEntity): boolean {
    return (
      actor.isAdmin ||
      actor.permissions.includes(PermissionCode.CREATE_BLOCK_REQUEST)
    );
  }

  /**
   * Cria a solicitação de bloqueio pedida junto com o impedimento.
   *
   * O pedido é um **efeito colateral** do impedimento: se falhar (ex.: já
   * existe pendente para a placa), o evento permanece registrado e o motivo é
   * devolvido ao cliente em `blockRequestError` — o ledger não é desfeito por
   * causa do pedido.
   *
   * @param actor Ator autenticado.
   * @param plate Placa normalizada.
   * @param input Entrada do use case.
   * @param observation Observação do impedimento (fallback do motivo).
   * @returns Pedido criado (ou o motivo da falha).
   */
  private async maybeRequestBlock(
    actor: AuthenticatedUserEntity,
    plate: string,
    input: RegisterEntryDenialInputDto,
    observation: string | null,
  ): Promise<{
    blockRequest: EntryDenialBlockRequestSummary | null;
    blockRequestError: string | null;
  }> {
    if (!input.requestBlock) {
      return { blockRequest: null, blockRequestError: null };
    }

    const reason =
      input.blockReason?.trim() ||
      observation ||
      'Impedimento registrado na portaria.';

    try {
      const created = await this.createBlockRequestUseCase.execute(
        actor,
        new CreateBlockRequestInputDto(plate, reason),
      );
      return {
        blockRequest: {
          id: created.id,
          plate: created.plate,
          status: created.status,
        },
        blockRequestError: null,
      };
    } catch (error) {
      const message = this.resolveErrorMessage(error);
      this.logger.warn(
        `Pedido de bloqueio não criado para a placa ${plate}: ${message}`,
      );
      return { blockRequest: null, blockRequestError: message };
    }
  }

  /**
   * Extrai a mensagem de um erro HTTP (padrão do ValidationPipe ou string).
   *
   * @param error Erro capturado.
   * @returns Mensagem legível para o cliente.
   */
  private resolveErrorMessage(error: unknown): string {
    if (error instanceof HttpException) {
      const response = error.getResponse();
      if (typeof response === 'string') {
        return response;
      }
      const message = (response as { message?: string | string[] }).message;
      if (Array.isArray(message)) {
        return message.join(' ');
      }
      if (typeof message === 'string') {
        return message;
      }
    }
    return 'Não foi possível solicitar o bloqueio.';
  }
}
