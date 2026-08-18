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
import { CreateDepartmentDto } from '../presentation/http/dto/create-department.dto';
import { UpdateDepartmentDto } from '../presentation/http/dto/update-department.dto';

/**
 * Documentação Swagger dos endpoints de departamentos.
 *
 * Toda documentação de endpoint/schema vive aqui (AGENTS.md §3) — nunca em
 * DTOs.
 */

export function ApiCreateDepartment(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Cria um departamento',
      description:
        'Exige MANAGE_DEPARTMENTS. parkingSpace (vagas) é obrigatório e >= 0 (ADR 0006 §7).',
    }),
    ApiBody({ type: CreateDepartmentDto }),
    ApiResponse({ status: 201, description: 'Departamento criado.' }),
    ApiResponse({
      status: 400,
      description: 'Validação (vagas obrigatórias).',
    }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
  );
}

export function ApiListDepartments(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Lista departamentos da empresa',
      description:
        'Exige MANAGE_DEPARTMENTS. Paginado no formato padrão { limit, offset, data, count, parameters? }, com filtros search/isActive.',
    }),
    ApiResponse({ status: 200, description: 'Página de departamentos.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
  );
}

export function ApiGetDepartment(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Detalha um departamento da empresa',
      description:
        'Exige MANAGE_DEPARTMENTS. Cross-tenant retorna 404 (não revela existência).',
    }),
    ApiParam({ name: 'id', description: 'Id do departamento (UUID).' }),
    ApiResponse({ status: 200, description: 'Departamento.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({ status: 404, description: 'Departamento não encontrado.' }),
  );
}

export function ApiUpdateDepartment(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Atualiza um departamento (nome/descrição/vagas)',
      description:
        'Exige MANAGE_DEPARTMENTS. PATCH parcial — só os campos enviados mudam.',
    }),
    ApiParam({ name: 'id', description: 'Id do departamento (UUID).' }),
    ApiBody({ type: UpdateDepartmentDto }),
    ApiResponse({ status: 200, description: 'Departamento atualizado.' }),
    ApiResponse({ status: 400, description: 'Validação.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({ status: 404, description: 'Departamento não encontrado.' }),
  );
}

export function ApiDeleteDepartment(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Exclui um departamento (físico)',
      description:
        'Exige MANAGE_DEPARTMENTS. Exclusão física (204); bloqueada com 409 se houver veículos da empresa vinculados ao departamento via vehicle_department (departamento padrão — ADR 0006 §7). Suspensão reversível continua via PATCH com isActive=false.',
    }),
    ApiParam({ name: 'id', description: 'Id do departamento (UUID).' }),
    ApiResponse({ status: 204, description: 'Departamento excluído.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({ status: 404, description: 'Departamento não encontrado.' }),
    ApiResponse({
      status: 409,
      description: 'Departamento em uso por veículos — exclusão bloqueada.',
    }),
  );
}
