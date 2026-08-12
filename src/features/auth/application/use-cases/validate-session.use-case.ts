import { Injectable } from '@nestjs/common';
import { AuthenticatedUserEntity } from '../../domain/entities/authenticated-user.entity';
import { ValidateSessionResponse } from '../types/login.type';

/**
 * Devolve os dados da sessão atual — endpoint `GET /auth/validate` (ADR 0003).
 *
 * O `JwtAuthGuard` já revalidou o vínculo pessoa+empresa **a cada requisição**
 * e populou `request.user` (ADR 0002). Este use case apenas mapeia o ator para
 * a resposta estável da sessão — sem expor detalhes internos do token.
 */
@Injectable()
export class ValidateSessionUseCase {
  /**
   * Mapeia o ator autenticado para a resposta da sessão.
   *
   * @param actor Ator autenticado (populado pelo `JwtAuthGuard`).
   * @returns Pessoa, empresa da sessão, cargos e permissões efetivas.
   */
  public execute(actor: AuthenticatedUserEntity): ValidateSessionResponse {
    return {
      id: actor.id,
      companyId: actor.companyId,
      email: actor.email,
      name: actor.name,
      type: actor.type,
      roleCodes: actor.roleCodes,
      permissions: actor.permissions,
    };
  }
}
