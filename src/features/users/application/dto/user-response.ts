// Constants
import { UserType } from '../../../auth/domain/constants/user-type.constant';

// Shared
import type { ParameterDto } from '../../../../shared/dto/parameter.dto';

/**
 * Resumo do cargo do usuário na empresa (listagem/detalhe — ADR 0005 §5).
 *
 * Com o modelo de **um cargo por empresa**, o resumo é o cargo vigente do
 * usuário (ou `null`). Evita N+1: a listagem enriquece em lote.
 */
export interface UserRoleSummaryResponse {
  /** Id do vínculo `user_role`. */
  userRoleId: string;
  /** Id do cargo. */
  roleId: string;
  /** Nome do cargo. */
  roleName: string;
  /** Cargo de administração (acesso total — governança especial). */
  isAdmin: boolean;
}

/**
 * Usuário no formato de resposta (pessoa + vínculo na empresa da sessão —
 * nunca a entidade crua do banco).
 */
export interface UserResponse {
  /** Id da pessoa. */
  id: string;
  /** Nome da pessoa. */
  name: string;
  /** E-mail (identidade global). */
  email: string;
  /** Telefone (opcional). */
  phone: string | null;
  /** Documento (opcional). */
  document: string | null;
  /** Observação (opcional). */
  observation: string | null;
  /** URL da foto (opcional). */
  photoUrl: string | null;
  /** Tipo no vínculo (EMPLOYEE/VISITOR). */
  type: UserType;
  /** Se o vínculo com a empresa da sessão está ativo. */
  isActive: boolean;
  /** Resumo do cargo vigente na empresa (1 cargo por empresa). */
  role: UserRoleSummaryResponse | null;
}

/**
 * Resposta de criação de usuário — indica se a pessoa foi criada ou se era um
 * vínculo novo para pessoa existente (ADR 0005 §2).
 */
export interface CreateUserResponse extends UserResponse {
  /** `true` quando a pessoa foi criada; `false` quando era vínculo novo. */
  createdUser: boolean;
}

/**
 * Resposta paginada de usuários — formato padrão do AGENTS.md §3
 * (`limit`, `offset`, `data`, `count`, `parameters?`).
 */
export interface ListUsersResponse {
  /** Quantidade de registros retornados. */
  limit: number;
  /** Offset da página. */
  offset: number;
  /** Registros da página. */
  data: UserResponse[];
  /** Total de registros (sem paginação). */
  count: number;
  /** Metadados opcionais de filtros. */
  parameters?: ParameterDto[];
}

/**
 * Resposta da consulta de existência por e-mail — apenas `{ exists }`
 * (não vaza nome nem em quais empresas a pessoa está — ADR 0005 §2.1).
 */
export interface EmailStatusResponse {
  /** Se existe conta com aquele e-mail no sistema. */
  exists: boolean;
}
