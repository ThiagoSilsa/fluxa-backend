// NestJS
import {
  Body,
  Controller,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

// Shared
import { PermissionCode } from '../../../../../shared/constants/access-control.constant';

// Decorators
import { RequirePermissions } from '../../../../../shared/decorators/require-permissions.decorator';

// Guards
import { JwtAuthGuard } from '../../../../../shared/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../../../shared/guards/permissions.guard';

// Types
import type { AuthenticatedRequest } from '../../../../../shared/guards/jwt-auth.guard';
import type { AuthenticatedUserEntity } from '../../../../auth/domain/entities/authenticated-user.entity';

// DTOs (apresentação)
import { RegisterEntryDenialDto } from '../dto/register-entry-denial.dto';

// DTOs (aplicação)
import { RegisterEntryDenialInputDto } from '../../../application/dto/register-entry-denial-input.dto';

// Use cases
import { RegisterEntryDenialUseCase } from '../../../application/use-cases/register-entry-denial.use-case';

// Types de resposta
import type { EntryDenialResponse } from '../../../application/dto/entry-denial-response';

// Decorators Swagger da feature
import { ApiRegisterEntryDenial } from '../../../decorators/api-blocks.decorator';

/**
 * Registro de impedimentos de entrada (ledger `entry_denial`) — exige
 * `REGISTER_DENIAL` (ADR 0010 §3). No access core o impedimento é registrado
 * automaticamente pelo endpoint de entrada; este endpoint cobre o registro
 * manual.
 */
@Controller('entry-denials')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PermissionCode.REGISTER_DENIAL)
export class EntryDenialsController {
  constructor(
    private readonly registerEntryDenialUseCase: RegisterEntryDenialUseCase,
  ) {}

  @Post()
  @ApiRegisterEntryDenial()
  public registerEntryDenial(
    @Req() request: AuthenticatedRequest,
    @Body() dto: RegisterEntryDenialDto,
  ): Promise<EntryDenialResponse> {
    return this.registerEntryDenialUseCase.execute(
      this.requireUser(request),
      new RegisterEntryDenialInputDto(dto.plate, dto.reason, dto.observation),
    );
  }

  /**
   * Extrai o ator autenticado do request (populado pelo `JwtAuthGuard`).
   *
   * @param request Requisição HTTP.
   * @returns Ator autenticado.
   * @throws {UnauthorizedException} Sem ator no request.
   */
  private requireUser(request: AuthenticatedRequest): AuthenticatedUserEntity {
    if (!request.user) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }
    return request.user;
  }
}
