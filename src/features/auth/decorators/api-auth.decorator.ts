import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { LoginDto } from '../presentation/http/dto/login.dto';

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
