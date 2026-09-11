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
import { ListRoleOptionsQueryDto } from '../dto/list-role-options.query.dto';

// DTOs (aplicação)
import { ListRoleOptionsInputDto } from '../../../application/dto/list-role-options-input.dto';

// Use cases
import { ListRoleOptionsUseCase } from '../../../application/use-cases/list-role-options.use-case';

// Types de resposta
import type { ListRoleOptionsResponse } from '../../../application/dto/role-option-response';

// Decorators Swagger da feature
import { ApiListRoleOptions } from '../../../decorators/api-roles.decorator';

/**
 * Opções de cargo (seleção enxuta) — acessível a quem aceita solicitação ou
 * gerencia usuários.
 *
 * Endpoint de baixo privilégio (ADR 0011): quem aceita solicitação de acesso
 * (`MANAGE_ACCESS_REQUESTS`) ou gerencia usuários (`MANAGE_USERS`) escolhe um
 * cargo sem depender de `MANAGE_ROLES` (CRUD de cargos).
 *
 * Rota em prefixo próprio (`/roles/options`) para não colidir com
 * `/roles/:id`.
 */
@Controller('roles/options')
@UseGuards(JwtAuthGuard, AnyPermissionsGuard)
@RequireAnyPermission(
  PermissionCode.MANAGE_ACCESS_REQUESTS,
  PermissionCode.MANAGE_USERS,
)
export class RoleOptionsController {
  constructor(
    private readonly listRoleOptionsUseCase: ListRoleOptionsUseCase,
  ) {}

  @Get()
  @ApiListRoleOptions()
  public listRoleOptions(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListRoleOptionsQueryDto,
  ): Promise<ListRoleOptionsResponse> {
    return this.listRoleOptionsUseCase.execute(
      this.requireUser(request),
      new ListRoleOptionsInputDto(query.limit, query.offset),
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
