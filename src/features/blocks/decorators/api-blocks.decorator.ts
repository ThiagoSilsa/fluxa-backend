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
import { CreateBlockDto } from '../presentation/http/dto/create-block.dto';
import { CreateBlockRequestDto } from '../presentation/http/dto/create-block-request.dto';
import { RegisterEntryDenialDto } from '../presentation/http/dto/register-entry-denial.dto';
import { RevokeBlockDto } from '../presentation/http/dto/revoke-block.dto';

/**
 * Documentação Swagger dos endpoints de bloqueios, impedimentos e pedidos de
 * bloqueio.
 *
 * Toda documentação de endpoint/schema vive aqui (AGENTS.md §3) — nunca em
 * DTOs.
 */

export function ApiCreateBlock(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Bloqueia um veículo/placa',
      description:
        'Exige MANAGE_BLOCKS. Motivo obrigatório; funciona para veículo cadastrado ou não (vínculo por placa). Mantém vehicle.is_blocked na mesma transação (ADR 0010 §2). 409 se já bloqueado ativamente.',
    }),
    ApiBody({ type: CreateBlockDto }),
    ApiResponse({ status: 201, description: 'Bloqueio criado.' }),
    ApiResponse({ status: 400, description: 'Validação (placa/motivo).' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({ status: 409, description: 'Veículo/placa já bloqueado.' }),
  );
}

export function ApiListBlocks(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Lista bloqueios da empresa',
      description:
        'Exige MANAGE_BLOCKS. Paginado no formato padrão { limit, offset, data, count }, com busca por placa e filtro de status.',
    }),
    ApiResponse({ status: 200, description: 'Página de bloqueios.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
  );
}

export function ApiGetBlock(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Detalha um bloqueio da empresa',
      description:
        'Exige MANAGE_BLOCKS. Cross-tenant retorna 404 (não revela existência).',
    }),
    ApiParam({ name: 'id', description: 'Id do bloqueio (UUID).' }),
    ApiResponse({ status: 200, description: 'Bloqueio.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({ status: 404, description: 'Bloqueio não encontrado.' }),
  );
}

export function ApiRevokeBlock(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Revoga um bloqueio (motivo obrigatório)',
      description:
        'Exige MANAGE_BLOCKS. `ACTIVE → REVOKED` + recalcula vehicle.is_blocked na mesma transação (ADR 0010 §2). 409 se o bloqueio não está ativo.',
    }),
    ApiParam({ name: 'id', description: 'Id do bloqueio (UUID).' }),
    ApiBody({ type: RevokeBlockDto }),
    ApiResponse({ status: 200, description: 'Bloqueio revogado.' }),
    ApiResponse({ status: 400, description: 'Motivo obrigatório.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({ status: 404, description: 'Bloqueio não encontrado.' }),
    ApiResponse({ status: 409, description: 'Bloqueio já revogado.' }),
  );
}

export function ApiRegisterEntryDenial(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Registra um impedimento de entrada (ledger)',
      description:
        'Exige REGISTER_DENIAL. Ledger append-only (nunca alterado). No access core o impedimento é registrado automaticamente ao negar (ADR 0010 §3); aqui é o registro manual.',
    }),
    ApiBody({ type: RegisterEntryDenialDto }),
    ApiResponse({ status: 201, description: 'Impedimento registrado.' }),
    ApiResponse({ status: 400, description: 'Validação.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
  );
}

export function ApiCreateBlockRequest(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Solicita o bloqueio de um veículo/placa (porteiro)',
      description:
        'Exige CREATE_BLOCK_REQUEST. Motivo obrigatório; placa de veículo cadastrado ou não. 409 se já houver solicitação pendente da placa.',
    }),
    ApiBody({ type: CreateBlockRequestDto }),
    ApiResponse({ status: 201, description: 'Solicitação criada (PENDING).' }),
    ApiResponse({ status: 400, description: 'Validação.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({
      status: 409,
      description: 'Solicitação pendente já existe.',
    }),
  );
}

export function ApiListBlockRequests(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Lista solicitações de bloqueio (admin/segurança)',
      description:
        'Exige MANAGE_BLOCKS. Paginado no formato padrão, com filtro de status.',
    }),
    ApiResponse({ status: 200, description: 'Página de solicitações.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
  );
}

export function ApiApproveBlockRequest(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Aprova uma solicitação de bloqueio (cria o bloqueio)',
      description:
        'Exige MANAGE_BLOCKS. Cria o vehicle_block (MANUAL, blocked_by = admin) e marca a solicitação APPROVED com resolved_block_id. 409 se não está pendente ou já bloqueado.',
    }),
    ApiParam({ name: 'id', description: 'Id da solicitação (UUID).' }),
    ApiResponse({
      status: 200,
      description: 'Solicitação aprovada + bloqueio criado.',
    }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({ status: 404, description: 'Solicitação não encontrada.' }),
    ApiResponse({
      status: 409,
      description: 'Não está pendente / já bloqueado.',
    }),
  );
}

export function ApiRejectBlockRequest(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Rejeita uma solicitação de bloqueio (não cria bloqueio)',
      description:
        'Exige MANAGE_BLOCKS. Marca a solicitação REJECTED com handled_by/at e observação.',
    }),
    ApiParam({ name: 'id', description: 'Id da solicitação (UUID).' }),
    ApiResponse({ status: 200, description: 'Solicitação rejeitada.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({ status: 404, description: 'Solicitação não encontrada.' }),
    ApiResponse({ status: 409, description: 'Não está pendente.' }),
  );
}

export function ApiCancelBlockRequest(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Cancela a própria solicitação de bloqueio pendente (porteiro)',
      description:
        'Exige CREATE_BLOCK_REQUEST. Apenas a própria solicitação e em PENDING. A administração usa aprovar/rejeitar.',
    }),
    ApiParam({ name: 'id', description: 'Id da solicitação (UUID).' }),
    ApiResponse({ status: 200, description: 'Solicitação cancelada.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Não é do próprio porteiro.' }),
    ApiResponse({ status: 404, description: 'Solicitação não encontrada.' }),
    ApiResponse({ status: 409, description: 'Não está pendente.' }),
  );
}
