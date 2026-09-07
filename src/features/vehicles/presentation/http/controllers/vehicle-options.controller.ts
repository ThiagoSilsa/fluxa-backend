// NestJS
import {
  Controller,
  Get,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

// Shared
import { PermissionCode } from '../../../../../shared/constants/access-control.constant';

// Decorators
import { RequireAnyPermission } from '../../../../../shared/decorators/require-any-permission.decorator';

// Guards
import { AnyPermissionsGuard } from '../../../../../shared/guards/any-permissions.guard';
import { JwtAuthGuard } from '../../../../../shared/guards/jwt-auth.guard';

// Types
import type { AuthenticatedRequest } from '../../../../../shared/guards/jwt-auth.guard';
import type { AuthenticatedUserEntity } from '../../../../auth/domain/entities/authenticated-user.entity';

// DTOs (apresentação)
import { ListVehicleOptionsQueryDto } from '../dto/list-vehicle-options.query.dto';

// DTOs (aplicação)
import { ListVehicleOptionsInputDto } from '../../../application/dto/list-vehicle-options-input.dto';

// Use cases
import { ListVehicleOptionsUseCase } from '../../../application/use-cases/list-vehicle-options.use-case';

// Types de resposta
import type { ListVehicleOptionsResponse } from '../../../application/dto/vehicle-option-response';

// Decorators Swagger da feature
import { ApiListVehicleOptions } from '../../../decorators/api-vehicles.decorator';

/**
 * Opções de veículo (seleção enxuta) — acessível a solicitantes.
 *
 * Endpoint de baixo privilégio (ADR 0011): quem cria solicitação de acesso
 * (`CREATE_ACCESS_REQUEST`) ou de bloqueio (`CREATE_BLOCK_REQUEST`) pode
 * buscar veículos da empresa por placa/modelo para popular o seletor — sem
 * exigir `MANAGE_VEHICLES`.
 *
 * Rota em prefixo próprio (`/vehicles/options`) para não colidir com
 * `/vehicles/:id`.
 */
@Controller('vehicles/options')
@UseGuards(JwtAuthGuard, AnyPermissionsGuard)
@RequireAnyPermission(
  PermissionCode.CREATE_ACCESS_REQUEST,
  PermissionCode.CREATE_BLOCK_REQUEST,
)
export class VehicleOptionsController {
  constructor(
    private readonly listVehicleOptionsUseCase: ListVehicleOptionsUseCase,
  ) {}

  @Get()
  @ApiListVehicleOptions()
  public listVehicleOptions(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListVehicleOptionsQueryDto,
  ): Promise<ListVehicleOptionsResponse> {
    return this.listVehicleOptionsUseCase.execute(
      this.requireUser(request),
      new ListVehicleOptionsInputDto(query.search, query.limit, query.offset),
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
