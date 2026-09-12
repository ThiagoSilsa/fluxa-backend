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
import { AcceptAccessRequestDto } from '../presentation/http/dto/accept-access-request.dto';
import { CreateAccessRequestDto } from '../presentation/http/dto/create-access-request.dto';
import { HandleAccessRequestDto } from '../presentation/http/dto/handle-access-request.dto';

/**
 * Documentação Swagger dos endpoints de solicitações de acesso.
 *
 * Toda documentação de endpoint/schema vive aqui (AGENTS.md §3) — nunca em
 * DTOs.
 */

export function ApiCreateAccessRequest(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Cria uma solicitação de acesso (porteiro)',
      description:
        'Exige CREATE_ACCESS_REQUEST. Cenários NEW_USER/NEW_VEHICLE/LINK/BOTH (regra 41); contato obrigatório em NEW_USER/NEW_VEHICLE/BOTH; departamento só aceita depto já criado. O e-mail do motorista é obrigatório apenas quando userType = EMPLOYEE (Colaborador); VISITOR pode não ter e-mail (ADR 0013). 409 se já existe solicitação aberta da placa.',
    }),
    ApiBody({ type: CreateAccessRequestDto }),
    ApiResponse({ status: 201, description: 'Solicitação criada (PENDING).' }),
    ApiResponse({ status: 400, description: 'Validação.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({
      status: 404,
      description: 'Veículo/usuário/departamento não encontrado.',
    }),
    ApiResponse({
      status: 409,
      description:
        'Solicitação aberta da placa já existe / e-mail já cadastrado.',
    }),
  );
}

export function ApiListAccessRequests(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Lista solicitações de acesso (por papel)',
      description:
        'Escalonada por papel (ADR 0012): quem tem MANAGE_ACCESS_REQUESTS vê todas; quem tem apenas CREATE_ACCESS_REQUEST vê somente as próprias. Paginado no formato padrão, com filtro de status e busca por placa.',
    }),
    ApiResponse({ status: 200, description: 'Página de solicitações.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
  );
}

export function ApiGetAccessRequest(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Detalha uma solicitação de acesso (por papel)',
      description:
        'Escalonada por papel (ADR 0012): o gestor vê qualquer; o solicitante vê apenas a própria. Solicitação inexistente ou de terceiro (sem gestão) retorna 404 (não revela existência).',
    }),
    ApiParam({ name: 'id', description: 'Id da solicitação (UUID).' }),
    ApiResponse({ status: 200, description: 'Solicitação.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({ status: 404, description: 'Solicitação não encontrada.' }),
  );
}

export function ApiAcceptAccessRequest(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary:
        'Aceita uma solicitação com resolução retroativa (administração)',
      description:
        'Exige MANAGE_ACCESS_REQUESTS. Resolve cadastros/vínculo por cenário e autoriza a entrada (entry_authorized = true — ADR 0010 §4). O usuário criado segue o user_type da solicitação (ADR 0013): VISITOR sem credenciais/cargo; EMPLOYEE exige roleId e password no aceite (400 sem eles) e grava hash + cargo. Telefone: payload.driver.phone, senão contactPhone. Vínculo existente com can_drive = false é atualizado para true (regra 42); 409 se não está aberta, se o vínculo já permite dirigir ou se o e-mail já existe.',
    }),
    ApiParam({ name: 'id', description: 'Id da solicitação (UUID).' }),
    ApiBody({ type: AcceptAccessRequestDto }),
    ApiResponse({
      status: 200,
      description: 'Solicitação registrada (REGISTERED).',
    }),
    ApiResponse({
      status: 400,
      description: 'Colaborador sem cargo ou senha no aceite.',
    }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({
      status: 404,
      description: 'Solicitação/veículo/usuário/tipo/cargo não encontrado.',
    }),
    ApiResponse({
      status: 409,
      description:
        'Não está aberta / vínculo já autorizado a dirigir / e-mail já existe / tipo não informado.',
    }),
  );
}

export function ApiRejectAccessRequest(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Rejeita uma solicitação de acesso (administração)',
      description:
        'Exige MANAGE_ACCESS_REQUESTS. Não cria cadastros/vínculo. Duplicidade também vira REJECTED (regra 47).',
    }),
    ApiParam({ name: 'id', description: 'Id da solicitação (UUID).' }),
    ApiBody({ type: HandleAccessRequestDto }),
    ApiResponse({ status: 200, description: 'Solicitação rejeitada.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({ status: 404, description: 'Solicitação não encontrada.' }),
    ApiResponse({ status: 409, description: 'Não está aberta.' }),
  );
}

export function ApiMarkInContactAccessRequest(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Marca uma solicitação como IN_CONTACT (administração)',
      description:
        'Exige MANAGE_ACCESS_REQUESTS. Estende o prazo do bloqueio automático (regra 39).',
    }),
    ApiParam({ name: 'id', description: 'Id da solicitação (UUID).' }),
    ApiBody({ type: HandleAccessRequestDto }),
    ApiResponse({ status: 200, description: 'Solicitação em contato.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({ status: 404, description: 'Solicitação não encontrada.' }),
    ApiResponse({ status: 409, description: 'Não está pendente.' }),
  );
}

export function ApiCancelAccessRequest(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Cancela a própria solicitação pendente (porteiro)',
      description:
        'Exige CANCEL_ACCESS_REQUEST. Apenas a própria solicitação e em PENDING (regra 49).',
    }),
    ApiParam({ name: 'id', description: 'Id da solicitação (UUID).' }),
    ApiResponse({ status: 200, description: 'Solicitação cancelada.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Não é do próprio porteiro.' }),
    ApiResponse({ status: 404, description: 'Solicitação não encontrada.' }),
    ApiResponse({ status: 409, description: 'Não está pendente.' }),
  );
}
