import { UserType } from '../constants/user-type.constant';

/**
 * Candidato de autenticação: uma pessoa (`user`) + um vínculo ativo
 * (`user_company`) + a empresa (`company`).
 *
 * O login devolve **uma entrada por vínculo** (não por pessoa) — quem
 * participa de N empresas gera N candidatos com o mesmo `id`/`passwordHash`.
 */
export interface AuthUserEntity {
  /** Id da pessoa (linha em `user`). */
  id: string;
  /** Nome da pessoa. */
  name: string;
  /** E-mail (identidade global). */
  email: string;
  /** Hash da senha (bcrypt) — é da pessoa. */
  passwordHash: string;
  /** Empresa do vínculo. */
  companyId: string;
  /** Nome da empresa (para a lista de escolha). */
  companyName: string;
  /** Se a empresa está ativa. */
  companyIsActive: boolean;
  /** Tipo no vínculo (EMPLOYEE/VISITOR). */
  type: UserType;
  /** Se o vínculo da pessoa com a empresa está ativo. */
  isActive: boolean;
}
