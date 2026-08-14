# ADR 0003 — Endurecimento do login: rate limiting, contexto de sessão e eventos

Número do ADR: 0003
Título: Endurecimento do sistema de login: rate limiting em duas dimensões (IP e e-mail), contexto de sessão (ipAddress/userAgent) e last_login_at, endpoint GET /auth/validate e eventos de sessão (user.logged_in, user.company_switched) via EventEmitter2
Data: 2026-08-11
Responsável: Thiago

## Contexto

O login multi-empresa do [ADR 0002](./0002-a-pessoa-e-a-identidade-e-a-empresa-e-um-vinculo.md) está implementado e validado: `POST /auth/login` com escolha de empresa, `GET /auth/companies`, `POST /auth/switch-company`, JWT `{ sub, companyId, email }`, revalidação do vínculo a cada requisição e 401 indistinguíveis. Falta, porém, o **endurecimento operacional** do endpoint público de login:

- **Sem rate limiting** — o `POST /auth/login` é público e pode ser alvo de força bruta distribuída (muitos IPs, poucas tentativas cada);
- **Sem contexto de sessão** — o login não registra `ip`/`user-agent` nem o `last_login_at` da pessoa (informações úteis para auditoria e para o usuário);
- **Sem endpoint de validação de sessão** — o frontend não tem um `GET /auth/validate` para conferir a sessão atual no boot;
- **Sem eventos de sessão** — logins e trocas de empresa não emitem eventos; a persistência fica acoplada ao fluxo de login quando deveria ser desacoplada (a auditoria `audit_log`, migration `0007`, consumirá esses eventos).

O repositório de referência (`planejamento/login.md`) propõe também trocar o hash para **scrypt** e o JWT para **implementação manual**; essas alternativas foram analisadas e rejeitadas (ver "Alternativas consideradas").

## Decisão

### 1. Rate limiting do login em duas dimensões

O `POST /auth/login` é protegido por rate limiting com **duas dimensões independentes**:

- **20 tentativas por minuto por IP** (limita força bruta distribuída por origem);
- **10 tentativas por minuto por e-mail** (limita força bruta dirigida a uma conta, mesmo distribuída por vários IPs).

Implementação com `@nestjs/throttler`: `ThrottlerModule` configurado em `src/shared/throttler/throttler-config.module.ts` (storage em memória no MVP; Redis quando multi-instância) e um `LoginThrottleGuard` customizado com o decorator `@ThrottleLogin()` em `src/shared/throttler/login.throttle.ts`. O excesso devolve um **429 genérico** (não revela a dimensão estourada).

### 2. Contexto de sessão e `last_login_at`

O `LoginDto` passa a aceitar `ipAddress` (`@MaxLength(45)`) e `userAgent` (`@MaxLength(500)`), preenchidos pelo controller a partir do request (`req.ip`, header `user-agent`). A coluna `user.last_login_at` (timestamptz, nullable) é criada na migration `0008` e atualizada no login por `updateLastLoginAt(userId)` — **falha da atualização não bloqueia o login** (try/catch + log de warning).

### 3. Endpoint `GET /auth/validate`

Novo endpoint `GET /auth/validate` protegido por `JwtAuthGuard`: valida a sessão atual e devolve o ator autenticado. Reutiliza a resolução existente (`resolve-authenticated-user`) — a mesma revalidação por requisição do ADR 0002. Útil para o frontend conferir a sessão no boot sem reautenticar.

### 4. Eventos de sessão via EventEmitter2 (desacoplamento)

`@nestjs/event-emitter` é adicionado (`EventEmitterModule.forRoot()`). O login emite `user.logged_in` (`userId`, `companyId`, `ip`, `userAgent`) e a troca de empresa emite `user.company_switched` (`userId`, `fromCompanyId`, `toCompanyId`). **A emissão não bloqueia a resposta.** A **persistência** desses eventos acontece na fase da auditoria (migration `0007`, `audit_log` com ação `LOGIN`) — **não** é criada tabela `user_session` redundante. Até lá, um listener (`session-audit.listener.ts`) apenas registra o evento (comprova a fiação).

### 5. Manter bcrypt para hash de senha

O Fluxa mantém **bcrypt** para hash de senha (implementado e validado). Não há migração para scrypt.

### 6. Manter `@nestjs/jwt` para assinatura do token

O Fluxa mantém **`@nestjs/jwt`** (HS256, `JwtModule` global) para assinar/verificar o JWT. Não há migração para implementação manual.

## Consequências

- O login público fica protegido contra força bruta sem afetar o fluxo legítimo (limites generosos e 429 genérico).
- `user.last_login_at` (migration `0008`) dá visibilidade de último acesso; a escrita é não-bloqueante.
- `GET /auth/validate` dá ao frontend um contrato simples de checagem de sessão.
- Os eventos de sessão desacoplam o fluxo de login da persistência: a auditoria (`0007`) consome `user.logged_in`/`user.company_switched` sem tocar no `LoginUseCase`.
- Sem tabela `user_session`: o histórico de sessão é coberto pelo `audit_log` (ação `LOGIN`), evitando redundância de schema.
- Novos testes (unit + e2e) cobrem rate limiting, `last_login_at`, `validate` e eventos; a migration `0008` entra na leva de `test:db:migration`.

## Alternativas consideradas

### 1. Hash scrypt manual (`node:crypto`) em vez de bcrypt

Rejeitado: bcrypt é padrão da indústria, já implementado e testado; migrar exigiria re-hash de todas as senhas sem ganho funcional.

### 2. JWT manual (HMAC + base64url) em vez de `@nestjs/jwt`

Rejeitado: JWT manual adiciona superfície de ataque e manutenção sem benefício sobre a lib padrão do NestJS, já configurada e validada.

### 3. Tabela `user_session` + módulo `user-sessions` (registro persistente de sessões)

Rejeitado: redundante com o `audit_log` (ação `LOGIN`, migration `0007`) já planejado na modelagem. O desacoplamento desejado é obtido com eventos; a persistência fica na auditoria.

### 4. Rate limiting apenas por IP

Rejeitado: não cobre força bruta distribuída dirigida a uma conta (muitos IPs × poucas tentativas). A dimensão por e-mail é necessária.

### 5. Conta global com `companyId: null` (SUPER_ADMIN) no `resolveChosen`

Rejeitado: o admin do Fluxa tem vínculo `user_company` com a SOMAR e entra como qualquer usuário; super admin cross-tenant já é "fora do escopo do MVP" (regras de negócio, seção 8).
