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
import { AssociatePermissionDto } from '../presentation/http/dto/associate-permission.dto';
import { CreateRoleDto } from '../presentation/http/dto/create-role.dto';
import { UpdateRoleDto } from '../presentation/http/dto/update-role.dto';

/**
 * Documentação Swagger dos endpoints de cargos e permissões.
 *
 * Toda documentação de endpoint/schema vive aqui (AGENTS.md §3) — nunca em
 * DTOs.
 */

export function ApiCreateRole(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Cria um cargo',
      description:
        'Exige MANAGE_ROLES. Cargos com is_admin são proibidos (ADR 0004).',
    }),
    ApiBody({ type: CreateRoleDto }),
    ApiResponse({ status: 201, description: 'Cargo criado.' }),
    ApiResponse({
      status: 400,
      description: 'is_admin não permitido ou validação.',
    }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
  );
}

export function ApiListRoles(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Lista cargos da empresa',
      description:
        'Exige MANAGE_ROLES. Paginado no formato padrão { limit, offset, data, count, parameters? }.',
    }),
    ApiResponse({ status: 200, description: 'Página de cargos.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
  );
}

export function ApiGetRole(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Detalha um cargo da empresa',
      description:
        'Exige MANAGE_ROLES. Cross-tenant retorna 404 (não revela existência).',
    }),
    ApiParam({ name: 'id', description: 'Id do cargo (UUID).' }),
    ApiResponse({ status: 200, description: 'Cargo.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({ status: 404, description: 'Cargo não encontrado.' }),
  );
}

export function ApiUpdateRole(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Atualiza um cargo (nome/descrição)',
      description:
        'Exige MANAGE_ROLES. is_admin não é alterável e cargos de administração são imutáveis (ADR 0004).',
    }),
    ApiParam({ name: 'id', description: 'Id do cargo (UUID).' }),
    ApiBody({ type: UpdateRoleDto }),
    ApiResponse({ status: 200, description: 'Cargo atualizado.' }),
    ApiResponse({
      status: 400,
      description: 'Cargo de administração é imutável.',
    }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({ status: 404, description: 'Cargo não encontrado.' }),
  );
}

export function ApiDeactivateRole(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Desativa um cargo (soft)',
      description:
        'Exige MANAGE_ROLES. Desativar não remove vínculos (role_permission/user_role); cargos de administração são imutáveis (ADR 0004).',
    }),
    ApiParam({ name: 'id', description: 'Id do cargo (UUID).' }),
    ApiResponse({ status: 200, description: 'Cargo desativado.' }),
    ApiResponse({
      status: 400,
      description: 'Cargo de administração é imutável.',
    }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({ status: 404, description: 'Cargo não encontrado.' }),
  );
}

export function ApiListPermissions(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Lista o catálogo global de permissões',
      description:
        'Acessível a administradores (is_admin) OU quem possui MANAGE_ROLES (ADR 0004 §1).',
    }),
    ApiResponse({ status: 200, description: 'Catálogo de permissões.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
  );
}

export function ApiAssociatePermission(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Associa uma permissão do catálogo a um cargo',
      description:
        'Exige MANAGE_ROLES. Cargo e permissão devem existir; vínculo não pode ser duplicado (unique company+role+permission).',
    }),
    ApiParam({ name: 'id', description: 'Id do cargo (UUID).' }),
    ApiBody({ type: AssociatePermissionDto }),
    ApiResponse({ status: 201, description: 'Permissão vinculada.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({
      status: 404,
      description: 'Cargo ou permissão não encontrado.',
    }),
    ApiResponse({ status: 409, description: 'Vínculo já existente.' }),
  );
}

export function ApiRemovePermission(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Remove a associação de uma permissão a um cargo',
      description: 'Exige MANAGE_ROLES. Vínculo ausente retorna 404.',
    }),
    ApiParam({ name: 'id', description: 'Id do cargo (UUID).' }),
    ApiParam({ name: 'permissionId', description: 'Id da permissão (UUID).' }),
    ApiResponse({ status: 204, description: 'Vínculo removido.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({
      status: 404,
      description: 'Cargo ou vínculo não encontrado.',
    }),
  );
}

export function ApiListRolePermissions(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Lista as permissões de um cargo + catálogo disponível',
      description:
        'Exige MANAGE_ROLES. Devolve as permissões vinculadas e o catálogo global disponível (para a web montar os checkboxes).',
    }),
    ApiParam({ name: 'id', description: 'Id do cargo (UUID).' }),
    ApiResponse({
      status: 200,
      description: 'Permissões vinculadas + disponíveis.',
    }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({ status: 404, description: 'Cargo não encontrado.' }),
  );
}
