// NestJS
import { applyDecorators } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';

// DTO
import { LoginDto } from '../presentation/http/dto/login.dto';
import { SwitchCompanyDto } from '../presentation/http/dto/switch-company.dto';

/**
 * Decorator Swagger do endpoint `POST /auth/login`.
 *
 * Documenta a operação de autenticação (sessão ou escolha de empresa).
 * Swagger nunca vai em DTOs — só em arquivos `api-<feature>.decorator.ts`
 * (AGENTS.md).
 */
export function ApiLogin(): MethodDecorator {
  return applyDecorators(
    ApiOperation({
      summary: 'Autentica usuário e devolve a sessão',
      description:
        'Com 1 empresa (ou companyId informado) devolve a sessão JWT; com N ' +
        'empresas e sem companyId devolve requiresCompanyChoice + lista.',
    }),
    ApiBody({ type: LoginDto }),
    ApiResponse({
      status: 200,
      description: 'Login ok — sessão JWT ou requiresCompanyChoice.',
    }),
    ApiResponse({ status: 401, description: 'Credenciais inválidas.' }),
  );
}

/**
 * Decorator Swagger do endpoint `GET /auth/companies`.
 */
export function ApiListSessionCompanies(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Lista as empresas da pessoa (seletor da sessão)',
      description:
        'Devolve apenas vínculos ativos (com empresa ativa), ordenados pelo ' +
        'nome — alimenta o seletor de empresa do frontend.',
    }),
    ApiResponse({ status: 200, description: 'Lista de empresas ativas.' }),
    ApiResponse({ status: 401, description: 'Token inválido/sem vínculo.' }),
  );
}

/**
 * Decorator Swagger do endpoint `GET /auth/validate` (ADR 0003).
 */
export function ApiValidateToken(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Valida a sessão atual e devolve o ator',
      description:
        'Confere o token (assinatura/expiração) e revalida o vínculo ' +
        'pessoa+empresa a cada requisição (ADR 0002/0003). Devolve pessoa, ' +
        'empresa da sessão, cargos e permissões — usado pelo frontend no boot.',
    }),
    ApiResponse({ status: 200, description: 'Sessão válida — dados do ator.' }),
    ApiResponse({ status: 401, description: 'Token inválido/sem vínculo.' }),
  );
}

/**
 * Decorator Swagger do endpoint `POST /auth/switch-company`.
 */
export function ApiSwitchCompany(): MethodDecorator {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Troca a empresa da sessão sem repetir senha',
      description:
        'Valida o vínculo na emissão e devolve um token novo com o novo ' +
        'companyId (ADR 0002).',
    }),
    ApiBody({ type: SwitchCompanyDto }),
    ApiResponse({ status: 200, description: 'Nova sessão JWT.' }),
    ApiResponse({
      status: 401,
      description: 'Sem vínculo ativo com a empresa.',
    }),
  );
}
