// NestJS
import { applyDecorators } from '@nestjs/common';

// Swagger
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';

// DTOs (apresentação)
import { AssignRoleDto } from '../presentation/http/dto/assign-role.dto';
import { ChangePasswordDto } from '../presentation/http/dto/change-password.dto';
import { CreateUserDto } from '../presentation/http/dto/create-user.dto';
import { UpdateUserDto } from '../presentation/http/dto/update-user.dto';

/**
 * Documentação Swagger dos endpoints de usuários.
 *
 * Toda documentação de endpoint/schema vive aqui (AGENTS.md §3) — nunca em
 * DTOs.
 */

export function ApiCreateUser(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Cria um usuário (já vinculado à empresa)',
      description:
        'Exige MANAGE_USERS. Pessoa nova → cria user + user_company. Pessoa já existente em outra empresa → cria apenas o vínculo (body sem dados da pessoa/senha → 400). Vínculo já existente → 409.',
    }),
    ApiBody({ type: CreateUserDto }),
    ApiResponse({ status: 201, description: 'Usuário criado/vinculado.' }),
    ApiResponse({
      status: 400,
      description: 'Validação, dados da pessoa no vínculo ou senha curta.',
    }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({
      status: 409,
      description: 'Vínculo/documento/e-mail já existente.',
    }),
  );
}

export function ApiListUsers(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Lista usuários da empresa',
      description:
        'Exige MANAGE_USERS. Paginado no formato padrão { limit, offset, data, count, parameters? } com busca (nome/e-mail) e filtros (type, isActive).',
    }),
    ApiResponse({ status: 200, description: 'Página de usuários.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
  );
}

export function ApiGetUser(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Detalha um usuário da empresa',
      description:
        'Exige MANAGE_USERS. Usuário sem vínculo com a empresa da sessão → 404 (não revela existência em outra empresa).',
    }),
    ApiParam({ name: 'id', description: 'Id da pessoa (UUID).' }),
    ApiResponse({ status: 200, description: 'Dados do usuário.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({
      status: 404,
      description: 'Usuário sem vínculo com a empresa.',
    }),
  );
}

export function ApiEmailStatus(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Consulta se um e-mail já existe',
      description:
        'Exige MANAGE_USERS. Devolve apenas { exists } — não vaza nome nem em quais empresas a pessoa está. Use no frontend com debounce para transformar o formulário em "vincular".',
    }),
    ApiQuery({ name: 'email', description: 'E-mail a consultar.' }),
    ApiResponse({ status: 200, description: '{ exists: boolean }.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
  );
}

export function ApiUpdateUser(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Edita parcialmente um usuário da empresa',
      description:
        'Exige MANAGE_USERS. Dados da pessoa refletem em todas as empresas; type/is_active só na empresa da sessão. Email/documento de outra pessoa → 409. Desativar o último admin → 409. Editar admin exige ator admin → 403.',
    }),
    ApiParam({ name: 'id', description: 'Id da pessoa (UUID).' }),
    ApiBody({ type: UpdateUserDto }),
    ApiResponse({ status: 200, description: 'Usuário atualizado.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({
      status: 404,
      description: 'Usuário sem vínculo com a empresa.',
    }),
    ApiResponse({
      status: 409,
      description: 'Email/documento já cadastrado ou último admin.',
    }),
  );
}

export function ApiDeleteUser(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Exclui a participação do usuário na empresa',
      description:
        'Exige MANAGE_USERS. Remove user_role e user_company da empresa; se for a última empresa da pessoa sem histórico operacional, remove também a pessoa. Último admin ativo → 409. Excluir admin exige ator admin → 403.',
    }),
    ApiParam({ name: 'id', description: 'Id da pessoa (UUID).' }),
    ApiResponse({ status: 204, description: 'Participação excluída.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({
      status: 404,
      description: 'Usuário sem vínculo com a empresa.',
    }),
    ApiResponse({
      status: 409,
      description: 'Não é possível remover o último administrador ativo.',
    }),
  );
}

export function ApiChangePassword(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Troca a senha de um usuário (provisório)',
      description:
        'Exige MANAGE_USERS. Medida provisória (ADR 0005 §6): a senha é da pessoa e a troca vale para todos os vínculos. Alvo sem vínculo ativo → 404. Trocar senha de admin exige ator admin → 403.',
    }),
    ApiParam({ name: 'id', description: 'Id da pessoa (UUID).' }),
    ApiBody({ type: ChangePasswordDto }),
    ApiResponse({ status: 204, description: 'Senha alterada.' }),
    ApiResponse({
      status: 400,
      description: 'Senha com menos de 6 caracteres.',
    }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({
      status: 404,
      description: 'Usuário sem vínculo ativo com a empresa.',
    }),
  );
}

export function ApiAssignRole(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Atribui um cargo a um usuário',
      description:
        'Exige MANAGE_USERS. Cargo deve pertencer à empresa da sessão. Atribuir cargo is_admin ou gerenciar cargo de usuário admin exige ator admin → 403. Duplicidade → 409.',
    }),
    ApiParam({ name: 'userId', description: 'Id da pessoa (UUID).' }),
    ApiBody({ type: AssignRoleDto }),
    ApiResponse({ status: 201, description: 'Cargo atribuído.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({
      status: 404,
      description: 'Usuário ou cargo não encontrado.',
    }),
    ApiResponse({ status: 409, description: 'Usuário já possui o cargo.' }),
  );
}

export function ApiListUserRoles(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Lista os cargos de um usuário',
      description:
        'Exige MANAGE_USERS. Escopo pela empresa da sessão; usuário sem vínculo → 404.',
    }),
    ApiParam({ name: 'userId', description: 'Id da pessoa (UUID).' }),
    ApiResponse({ status: 200, description: 'Cargos do usuário.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({
      status: 404,
      description: 'Usuário sem vínculo com a empresa.',
    }),
  );
}

export function ApiRemoveRole(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Remove um cargo de um usuário',
      description:
        'Exige MANAGE_USERS. Remover cargo is_admin ou gerenciar cargo de usuário admin exige ator admin → 403. Remover o cargo do último admin ativo → 409.',
    }),
    ApiParam({ name: 'userId', description: 'Id da pessoa (UUID).' }),
    ApiParam({ name: 'roleId', description: 'Id do cargo (UUID).' }),
    ApiResponse({ status: 204, description: 'Cargo removido.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({
      status: 404,
      description: 'Usuário, cargo ou vínculo não encontrado.',
    }),
    ApiResponse({
      status: 409,
      description: 'Não é possível remover o último administrador ativo.',
    }),
  );
}

export function ApiImportUsers(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Importa usuários por planilha XLSX',
      description:
        'Exige MANAGE_IMPORTS. Envia multipart com o campo file (.xlsx ≤ 50MB, aba fixa "data"). Colunas: email, name, type, password, phone, document, role. Senha em branco usa a default de onboarding (IMPORT_DEFAULT_PASSWORD). O upload valida a estrutura, cria um job e enfileira o processamento (ADR 0007); a UI acompanha via GET /import-jobs/:jobId.',
    }),
    ApiBody({
      schema: {
        type: 'object',
        required: ['file'],
        properties: {
          file: { type: 'string', format: 'binary' },
        },
      },
    }),
    ApiResponse({
      status: 201,
      description: 'Job criado e enfileirado: { jobId, status: PENDING }.',
    }),
    ApiResponse({ status: 400, description: 'Arquivo/planilha inválidos.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
  );
}
