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
  Patch,
  Post,
  Query,
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
import { ChangePasswordDto } from '../dto/change-password.dto';
import { CreateUserDto } from '../dto/create-user.dto';
import { EmailStatusQueryDto } from '../dto/email-status.query.dto';
import { ListUsersQueryDto } from '../dto/list-users.query.dto';
import { UpdateUserDto } from '../dto/update-user.dto';

// DTOs (aplicação)
import { ChangePasswordInputDto } from '../../../application/dto/change-password-input.dto';
import { CreateUserInputDto } from '../../../application/dto/create-user-input.dto';
import { EmailStatusInputDto } from '../../../application/dto/email-status-input.dto';
import { GetUserInputDto } from '../../../application/dto/get-user-input.dto';
import { ListUsersInputDto } from '../../../application/dto/list-users-input.dto';
import { UpdateUserInputDto } from '../../../application/dto/update-user-input.dto';

// Use cases
import { ChangePasswordUseCase } from '../../../application/use-cases/change-password.use-case';
import { CreateUserUseCase } from '../../../application/use-cases/create-user.use-case';
import { DeactivateUserUseCase } from '../../../application/use-cases/deactivate-user.use-case';
import { EmailStatusUseCase } from '../../../application/use-cases/email-status.use-case';
import { GetUserUseCase } from '../../../application/use-cases/get-user.use-case';
import { ListUsersUseCase } from '../../../application/use-cases/list-users.use-case';
import { UpdateUserUseCase } from '../../../application/use-cases/update-user.use-case';

// Types de resposta
import type {
  CreateUserResponse,
  EmailStatusResponse,
  ListUsersResponse,
  UserResponse,
} from '../../../application/dto/user-response';

// Decorators Swagger da feature
import {
  ApiChangePassword,
  ApiCreateUser,
  ApiDeactivateUser,
  ApiEmailStatus,
  ApiGetUser,
  ApiListUsers,
  ApiUpdateUser,
} from '../../../decorators/api-users.decorator';

/**
 * CRUD de usuários (por empresa — via vínculo `user_company`) — exige
 * `MANAGE_USERS` (ADR 0005).
 *
 * `GET /users/email-status` é declarada **antes** de `GET /users/:id` (ordem
 * de rota importa no Nest). As regras de negócio vivem nos use cases; o
 * controller só valida entrada e delega.
 */
@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(PermissionCode.MANAGE_USERS)
export class UsersController {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly listUsersUseCase: ListUsersUseCase,
    private readonly getUserUseCase: GetUserUseCase,
    private readonly emailStatusUseCase: EmailStatusUseCase,
    private readonly updateUserUseCase: UpdateUserUseCase,
    private readonly deactivateUserUseCase: DeactivateUserUseCase,
    private readonly changePasswordUseCase: ChangePasswordUseCase,
  ) {}

  /**
   * Consulta se um e-mail já existe no sistema.
   *
   * @param request Requisição autenticada.
   * @param query E-mail a consultar.
   * @returns Apenas `{ exists }`.
   */
  @Get('email-status')
  @ApiEmailStatus()
  public emailStatus(
    @Req() request: AuthenticatedRequest,
    @Query() query: EmailStatusQueryDto,
  ): Promise<EmailStatusResponse> {
    return this.emailStatusUseCase.execute(
      this.requireUser(request),
      new EmailStatusInputDto(query.email),
    );
  }

  /**
   * Cria um usuário já vinculado à empresa do ator.
   *
   * @param request Requisição autenticada.
   * @param dto Dados de criação.
   * @returns Pessoa + vínculo, com `createdUser` indicando se a pessoa era nova.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiCreateUser()
  public createUser(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateUserDto,
  ): Promise<CreateUserResponse> {
    return this.createUserUseCase.execute(
      this.requireUser(request),
      new CreateUserInputDto(
        dto.email,
        dto.type,
        dto.name,
        dto.password,
        dto.phone,
        dto.document,
        dto.observation,
        dto.roleId,
      ),
    );
  }

  /**
   * Lista os usuários com vínculo na empresa da sessão.
   *
   * @param request Requisição autenticada.
   * @param query Busca, filtros e paginação.
   * @returns Página de usuários.
   */
  @Get()
  @ApiListUsers()
  public listUsers(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListUsersQueryDto,
  ): Promise<ListUsersResponse> {
    return this.listUsersUseCase.execute(
      this.requireUser(request),
      new ListUsersInputDto(
        query.search,
        query.type,
        query.isActive,
        query.limit,
        query.offset,
      ),
    );
  }

  /**
   * Detalha um usuário com vínculo na empresa da sessão.
   *
   * @param request Requisição autenticada.
   * @param id Id da pessoa.
   * @returns Dados do usuário.
   */
  @Get(':id')
  @ApiGetUser()
  public getUser(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserResponse> {
    return this.getUserUseCase.execute(
      this.requireUser(request),
      new GetUserInputDto(id),
    );
  }

  /**
   * Edita parcialmente um usuário da empresa (dados da pessoa + vínculo).
   *
   * @param request Requisição autenticada.
   * @param id Id da pessoa.
   * @param dto Campos a atualizar.
   * @returns Usuário atualizado.
   */
  @Patch(':id')
  @ApiUpdateUser()
  public updateUser(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponse> {
    return this.updateUserUseCase.execute(
      this.requireUser(request),
      new UpdateUserInputDto(
        id,
        dto.name,
        dto.email,
        dto.phone,
        dto.document,
        dto.observation,
        dto.type,
        dto.isActive,
        dto.roleId,
      ),
    );
  }

  /**
   * Desativa a participação do usuário na empresa (soft — ADR 0005 §4).
   *
   * @param request Requisição autenticada.
   * @param id Id da pessoa.
   * @returns Usuário com o vínculo desativado.
   */
  @Delete(':id')
  @ApiDeactivateUser()
  public deactivateUser(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<UserResponse> {
    return this.deactivateUserUseCase.execute(
      this.requireUser(request),
      new GetUserInputDto(id),
    );
  }

  /**
   * Troca a senha de um usuário (provisório — `MANAGE_USERS`).
   *
   * @param request Requisição autenticada.
   * @param id Id da pessoa.
   * @param dto Nova senha (mínimo 6 caracteres).
   */
  @Patch(':id/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiChangePassword()
  public async changePassword(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.changePasswordUseCase.execute(
      this.requireUser(request),
      new ChangePasswordInputDto(id, dto.newPassword),
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
