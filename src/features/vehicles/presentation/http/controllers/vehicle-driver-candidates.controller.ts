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
import { RequirePermissions } from '../../../../../shared/decorators/require-permissions.decorator';

// Guards
import { JwtAuthGuard } from '../../../../../shared/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../../../shared/guards/permissions.guard';

// Types
import type { AuthenticatedRequest } from '../../../../../shared/guards/jwt-auth.guard';
import type { AuthenticatedUserEntity } from '../../../../auth/domain/entities/authenticated-user.entity';

// DTOs (apresentação)
import { ListDriverCandidatesQueryDto } from '../dto/list-driver-candidates.query.dto';

// DTOs (aplicação)
import { ListDriverCandidatesInputDto } from '../../../application/dto/list-driver-candidates-input.dto';

// Use cases
import { ListDriverCandidatesUseCase } from '../../../application/use-cases/list-driver-candidates.use-case';

// Types de resposta
import type { ListDriverCandidatesResponse } from '../../../application/dto/driver-candidate-response';

// Decorators Swagger da feature
import { ApiListDriverCandidates } from '../../../decorators/api-vehicles.decorator';

/**
 * Candidatos a motorista — exige `MANAGE_VEHICLES`.
 *
 * Rota em prefixo próprio (`/vehicles/driver-candidates`) para não colidir
 * com `/vehicles/:id` nem com `/vehicles/:vehicleId/drivers`.
 */
@Controller('vehicles/driver-candidates')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PermissionCode.MANAGE_VEHICLES)
export class VehicleDriverCandidatesController {
  constructor(
    private readonly listDriverCandidatesUseCase: ListDriverCandidatesUseCase,
  ) {}

  @Get()
  @ApiListDriverCandidates()
  public listDriverCandidates(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListDriverCandidatesQueryDto,
  ): Promise<ListDriverCandidatesResponse> {
    return this.listDriverCandidatesUseCase.execute(
      this.requireUser(request),
      new ListDriverCandidatesInputDto(query.search, query.limit, query.offset),
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
