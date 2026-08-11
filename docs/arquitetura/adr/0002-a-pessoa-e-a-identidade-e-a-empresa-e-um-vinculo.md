# ADR 0002 — A pessoa é a identidade e a empresa é um vínculo

Número do ADR: 0002
Título: Usuário multi-empresa: a pessoa é uma identidade (uma linha em user) e a participação numa empresa é um vínculo (uma linha em user_company); o company_id deixa de ser propriedade do usuário e passa a ser da sessão
Data: 2026-08-11
Responsável: Thiago

## Contexto

O Fluxa é multi-tenant e o schema atual ([ADR 0001](./0001-migrations-seeds-iniciais.md), migration `0001`) modela `user` com `company_id` obrigatório e unicidade `UNIQUE (company_id, email)`. Nesse modelo, uma pessoa que atua em duas empresas vira **duas linhas** de `user`, cada uma com seu nome, telefone, documento, tipo, foto e hash de senha — sem nada ligando as duas.

Sintomas do modelo atual:

- dados pessoais (nome, foto, telefone) divergem por empresa — editar numa não reflete na outra;
- a recuperação de senha não consegue tratar "a senha é da pessoa" — cada conta tem a sua;
- não existe como listar de quais empresas uma pessoa participa, nem um seletor de empresa no frontend.

A regra de negócio decidida: **o mesmo usuário pode ter mais de uma companhia vinculada**; ao acessar, se tiver **apenas uma**, entra direto na sua companhia; se tiver **mais de uma**, seleciona qual companhia quer acessar.

## Decisão

### 1. A pessoa é a identidade; a empresa é o vínculo

`user` deixa de ter `company_id`. Cria-se a tabela `user_company` (vínculo) com `user_id`, `company_id`, `type`, `is_active` e `UNIQUE (user_id, company_id)`. O `companyId` deixa de ser propriedade do usuário e passa a ser da **sessão** (JWT).

### 2. Email e documento únicos globalmente

`user.email` passa a `UNIQUE (email)` global e `user.document` a `UNIQUE (document)` (NULLs permitidos). Removem-se os uniques compostos `UQ_user_company_id_email`/`UQ_user_company_id_document` e o índice `IDX_user_company_id`.

### 3. O que muda por empresa mora no vínculo

`user_company` carrega `type` (`EMPLOYEE`/`VISITOR`) e `is_active`. **Desativar um usuário é ato da empresa sobre a participação** — uma pessoa sem nenhum vínculo ativo não entra em lugar nenhum. Em `user` permanecem os dados da pessoa: `name`, `email`, `password`, `phone`, `document`, `observation`, `photo_url`.

### 4. RBAC já é escopado por empresa — sem mudança de schema

`role`, `role_permission` e `user_role` já possuem `company_id` (migration `0001`). Papéis/permissões **nunca vazam entre empresas**: a resolução é sempre por `(user_id, company_id)`.

### 5. Login com escolha de empresa

`findUsersByEmail(email)` devolve **um candidato por vínculo ativo** (não por pessoa). A senha é verificada em **todos** os candidatos. `companyId` é um campo **opcional no body do login** (mesma requisição da credencial). Regras:

- um candidato → entra **direto** na sua empresa;
- vários candidatos e nenhuma escolha → `{ requiresCompanyChoice: true, companies: [...] }` — a lista só é montada **depois de a senha conferir**;
- com `companyId` → entra na empresa escolhida (se o vínculo não existir, 401 idêntico ao de senha errada).

JWT assinado com `{ sub, companyId, email }`.

### 6. Endpoints de sessão

- `GET /auth/companies` — lista os **vínculos ativos** da pessoa (com empresa ativa), para o seletor do frontend.
- `POST /auth/switch-company` — troca de empresa **sem repetir senha** (quem já tem sessão válida já provou a credencial), validando o vínculo na emissão e emitindo **token novo** com o novo `companyId`.

### 7. Revalidação por requisição

O `JwtAuthGuard` revalida o vínculo pessoa+empresa a cada requisição (via `user_company` ativo). Um token emitido antes de o vínculo cair (ou ser desativado) continua sendo recusado.

### 8. Respostas indistinguíveis

Senha errada, vínculo inativo e empresa sem vínculo devolvem o **mesmo** 401 (`'Credenciais inválidas.'`) — não vaza quais empresas existem. A lista de empresas da pessoa só é exposta depois de a senha conferir.

### 9. Migração de dados idempotente (migration nova)

Migration idempotente que: cria `user_company`; faz **backfill** criando um vínculo por linha atual de `user`; remove `company_id` de `user` (FK, índice e uniques compostos); aplica `UQ_user_email`/`UQ_user_document`. Hoje só existem a empresa SOMAR e o admin seedado — a unificação é trivial e o melhor momento é **agora, antes de dados operacionais**. Para o futuro, contas duplicadas por e-mail são unificadas com regra explícita (qual `name`/`photo_url` sobrevive), **invalidação de senha** (redefinição obrigatória) e execução com a aplicação fora do ar.

## Consequências

- A mesma pessoa em N empresas = 1 linha em `user` + N vínculos; dados pessoais editados refletem em todas.
- A recuperação de senha passa a ser da pessoa (vale para todos os vínculos do mesmo email).
- Frontend: login direto quando 1 empresa; seletor quando mais de uma (`requiresCompanyChoice`), com troca via `switch-company`.
- Repositórios/use cases que validavam multi-tenant via `user.company_id` passam a validar via `user_company` (mesma regra de aplicação, agora pelo vínculo).
- Seeds e testes de integração precisam criar o vínculo `user_company` junto do usuário.
- Altera parte do schema decidido no ADR 0001 (o `company_id` de `user`) — esta ADR substitui esse ponto do ADR 0001.

## Alternativas consideradas

### 1. Manter `user.company_id` e só tornar o email global

Rejeitado: com a pessoa em várias empresas, `user.company_id` fica ambíguo (qual empresa é a "dona" da pessoa?), não resolve a listagem/seletor nem a identidade compartilhada.

### 2. Tabela separada de identidade (`person`) + `user` como vínculo

Rejeitado: adiciona tabela e joins sem ganho sobre mover `company_id` para o vínculo; desalinhado com o RBAC que já é escopado por empresa.

### 3. Coluna multivalorada (array de `company_id` no `user`)

Rejeitado: não relacional, sem constraints de integridade (FK/unique), difícil consultar e validar vínculos ativos.

### 4. Resolver apenas no frontend (escolher empresa sem mudar o schema)

Rejeitado: sem o vínculo no banco não há como listar as empresas da pessoa, revalidar o acesso a cada requisição nem impedir dados cruzados entre tenants.
