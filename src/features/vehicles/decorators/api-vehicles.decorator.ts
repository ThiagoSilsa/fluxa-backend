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
import { AssignDriverDto } from '../presentation/http/dto/assign-driver.dto';
import { CreateVehicleDto } from '../presentation/http/dto/create-vehicle.dto';
import { CreateVehicleTypeDto } from '../presentation/http/dto/create-vehicle-type.dto';
import { SetVehicleDepartmentDto } from '../presentation/http/dto/set-vehicle-department.dto';
import { UpdateDriverDto } from '../presentation/http/dto/update-driver.dto';
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

export function ApiDeleteVehicleType(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Exclui um tipo de veículo (físico)',
      description:
        'Exige MANAGE_VEHICLE_TYPES. Exclusão física (204); bloqueada com 409 se houver veículos da empresa usando o tipo (FK vehicle.vehicle_type_id). Suspensão reversível continua via PATCH com isActive=false.',
    }),
    ApiParam({ name: 'id', description: 'Id do tipo (UUID).' }),
    ApiResponse({ status: 204, description: 'Tipo excluído.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({ status: 404, description: 'Tipo não encontrado.' }),
    ApiResponse({
      status: 409,
      description: 'Tipo em uso por veículos — exclusão bloqueada.',
    }),
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

export function ApiDeleteVehicle(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Exclui um veículo (físico)',
      description:
        'Exige MANAGE_VEHICLES. Exclusão física (204); bloqueada com 409 se houver vínculos da empresa (departamento padrão via vehicle_department ou motoristas via user_vehicle — ADR 0006 §9/§10). Suspensão reversível continua via PATCH com isActive=false.',
    }),
    ApiParam({ name: 'id', description: 'Id do veículo (UUID).' }),
    ApiResponse({ status: 204, description: 'Veículo excluído.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({ status: 404, description: 'Veículo não encontrado.' }),
    ApiResponse({
      status: 409,
      description: 'Veículo em uso por vínculos — exclusão bloqueada.',
    }),
  );
}

export function ApiListDriverCandidates(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Lista candidatos a motorista da empresa',
      description:
        'Exige MANAGE_VEHICLES. Pessoas com vínculo user_company ativo na empresa da sessão (pré-requisito para vincular como motorista — ADR 0006 §9). Paginado no formato padrão, com busca por nome.',
    }),
    ApiResponse({ status: 200, description: 'Página de candidatos.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
  );
}

// ---- vehicle_department ----

export function ApiGetVehicleDepartment(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Detalha o departamento padrão do veículo',
      description:
        'Exige MANAGE_VEHICLES. Devolve o vínculo ativo (com o departamento) ou 404 (veículo inexistente ou sem vínculo).',
    }),
    ApiParam({ name: 'vehicleId', description: 'Id do veículo (UUID).' }),
    ApiResponse({ status: 200, description: 'Vínculo ativo.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({
      status: 404,
      description: 'Veículo não encontrado ou sem vínculo.',
    }),
  );
}

export function ApiSetVehicleDepartment(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary:
        'Define o departamento padrão do veículo (upsert na linha única)',
      description:
        'Exige MANAGE_VEHICLES. PUT: cria/reativa/atualiza o vínculo único (ADR 0006 §8); departamento deve estar ativo (400).',
    }),
    ApiParam({ name: 'vehicleId', description: 'Id do veículo (UUID).' }),
    ApiBody({ type: SetVehicleDepartmentDto }),
    ApiResponse({ status: 200, description: 'Vínculo ativo.' }),
    ApiResponse({ status: 400, description: 'Departamento inativo.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({
      status: 404,
      description: 'Veículo ou departamento não encontrado.',
    }),
  );
}

export function ApiRemoveVehicleDepartment(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Remove o departamento padrão do veículo (soft)',
      description:
        'Exige MANAGE_VEHICLES. DELETE desativa o vínculo (is_active=false) — o veículo fica sem departamento padrão; idempotente.',
    }),
    ApiParam({ name: 'vehicleId', description: 'Id do veículo (UUID).' }),
    ApiResponse({ status: 204, description: 'Vínculo removido.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({ status: 404, description: 'Veículo não encontrado.' }),
  );
}

// ---- user_vehicle (motoristas) ----

export function ApiListVehicleDrivers(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Lista os motoristas de um veículo',
      description:
        'Exige MANAGE_VEHICLES. Devolve os vínculos com nome do motorista, is_primary e can_drive (primários primeiro).',
    }),
    ApiParam({ name: 'vehicleId', description: 'Id do veículo (UUID).' }),
    ApiResponse({ status: 200, description: 'Vínculos do veículo.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({ status: 404, description: 'Veículo não encontrado.' }),
  );
}

export function ApiAssignDriver(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Vincula um motorista ao veículo',
      description:
        'Exige MANAGE_VEHICLES. Motorista precisa de vínculo ativo na empresa (404); duplicado → 409; is_primary=true substitui o anterior (transação).',
    }),
    ApiParam({ name: 'vehicleId', description: 'Id do veículo (UUID).' }),
    ApiBody({ type: AssignDriverDto }),
    ApiResponse({ status: 201, description: 'Vínculo criado.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({
      status: 404,
      description: 'Veículo ou usuário não encontrado.',
    }),
    ApiResponse({ status: 409, description: 'Vínculo já existente.' }),
  );
}

export function ApiUpdateVehicleDriver(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Ajusta o vínculo do motorista (is_primary/can_drive)',
      description:
        'Exige MANAGE_VEHICLES. PATCH sem remover+recriar; is_primary=true substitui o anterior (transação).',
    }),
    ApiParam({ name: 'vehicleId', description: 'Id do veículo (UUID).' }),
    ApiParam({ name: 'userId', description: 'Id do motorista (UUID).' }),
    ApiBody({ type: UpdateDriverDto }),
    ApiResponse({ status: 200, description: 'Vínculo atualizado.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({
      status: 404,
      description: 'Veículo ou vínculo não encontrado.',
    }),
    ApiResponse({ status: 409, description: 'Concorrência no primário.' }),
  );
}

export function ApiRemoveVehicleDriver(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Remove o motorista do veículo (delete físico)',
      description:
        'Exige MANAGE_VEHICLES. A tabela user_vehicle não tem is_active — a remoção é física (ADR 0006 §2).',
    }),
    ApiParam({ name: 'vehicleId', description: 'Id do veículo (UUID).' }),
    ApiParam({ name: 'userId', description: 'Id do motorista (UUID).' }),
    ApiResponse({ status: 204, description: 'Vínculo removido.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({
      status: 404,
      description: 'Veículo ou vínculo não encontrado.',
    }),
  );
}
