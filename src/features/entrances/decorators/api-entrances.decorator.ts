// NestJS
import { applyDecorators } from '@nestjs/common';

// Swagger
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';

// DTOs (apresentação)
import { CreateEntranceDto } from '../presentation/http/dto/create-entrance.dto';
import { UpdateEntranceDto } from '../presentation/http/dto/update-entrance.dto';

/**
 * Documentação Swagger dos endpoints de portarias.
 *
 * Toda documentação de endpoint/schema vive aqui (AGENTS.md §3) — nunca em
 * DTOs.
 */

export function ApiCreateEntrance(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Cria uma portaria',
      description:
        'Exige MANAGE_ENTRANCES. Portaria é independente de departamento (ADR 0006 §5).',
    }),
    ApiBody({ type: CreateEntranceDto }),
    ApiResponse({ status: 201, description: 'Portaria criada.' }),
    ApiResponse({ status: 400, description: 'Validação.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
  );
}

export function ApiListEntrances(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Lista portarias da empresa',
      description:
        'Exige MANAGE_ENTRANCES. Paginado no formato padrão { limit, offset, data, count, parameters? }, com filtros search/isActive.',
    }),
    ApiResponse({ status: 200, description: 'Página de portarias.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
  );
}

export function ApiGetEntrance(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Detalha uma portaria da empresa',
      description:
        'Exige MANAGE_ENTRANCES. Cross-tenant retorna 404 (não revela existência).',
    }),
    ApiParam({ name: 'id', description: 'Id da portaria (UUID).' }),
    ApiResponse({ status: 200, description: 'Portaria.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({ status: 404, description: 'Portaria não encontrada.' }),
  );
}

export function ApiUpdateEntrance(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Atualiza uma portaria (nome)',
      description:
        'Exige MANAGE_ENTRANCES. PATCH parcial — só os campos enviados mudam.',
    }),
    ApiParam({ name: 'id', description: 'Id da portaria (UUID).' }),
    ApiBody({ type: UpdateEntranceDto }),
    ApiResponse({ status: 200, description: 'Portaria atualizada.' }),
    ApiResponse({ status: 400, description: 'Validação.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({ status: 404, description: 'Portaria não encontrada.' }),
  );
}

export function ApiDeleteEntrance(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Exclui uma portaria (físico)',
      description:
        'Exige MANAGE_ENTRANCES. Exclusão física (204); bloqueada com 409 se houver dispositivos da empresa vinculados à portaria via device (ADR 0006 §5). Suspensão reversível continua via PATCH com isActive=false.',
    }),
    ApiParam({ name: 'id', description: 'Id da portaria (UUID).' }),
    ApiResponse({ status: 204, description: 'Portaria excluída.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({ status: 404, description: 'Portaria não encontrada.' }),
    ApiResponse({
      status: 409,
      description: 'Portaria em uso por dispositivos — exclusão bloqueada.',
    }),
  );
}
