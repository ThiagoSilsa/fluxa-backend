import { UserType } from '../constants/user-type.constant';

/**
 * Vínculo pessoa ↔ empresa (tabela `user_company`), usado para listar as
 * empresas de uma pessoa e para validar participação.
 */
export interface UserCompanyEntity {
  /** Id do vínculo. */
  id: string;
  /** Id da pessoa. */
  userId: string;
  /** Id da empresa. */
  companyId: string;
  /** Nome da empresa (para o seletor do frontend). */
  companyName: string;
  /** Tipo no vínculo (EMPLOYEE/VISITOR). */
  type: UserType;
  /** Se o vínculo está ativo. */
  isActive: boolean;
}
