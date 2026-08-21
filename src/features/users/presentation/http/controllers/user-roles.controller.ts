// NestJS
import {
  Body,
  Controller,
  Delete,
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
import { RequirePermissions } from '../../../../../shared/decorators/require-permissions.decorator';
import { JwtAuthGuard } from '../../../../../shared/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../../../shared/guards/permissions.guard';

// Types
import type { AuthenticatedRequest } from '../../../../../shared/guards/jwt-auth.guard';
import type { AuthenticatedUserEntity } from '../../../../auth/domain/entities/authenticated-user.entity';

// DTOs (apresentação)
import { AssignRoleDto } from '../dto/assign-role.dto';

// DTOs (aplicação)
import { AssignRoleInputDto } from '../../../application/dto/assign-role-input.dto';
import { ListUserRolesInputDto } from '../../../application/dto/list-user-roles-input.dto';
import { RemoveRoleInputDto } from '../../../application/dto/remove-role-input.dto';

// Use cases
import { AssignRoleToUserUseCase } from '../../../application/use-cases/assign-role-to-user.use-case';
import { ListUserRolesUseCase } from '../../../application/use-cases/list-user-roles.use-case';
import { RemoveRoleFromUserUseCase } from '../../../application/use-cases/remove-role-from-user.use-case';

// Types de resposta
import type { ListUserRolesResponse } from '../../../application/dto/user-role-response';

// Decorators Swagger da feature
import {
  ApiAssignRole,
  ApiListUserRoles,
  ApiRemoveRole,
} from '../../../decorators/api-users.decorator';

/**
 * Cargos do usuário (`user_role`) — exige `MANAGE_USERS` (ADR 0005 §5).
 *
 * Escopo por `user_company` + `company_id` da sessão. Governança de
 * `is_admin` (só admin atribui/retira cargo de administração e gerencia
 * cargos de admin) e invariante do último admin vivem nos use cases.
 */
@Controller('users/:userId/roles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PermissionCode.MANAGE_USERS)
export class UserRolesController {
  constructor(
    private readonly assignRoleToUserUseCase: AssignRoleToUserUseCase,
    private readonly removeRoleFromUserUseCase: RemoveRoleFromUserUseCase,
    private readonly listUserRolesUseCase: ListUserRolesUseCase,
  ) {}

  /**
   * Atribui um cargo da empresa da sessão a um usuário.
   *
   * @param request Requisição autenticada.
   * @param userId Id da pessoa.
   * @param dto Id do cargo.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiAssignRole()
  public async assignRole(
    @Req() request: AuthenticatedRequest,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: AssignRoleDto,
  ): Promise<void> {
    await this.assignRoleToUserUseCase.execute(
      this.requireUser(request),
      new AssignRoleInputDto(userId, dto.roleId),
    );
  }

  /**
   * Lista os cargos de um usuário na empresa da sessão.
   *
   * @param request Requisição autenticada.
   * @param userId Id da pessoa.
   * @returns Cargos do usuário na empresa.
   */
  @Get()
  @ApiListUserRoles()
  public listRoles(
    @Req() request: AuthenticatedRequest,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<ListUserRolesResponse> {
    return this.listUserRolesUseCase.execute(
      this.requireUser(request),
      new ListUserRolesInputDto(userId),
    );
  }

  /**
   * Remove um cargo de um usuário na empresa da sessão.
   *
   * @param request Requisição autenticada.
   * @param userId Id da pessoa.
   * @param roleId Id do cargo.
   */
  @Delete(':roleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiRemoveRole()
  public async removeRole(
    @Req() request: AuthenticatedRequest,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
  ): Promise<void> {
    await this.removeRoleFromUserUseCase.execute(
      this.requireUser(request),
      new RemoveRoleInputDto(userId, roleId),
    );
  }

  /**
   * Obtém o ator autenticado do request (populado pelo `JwtAuthGuard`).
   *
   * @param request Requisição autenticada.
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
