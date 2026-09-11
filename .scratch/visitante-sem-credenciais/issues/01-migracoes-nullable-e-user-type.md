# 01: Migrações — credenciais nulas e tipo de usuário na solicitação

**What to build:** Preparar o banco e os modelos para (a) permitir Visitante sem credenciais (`user.email` e `user.password` nullable, e-mail único só quando não nulo) e (b) registrar o tipo de usuário na solicitação (`access_request.user_type`, enum `user_type`, NOT NULL, default `VISITOR`).

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [x] Migração 1: `user.email` passa a nullable mantendo `UQ_user_email`; `user.password` passa a nullable. Sem backfill.
- [x] Migração 2: `access_request.user_type` (`user_type` NOT NULL DEFAULT `'VISITOR'`); sem índice (não é filtro de listagem) e sem backfill (linhas existentes assumem `VISITOR`).
- [x] ORM entities e tipos de domínio atualizados: `UserOrmEntity.email/password` nulos (→ `passwordHash: string | null`) e `AccessRequestOrmEntity/entidade` com `userType: UserType`.
- [x] Nenhuma quebra nas leituras existentes (listagens/respostas continuam válidas; e-mail nulo não quebra mappers).
- [x] `npm run lint`, `npm run typecheck` e testes de unidade/integração existentes seguem verdes.

## Comments

- 2026-09-11 — Implementado. Migrações `0012-user-credentials-nullable` (`ALTER COLUMN ... DROP NOT NULL` em `user.email`/`user.password`; `UQ_user_email` mantido — vários NULL permitidos no PG) e `0013-access-request-user-type` (`ADD COLUMN "user_type" "user_type" NOT NULL DEFAULT 'VISITOR'`). Tipos: `UserEntity`/`CreateUserRepositoryData`/`AuthUserEntity`/`UserCompanyWithUserEntity`/`UserResponse`/`UserOptionResponse` com email/senha nulos; `AccessRequestEntity`/`AccessRequestOrmEntity` com `userType` (repo `create` defaulta `VISITOR` e `toDomain` mapeia). Ripple: guarda de login para `passwordHash` nulo (401), fallback de e-mail no repositório de auth (candidatos são buscados por e-mail), guarda no importador veículo↔pessoa, fixtures de unit com `userType`, e as 2 migrações registradas nos 14 contextos de integração (a config de runtime usa glob). Validação: typecheck + eslint limpos; unit 112 suites/484 testes; integração 28 suites/293 testes — 25 verdes no run completo, e os 3 suites de importação que falharam por timeout/leitura de XLSX (flaky sob run longo) passaram ao re-executar isoladamente (4 suites/24 testes verdes).
