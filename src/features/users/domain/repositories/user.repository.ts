// Constants
import { UserType } from '../../../auth/domain/constants/user-type.constant';

// Types
import type { UserEntity } from '../entities/user.entity';

/**
 * Symbol token de injeção do `UserRepository`.
 */
export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

/**
 * Dados para criação de pessoa **com o vínculo na mesma transação**.
 *
 * A pessoa não existe sem vínculo (ADR 0002): `companyId`/`type`/`isActive`
 * são o `user_company` criado junto no `create()`.
 */
export interface CreateUserRepositoryData {
  name: string;
  /** E-mail normalizado (lowercase + trim). */
  email: string;
  /** Hash bcrypt da senha (nunca texto puro). */
  passwordHash: string;
  phone: string | null;
  document: string | null;
  /** Empresa do vínculo a criar junto (sempre a da sessão). */
  companyId: string;
  /** Tipo no vínculo (EMPLOYEE/VISITOR). */
  type: UserType;
  /** Vínculo ativo na criação. */
  isActive: boolean;
  /** Cargo a vincular já na criação (1 cargo por empresa — ADR 0005 §5). */
  roleId?: string;
}

/**
 * Dados para atualização parcial da pessoa (campos opcionais).
 */
export interface UpdateUserRepositoryData {
  name?: string;
  email?: string;
  phone?: string | null;
  document?: string | null;
}

/**
 * Contrato do repositório de pessoas (`user`).
 *
 * A pessoa é a identidade global (ADR 0002) — sem `companyId`; a participação
 * numa empresa é validada via `user_company`.
 */
export interface UserRepository {
  /**
   * Busca a pessoa por e-mail (identidade global).
   *
   * @param email E-mail normalizado.
   * @returns Pessoa ou `null` se não existir.
   */
  findByEmail(email: string): Promise<UserEntity | null>;

  /**
   * Busca a pessoa por id.
   *
   * @param id Id da pessoa.
   * @returns Pessoa ou `null` se não existir.
   */
  findById(id: string): Promise<UserEntity | null>;

  /**
   * Busca a pessoa por documento (único global).
   *
   * @param document Documento.
   * @returns Pessoa ou `null` se não existir.
   */
  findByDocument(document: string): Promise<UserEntity | null>;

  /**
   * Cria a pessoa **e o vínculo** com a empresa na mesma transação (ADR 0002
   * — pessoa sem vínculo não pode existir).
   *
   * @param data Dados da pessoa + vínculo a criar junto.
   * @returns Pessoa criada.
   */
  create(data: CreateUserRepositoryData): Promise<UserEntity>;

  /**
   * Atualiza parcialmente a pessoa (dados da pessoa — refletem em todas as
   * empresas onde participa).
   *
   * @param id Id da pessoa.
   * @param data Campos a atualizar.
   * @returns Pessoa atualizada ou `null` se não existir.
   */
  updateById(
    id: string,
    data: UpdateUserRepositoryData,
  ): Promise<UserEntity | null>;

  /**
   * Altera o hash da senha da pessoa (troca de senha — provisoriamente por
   * `MANAGE_USERS`; vale para todos os vínculos da pessoa).
   *
   * @param id Id da pessoa.
   * @param passwordHash Novo hash bcrypt.
   * @returns Promise resolvida quando a senha é gravada.
   */
  updatePasswordById(id: string, passwordHash: string): Promise<void>;

  /**
   * Exclui a participação do usuário na empresa — em uma transação remove o
   * cargo (`user_role`) e o vínculo (`user_company`). Se for a **última
   * empresa** da pessoa (nenhum outro vínculo restante) **e a pessoa não tiver
   * histórico operacional**, exclui também a pessoa (`user`).
   *
   * @param userId Id da pessoa.
   * @param companyId Empresa da sessão.
   * @param linkId Id do vínculo `user_company` a remover.
   * @returns `true` se a pessoa também foi excluída; `false` se a pessoa
   * permanece (tem outra empresa ou histórico operacional).
   */
  removeCompanyLink(
    userId: string,
    companyId: string,
    linkId: string,
  ): Promise<boolean>;
}
