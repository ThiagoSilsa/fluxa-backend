/**
 * Tipo do usuário no vínculo pessoa ↔ empresa (enum `user_type` do Postgres).
 *
 * Com o ADR 0002, `type` mora no vínculo `user_company` (o que muda por
 * empresa), não na pessoa.
 */
export enum UserType {
  EMPLOYEE = 'EMPLOYEE',
  VISITOR = 'VISITOR',
}
