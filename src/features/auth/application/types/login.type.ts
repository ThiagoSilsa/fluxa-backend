import type { PermissionCode } from '../../../../shared/constants/access-control.constant';
import type { AuthUserEntity } from '../../domain/entities/auth-user.entity';
import type { UserType } from '../../domain/constants/user-type.constant';

/** Dados do usuário devolvidos na resposta de login. */
export interface LoginUserInfo {
  /** Id da pessoa. */
  id: string;
  /** Nome da pessoa. */
  name: string;
  /** E-mail (identidade global). */
  email: string;
  /** Tipo no vínculo da empresa da sessão. */
  type: UserType;
}

/** Empresa disponível para escolha (multi-empresa — ADR 0002). */
export interface LoginCompanyOption {
  /** Id da empresa. */
  id: string;
  /** Nome da empresa. */
  name: string;
}

/** Resposta quando há 1 empresa (ou `companyId` informado): sessão autenticada. */
export interface LoginSessionResponse {
  /** Token JWT da sessão. */
  accessToken: string;
  /** Tipo do token. */
  tokenType: 'Bearer';
  /** Expiração em segundos. */
  expiresIn: number;
  /** Dados do usuário. */
  user: LoginUserInfo;
}

/** Resposta quando há N empresas e nenhuma escolha: pede a seleção. */
export interface LoginCompanyChoiceResponse {
  /** Indica que o cliente deve pedir a escolha da empresa. */
  requiresCompanyChoice: true;
  /** Empresas disponíveis (só após a senha conferir — ADR 0002). */
  companies: LoginCompanyOption[];
}

/** Resultado interno da resolução da empresa no login. */
export type ResolveChosenResult =
  | { type: 'chosen'; candidate: AuthUserEntity }
  | { type: 'choice'; companies: LoginCompanyOption[] };

/** Dados da sessão válida devolvidos por `GET /auth/validate` (ADR 0003). */
export interface ValidateSessionResponse {
  /** Id da pessoa. */
  id: string;
  /** Empresa da sessão. */
  companyId: string;
  /** E-mail (identidade global). */
  email: string;
  /** Nome da pessoa. */
  name: string;
  /** Tipo no vínculo da empresa da sessão. */
  type: UserType;
  /** Se a pessoa tem cargo `is_admin` ativo na empresa da sessão (acesso total — ADR 0004). */
  isAdmin: boolean;
  /** Códigos dos cargos da pessoa na empresa da sessão. */
  roleCodes: string[];
  /** Permissões efetivas (via cargos → role_permission). */
  permissions: PermissionCode[];
}
