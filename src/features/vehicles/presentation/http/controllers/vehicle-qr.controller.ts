// NestJS
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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

// DTOs (aplicação)
import { GetVehicleQrInputDto } from '../../../application/dto/get-vehicle-qr-input.dto';

// Use cases
import { EmitVehicleQrUseCase } from '../../../application/use-cases/emit-vehicle-qr.use-case';
import { GetVehicleQrUseCase } from '../../../application/use-cases/get-vehicle-qr.use-case';
import { ReissueVehicleQrUseCase } from '../../../application/use-cases/reissue-vehicle-qr.use-case';
import { RevokeVehicleQrUseCase } from '../../../application/use-cases/revoke-vehicle-qr.use-case';

// Types de resposta
import type { VehicleQrResponse } from '../../../application/dto/vehicle-qr-response';

// Decorators Swagger
import {
  ApiEmitVehicleQr,
  ApiGetVehicleQr,
  ApiReissueVehicleQr,
  ApiRevokeVehicleQr,
} from '../../../decorators/api-vehicles.decorator';

/**
 * Emissão/gestão do QR code de veículos (por empresa) — exige
 * `PRINT_QRCODE` (ADR 0009 §2).
 *
 * O `code` é o token **permanente** do veículo (a imagem é gerada no client);
 * reimprimir usa o `GET`, reemitir revoga o atual + cria novo, revogar
 * desativa sem emitir outro.
 */
@Controller('vehicles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PermissionCode.PRINT_QRCODE)
export class VehicleQrController {
  constructor(
    private readonly emitVehicleQrUseCase: EmitVehicleQrUseCase,
    private readonly getVehicleQrUseCase: GetVehicleQrUseCase,
    private readonly reissueVehicleQrUseCase: ReissueVehicleQrUseCase,
    private readonly revokeVehicleQrUseCase: RevokeVehicleQrUseCase,
  ) {}

  @Post(':id/qr')
  @ApiEmitVehicleQr()
  public emitVehicleQr(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<VehicleQrResponse> {
    return this.emitVehicleQrUseCase.execute(
      this.requireUser(request),
      new GetVehicleQrInputDto(id),
    );
  }

  @Get(':id/qr')
  @ApiGetVehicleQr()
  public getVehicleQr(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<VehicleQrResponse> {
    return this.getVehicleQrUseCase.execute(
      this.requireUser(request),
      new GetVehicleQrInputDto(id),
    );
  }

  @Post(':id/qr/reissue')
  @ApiReissueVehicleQr()
  public reissueVehicleQr(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<VehicleQrResponse> {
    return this.reissueVehicleQrUseCase.execute(
      this.requireUser(request),
      new GetVehicleQrInputDto(id),
    );
  }

  @Post(':id/qr/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiRevokeVehicleQr()
  public revokeVehicleQr(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.revokeVehicleQrUseCase.execute(
      this.requireUser(request),
      new GetVehicleQrInputDto(id),
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
