// NestJS
import { applyDecorators } from '@nestjs/common';

// Swagger
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';

// DTOs (apresentação)
import { RegisterEntryDto } from '../presentation/http/dto/register-entry.dto';
import { RegisterExitDto } from '../presentation/http/dto/register-exit.dto';

/**
 * Documentação Swagger dos endpoints do núcleo de acesso.
 *
 * Toda documentação de endpoint/schema vive aqui (AGENTS.md §3) — nunca em
 * DTOs.
 */

export function ApiRegisterEntry(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Registra a entrada de um veículo',
      description:
        'Exige REGISTER_ENTRY. O porteiro é a autoridade da entrada (ADR 0014 §1): pode liberar com uma solicitação da mesma placa em PENDING/IN_CONTACT/REGISTERED (`accessRequestId`) ou criar a solicitação na mesma operação (bloco `request`). Ao negar (bloqueado, inativo, não cadastrado sem solicitação, condutor sem can_drive, solicitação vencida), registra o entry_denial automaticamente (com a portaria do device) e devolve granted=false. Vaga cheia → 409 exigindo overCapacity. Reentrada fecha o acesso anterior com forced_exit.',
    }),
    ApiBody({ type: RegisterEntryDto }),
    ApiResponse({
      status: 201,
      description:
        'Entrada registrada (granted=true; com solicitação quando o bloco `request` foi enviado).',
    }),
    ApiResponse({
      status: 200,
      description: 'Impedimento registrado (granted=false + denial).',
    }),
    ApiResponse({
      status: 400,
      description:
        'Validação (placa/condutor/solicitação de outra placa/`request` junto com `accessRequestId`).',
    }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({
      status: 404,
      description:
        'Portaria/condutor/departamento/solicitação não encontrados.',
    }),
    ApiResponse({
      status: 409,
      description:
        'Vaga cheia (sem overCapacity) ou solicitação fora de PENDING/IN_CONTACT/REGISTERED.',
    }),
  );
}

export function ApiRegisterExit(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Registra a saída de um veículo',
      description:
        'Exige REGISTER_EXIT. Encerra todos os INSIDE abertos (OUT + movimento EXIT). Sem entrada registrada → NO_EXIT (exige passageiro exceto em free_pass — regra 11).',
    }),
    ApiBody({ type: RegisterExitDto }),
    ApiResponse({
      status: 201,
      description: 'Saída registrada (closedAccesses e/ou noExit).',
    }),
    ApiResponse({
      status: 400,
      description: 'Validação (placa/NO_EXIT sem passageiro).',
    }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({ status: 404, description: 'Passageiro não encontrado.' }),
  );
}

export function ApiGetOpenAccess(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Consulta acessos abertos de uma placa (conferência na saída)',
      description:
        'Exige REGISTER_EXIT. Devolve quem entrou com o veículo (condutor da visita) para conferência na saída (regra 8).',
    }),
    ApiQuery({
      name: 'plate',
      description: 'Placa (normalizada).',
      required: true,
    }),
    ApiResponse({
      status: 200,
      description: 'Acessos abertos com o condutor.',
    }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
  );
}

export function ApiGetAccessContext(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Contexto + veredito da entrada (ficha da portaria)',
      description:
        'Exige REGISTER_ENTRY, REGISTER_EXIT ou REGISTER_DENIAL (OR). Dada uma placa, devolve a ficha completa (veículo, bloqueio ativo, departamento com ocupação, motoristas vinculados e sugestões, solicitações da placa com prazo, acessos abertos) e um veredito único (ALLOW/ALLOW_WITH_REQUEST/ALLOW_OVER_CAPACITY/ALLOW_FORCED_REENTRY/DENY_BLOCKED/DENY_OVERDUE/DENY_INACTIVE) — ADR 0014.',
    }),
    ApiQuery({
      name: 'plate',
      description: 'Placa digitada/lida na portaria.',
      required: true,
    }),
    ApiQuery({
      name: 'search',
      description: 'Busca de motorista (nome/telefone/documento).',
      required: false,
    }),
    ApiQuery({
      name: 'departmentId',
      description: 'Setor para o qual a ocupação é avaliada.',
      required: false,
    }),
    ApiQuery({
      name: 'driverUserId',
      description:
        'Motorista escolhido na ficha — o veredito passa a refletir esse motorista.',
      required: false,
    }),
    ApiResponse({
      status: 200,
      description: 'Ficha completa com o veredito da entrada.',
    }),
    ApiResponse({ status: 400, description: 'Placa inválida.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
    ApiResponse({
      status: 404,
      description: 'Departamento não encontrado.',
    }),
  );
}

export function ApiListAccessRecords(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary:
        'Feed de registros da portaria (entradas, saídas e impedimentos)',
      description:
        'Exige REGISTER_ENTRY, REGISTER_EXIT ou REGISTER_DENIAL (OR). Une os ledgers `vehicle_movement` (ENTRY/EXIT) e `entry_denial` (DENIAL) em uma linha do tempo, mais recente primeiro, com nomes resolvidos (veículo, departamento, portaria, porteiro e condutor). Sem janela de tempo padrão; `parameters.entrances` alimenta o filtro de portaria (ADR 0015).',
    }),
    ApiQuery({
      name: 'kind',
      description: 'Tipo do registro: ENTRY, EXIT ou DENIAL.',
      required: false,
    }),
    ApiQuery({
      name: 'plate',
      description: 'Placa (parcial).',
      required: false,
    }),
    ApiQuery({
      name: 'dateFrom',
      description: 'Início do período (ISO).',
      required: false,
    }),
    ApiQuery({
      name: 'dateTo',
      description: 'Fim do período (ISO).',
      required: false,
    }),
    ApiQuery({ name: 'entranceId', description: 'Portaria.', required: false }),
    ApiQuery({
      name: 'doormanId',
      description: 'Porteiro que registrou.',
      required: false,
    }),
    ApiQuery({
      name: 'limit',
      description: '1..100 (default 20).',
      required: false,
    }),
    ApiQuery({ name: 'offset', description: 'Default 0.', required: false }),
    ApiResponse({
      status: 200,
      description: 'Página do feed + `parameters.entrances`.',
    }),
    ApiResponse({ status: 400, description: 'Validação dos filtros.' }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
  );
}

export function ApiGetOccupancy(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Ocupação em tempo real',
      description:
        'Exige VIEW_DASHBOARDS. Veículos INSIDE por departamento + vagas livres (capacidade = soma do parkingSpace dos departamentos ativos).',
    }),
    ApiResponse({
      status: 200,
      description: 'Ocupação total + por departamento.',
    }),
    ApiResponse({ status: 401, description: 'Não autenticado.' }),
    ApiResponse({ status: 403, description: 'Permissão insuficiente.' }),
  );
}
