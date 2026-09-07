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
import { ListUserOptionsQueryDto } from '../dto/list-user-options.query.dto';

// DTOs (aplicação)
import { ListUserOptionsInputDto } from '../../../application/dto/list-user-options-input.dto';

// Use cases
import { ListUserOptionsUseCase } from '../../../application/use-cases/list-user-options.use-case';

// Types de resposta
import type { ListUserOptionsResponse } from '../../../application/dto/user-option-response';

// Decorators Swagger da feature
import { ApiListUserOptions } from '../../../decorators/api-users.decorator';

/**
 * Opções de usuário (seleção enxuta) — acessível a solicitantes.
 *
 * Endpoint de baixo privilégio (ADR 0011): quem cria solicitação de acesso
 * (`CREATE_ACCESS_REQUEST`) ou de bloqueio (`CREATE_BLOCK_REQUEST`) pode
 * buscar usuários **ativos** da empresa por nome/e-mail para popular o
 * seletor — sem exigir `MANAGE_USERS`.
 *
 * Rota em prefixo próprio (`/users/options`) para não colidir com
 * `/users/:id`.
 */
@Controller('users/options')
@UseGuards(JwtAuthGuard, AnyPermissionsGuard)
@RequireAnyPermission(
  PermissionCode.CREATE_ACCESS_REQUEST,
  PermissionCode.CREATE_BLOCK_REQUEST,
)
export class UserOptionsController {
  constructor(
    private readonly listUserOptionsUseCase: ListUserOptionsUseCase,
  ) {}

  @Get()
  @ApiListUserOptions()
  public listUserOptions(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListUserOptionsQueryDto,
  ): Promise<ListUserOptionsResponse> {
    return this.listUserOptionsUseCase.execute(
      this.requireUser(request),
      new ListUserOptionsInputDto(query.search, query.limit, query.offset),
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
