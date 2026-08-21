// NestJS
import {
  Controller,
  Get,
  Param,
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

// DTOs (aplicação)
import { ResolveVehicleQrInputDto } from '../../../application/dto/resolve-vehicle-qr-input.dto';

// Use cases
import { ResolveVehicleQrUseCase } from '../../../application/use-cases/resolve-vehicle-qr.use-case';

// Types de resposta
import type { VehicleResponse } from '../../../application/dto/vehicle-response';

// Decorators Swagger
import { ApiResolveVehicleQr } from '../../../decorators/api-vehicles.decorator';

/**
 * Resolução de QR code de veículo pelo `code` lido pelo scanner (por empresa)
 * — exige `REGISTER_ENTRY` (permissão do porteiro; ADR 0009 §4).
 *
 * QR ativo → devolve o veículo com o agregado para o fluxo de entrada; QR
 * revogado → **410 Gone** ("QR expirado"); desconhecido/outro tenant → 404.
 */
@Controller('qr-codes')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PermissionCode.REGISTER_ENTRY)
export class QrCodesController {
  constructor(
    private readonly resolveVehicleQrUseCase: ResolveVehicleQrUseCase,
  ) {}

  @Get(':code')
  @ApiResolveVehicleQr()
  public resolveVehicleQr(
    @Req() request: AuthenticatedRequest,
    @Param('code') code: string,
  ): Promise<VehicleResponse> {
    return this.resolveVehicleQrUseCase.execute(
      this.requireUser(request),
      new ResolveVehicleQrInputDto(code),
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
