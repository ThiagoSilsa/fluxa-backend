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
import { CreateDeviceDto } from '../presentation/http/dto/create-device.dto';
import { UpdateDeviceDto } from '../presentation/http/dto/update-device.dto';

/**
 * Documentação Swagger dos endpoints de dispositivos.
 *
 * Toda documentação de endpoint/schema vive aqui (AGENTS.md §3) — nunca em
 * DTOs.
 */

export function ApiCreateDevice(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Cria um dispositivo',
      description:
        'Exige MANAGE_DEVICES. Gera o token (write-only) e o devolve apenas nesta resposta (ADR 0008 §3). Vínculo com portaria opcional e exige portaria ativa da empresa.',
    }),
    ApiBody({ type: CreateDeviceDto }),
    ApiResponse({ status: 201, description: 'Dispositivo criado + token.' }),
    ApiResponse({ status: 400, description: 'Validação ou portaria inativa.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({ status: 404, description: 'Portaria não encontrada.' }),
  );
}

export function ApiListDevices(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Lista dispositivos da empresa',
      description:
        'Exige MANAGE_DEVICES. Paginado no formato padrão { limit, offset, data, count, parameters? }, com busca por nome, filtro isActive e ordenação; parameters traz as portarias ativas (ADR 0008 §5).',
    }),
    ApiResponse({ status: 200, description: 'Página de dispositivos.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
  );
}

export function ApiGetDevice(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Detalha um dispositivo da empresa',
      description:
        'Exige MANAGE_DEVICES. O token nunca é exposto (write-only). Cross-tenant retorna 404 (não revela existência).',
    }),
    ApiParam({ name: 'id', description: 'Id do dispositivo (UUID).' }),
    ApiResponse({ status: 200, description: 'Dispositivo.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({ status: 404, description: 'Dispositivo não encontrado.' }),
  );
}

export function ApiUpdateDevice(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Atualiza um dispositivo (nome, portaria, status)',
      description:
        'Exige MANAGE_DEVICES. PATCH parcial — só os campos enviados mudam. entranceId: null desvincula a portaria. Desativar (isActive=false) suspende o token (ADR 0008 §6).',
    }),
    ApiParam({ name: 'id', description: 'Id do dispositivo (UUID).' }),
    ApiBody({ type: UpdateDeviceDto }),
    ApiResponse({ status: 200, description: 'Dispositivo atualizado.' }),
    ApiResponse({ status: 400, description: 'Validação ou portaria inativa.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({ status: 404, description: 'Dispositivo não encontrado.' }),
  );
}

export function ApiDeleteDevice(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Exclui um dispositivo (físico)',
      description:
        'Exige MANAGE_DEVICES. Exclusão física (204) — o device não tem FK de referência (ADR 0008 §6). Suspensão reversível continua via PATCH com isActive=false.',
    }),
    ApiParam({ name: 'id', description: 'Id do dispositivo (UUID).' }),
    ApiResponse({ status: 204, description: 'Dispositivo excluído.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({ status: 404, description: 'Dispositivo não encontrado.' }),
  );
}

export function ApiRotateDeviceToken(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Rotaciona o token de um dispositivo',
      description:
        'Exige MANAGE_DEVICES. Gera um novo token (write-only) e o devolve apenas nesta resposta; o anterior deixa de valer (ADR 0008 §3).',
    }),
    ApiParam({ name: 'id', description: 'Id do dispositivo (UUID).' }),
    ApiResponse({ status: 200, description: 'Dispositivo + novo token.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({ status: 404, description: 'Dispositivo não encontrado.' }),
  );
}
