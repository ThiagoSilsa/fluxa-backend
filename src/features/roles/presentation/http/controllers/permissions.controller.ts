// NestJS
import {
  Controller,
  Get,
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

// Use cases
import { ListPermissionsUseCase } from '../../../application/use-cases/list-permissions.use-case';

// Types de resposta
import type { PermissionResponse } from '../../../application/dto/role-response';

// Decorators Swagger da feature
import { ApiListPermissions } from '../../../decorators/api-roles.decorator';

/**
 * Catálogo global de permissões.
 *
 * Exige `MANAGE_ROLES` — o bypass de `is_admin` (Fase 0) garante a regra
 * "`is_admin` OU `MANAGE_ROLES`" do ADR 0004 §1.
 */
@Controller('permissions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PermissionCode.MANAGE_ROLES)
export class PermissionsController {
  constructor(
    private readonly listPermissionsUseCase: ListPermissionsUseCase,
  ) {}

  @Get()
  @ApiListPermissions()
  public listPermissions(
    @Req() request: AuthenticatedRequest,
  ): Promise<PermissionResponse[]> {
    return this.listPermissionsUseCase.execute(this.requireUser(request));
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
