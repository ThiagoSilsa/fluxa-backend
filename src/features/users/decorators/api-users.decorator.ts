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
import { CreateUserDto } from '../presentation/http/dto/create-user.dto';

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
