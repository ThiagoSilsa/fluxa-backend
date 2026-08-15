// Constants
import { UserType } from '../../../auth/domain/constants/user-type.constant';

// Shared
import type { ParameterDto } from '../../../../shared/dto/parameter.dto';

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
