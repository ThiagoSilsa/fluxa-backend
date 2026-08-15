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
import { CreateVehicleDto } from '../presentation/http/dto/create-vehicle.dto';
import { CreateVehicleTypeDto } from '../presentation/http/dto/create-vehicle-type.dto';
import { UpdateVehicleDto } from '../presentation/http/dto/update-vehicle.dto';
import { UpdateVehicleTypeDto } from '../presentation/http/dto/update-vehicle-type.dto';

/**
 * Documentação Swagger dos endpoints de tipos de veículo e veículos.
 *
 * Toda documentação de endpoint/schema vive aqui (AGENTS.md §3) — nunca em
 * DTOs.
 */

// ---- vehicle_type ----

export function ApiCreateVehicleType(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Cria um tipo de veículo',
      description:
        'Exige MANAGE_VEHICLE_TYPES. code normalizado e único por empresa (ADR 0006 §6).',
    }),
    ApiBody({ type: CreateVehicleTypeDto }),
    ApiResponse({ status: 201, description: 'Tipo criado.' }),
    ApiResponse({ status: 400, description: 'Validação.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({ status: 409, description: 'Código já cadastrado.' }),
  );
}

export function ApiListVehicleTypes(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Lista tipos de veículo da empresa',
      description:
        'Exige MANAGE_VEHICLE_TYPES. Paginado no formato padrão { limit, offset, data, count, parameters? }, com filtros search/isFleet/isActive.',
    }),
    ApiResponse({ status: 200, description: 'Página de tipos.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
  );
}

export function ApiGetVehicleType(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Detalha um tipo de veículo da empresa',
      description:
        'Exige MANAGE_VEHICLE_TYPES. Cross-tenant retorna 404 (não revela existência).',
    }),
    ApiParam({ name: 'id', description: 'Id do tipo (UUID).' }),
    ApiResponse({ status: 200, description: 'Tipo.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({ status: 404, description: 'Tipo não encontrado.' }),
  );
}

export function ApiUpdateVehicleType(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary:
        'Atualiza um tipo de veículo (código/nome/descrição/classificação)',
      description:
        'Exige MANAGE_VEHICLE_TYPES. PATCH parcial; code normalizado e 409 em conflito.',
    }),
    ApiParam({ name: 'id', description: 'Id do tipo (UUID).' }),
    ApiBody({ type: UpdateVehicleTypeDto }),
    ApiResponse({ status: 200, description: 'Tipo atualizado.' }),
    ApiResponse({ status: 400, description: 'Validação.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({ status: 404, description: 'Tipo não encontrado.' }),
    ApiResponse({ status: 409, description: 'Código já cadastrado.' }),
  );
}

export function ApiDeactivateVehicleType(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Desativa um tipo de veículo (soft)',
      description:
        'Exige MANAGE_VEHICLE_TYPES. Desativar não remove os veículos que o usam (ADR 0006 §6); reativar é PATCH com isActive=true.',
    }),
    ApiParam({ name: 'id', description: 'Id do tipo (UUID).' }),
    ApiResponse({ status: 200, description: 'Tipo desativado.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({ status: 404, description: 'Tipo não encontrado.' }),
  );
}

// ---- vehicle ----

export function ApiCreateVehicle(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Cria um veículo',
      description:
        'Exige MANAGE_VEHICLES. Placa normalizada e validada (400); free_pass=true exige GRANT_FREE_PASS (403); is_blocked é derivado (400); vehicle_type_id ativo da empresa (404/400).',
    }),
    ApiBody({ type: CreateVehicleDto }),
    ApiResponse({ status: 201, description: 'Veículo criado.' }),
    ApiResponse({
      status: 400,
      description: 'Placa inválida, tipo inativo ou is_blocked.',
    }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({
      status: 403,
      description: 'Permissão insuficiente (ou sem GRANT_FREE_PASS).',
    }),
    ApiResponse({
      status: 404,
      description: 'Tipo de veículo não encontrado.',
    }),
    ApiResponse({ status: 409, description: 'Placa já cadastrada.' }),
  );
}

export function ApiListVehicles(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Lista veículos da empresa',
      description:
        'Exige MANAGE_VEHICLES. Paginado no formato padrão { limit, offset, data, count, parameters? }, com filtros search/vehicleTypeId/freePass/isActive; search normaliza a placa.',
    }),
    ApiResponse({ status: 200, description: 'Página de veículos.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
  );
}

export function ApiGetVehicle(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Detalha um veículo da empresa (com o tipo)',
      description:
        'Exige MANAGE_VEHICLES. Cross-tenant retorna 404 (não revela existência).',
    }),
    ApiParam({ name: 'id', description: 'Id do veículo (UUID).' }),
    ApiResponse({ status: 200, description: 'Veículo.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({ status: 404, description: 'Veículo não encontrado.' }),
  );
}

export function ApiUpdateVehicle(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Atualiza um veículo (PATCH parcial)',
      description:
        'Exige MANAGE_VEHICLES. Placa normalizada/validada (400/409); free_pass=true exige GRANT_FREE_PASS (403); is_blocked é derivado (400); vehicle_type_id ativo (404/400).',
    }),
    ApiParam({ name: 'id', description: 'Id do veículo (UUID).' }),
    ApiBody({ type: UpdateVehicleDto }),
    ApiResponse({ status: 200, description: 'Veículo atualizado.' }),
    ApiResponse({
      status: 400,
      description: 'Placa inválida, tipo inativo ou is_blocked.',
    }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({
      status: 403,
      description: 'Permissão insuficiente (ou sem GRANT_FREE_PASS).',
    }),
    ApiResponse({
      status: 404,
      description: 'Veículo ou tipo não encontrado.',
    }),
    ApiResponse({ status: 409, description: 'Placa já cadastrada.' }),
  );
}

export function ApiDeactivateVehicle(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Desativa um veículo (soft)',
      description:
        'Exige MANAGE_VEHICLES. Desativar não fecha acessos INSIDE, não revoga QR/bloqueios (ADR 0006 §10); reativar é PATCH com isActive=true.',
    }),
    ApiParam({ name: 'id', description: 'Id do veículo (UUID).' }),
    ApiResponse({ status: 200, description: 'Veículo desativado.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({ status: 404, description: 'Veículo não encontrado.' }),
  );
}
