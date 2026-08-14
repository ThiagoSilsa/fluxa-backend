// Shared
import { PermissionCode } from '../../../../shared/constants/access-control.constant';

// Constants
import { UserType } from '../constants/user-type.constant';

/**
 * Ator autenticado resolvido pelo guard a cada requisição — é o primeiro
 * parâmetro de `execute()` de todos os use cases.
 *
 * O `companyId` é o da **sessão** (JWT), não do usuário (ADR 0002). Papéis e
 * permissões são sempre resolvidos por `(user_id, company_id)` — nunca vazam
 * entre empresas.
 */
export interface AuthenticatedUserEntity {
  /** Id da pessoa (linha em `user`). */
  id: string;
  /** Empresa da sessão. */
  companyId: string;
  /** E-mail da pessoa. */
  email: string;
  /** Nome da pessoa. */
  name: string;
  /** Tipo no vínculo da empresa da sessão. */
  type: UserType;
  /** Códigos dos cargos da pessoa na empresa da sessão. */
  roleCodes: string[];
  /** Permissões efetivas da pessoa na empresa da sessão. */
  permissions: PermissionCode[];
}
