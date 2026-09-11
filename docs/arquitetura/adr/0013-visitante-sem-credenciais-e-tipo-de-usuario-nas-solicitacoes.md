# ADR 0013 — Visitante sem credenciais e tipo de usuário nas solicitações

Número do ADR: 0013
Título: Visitante é um vínculo sem credenciais; o tipo de usuário entra nas solicitações de acesso e decide o aceite
Data: 2026-09-11
Responsável: Thiago

## Contexto

O ADR 0002 definiu que a **pessoa** é a identidade (`user`) e a **empresa** é um vínculo (`user_company`), com o vínculo carregando `type` (`EMPLOYEE`/`VISITOR`) e `is_active`. Porém o modelo de credenciais não acompanhou essa separação: `user.email` e `user.password` são **NOT NULL** (e-mail único global) e o login exige e-mail + senha.

Consequências do estado atual:

- Um **Visitante** — pessoa vinculada à empresa que **não acessa o sistema** — não tem representação limpa: para existir precisa de e-mail e senha.
- O aceite de solicitação (`accept-access-request`) cria **todo** motorista como `VISITOR`, com **senha default** (`ADMIN_DEFAULT_PASSWORD`) e **sem cargo**: um visitante com senha conhecida e sem função.
- A tela de Usuários exige e-mail, senha e cargo mesmo para Visitante.
- A solicitação de acesso (`access_request`) **não registra o tipo de usuário pretendido**: o solicitante não consegue pedir um Colaborador (que acessa o sistema) e o e-mail do motorista é sempre obrigatório; o gestor não vê essa intenção ao decidir.
- O telefone de contato da solicitação (`contactPhone`, obrigatório) **não** é gravado no usuário criado no aceite (que lê apenas `payload.driver.phone`).

Regra de produto: **Visitante não acessa o sistema**; só passa a acessar se o vínculo mudar para **Colaborador**.

## Decisão

### 1. Visitante sem credenciais

`user.email` e `user.password` passam a ser **nullable**. O e-mail continua **único quando não nulo** (Postgres permite múltiplos `NULL`). O Visitante criado por qualquer caminho (tela de Usuários ou aceite de solicitação) **não recebe senha** e **não exige e-mail**. O login permanece exigindo e-mail + senha; portanto, um Visitante sem credenciais **não autentica** (guarda explícita para `passwordHash` nulo → 401).

### 2. Colaborador exige credenciais

Criar um vínculo `EMPLOYEE` (ou promover `VISITOR` → `EMPLOYEE` na edição) exige **e-mail + senha + cargo**. O cargo já era exigido na criação de usuário; a promoção na edição passa a exigir e-mail (se vazio), cargo e senha, reusando os endpoints existentes (`PATCH /users/:id` e `PATCH /users/:id/password`).

### 3. Tipo de usuário nas solicitações

`access_request` ganha a coluna `user_type` (enum `user_type`, `NOT NULL`, default `VISITOR`). Nos cenários que **criam motorista** (`NEW_USER`, `BOTH`) o solicitante escolhe o tipo; o e-mail do motorista é **obrigatório apenas para `EMPLOYEE`** e **opcional para `VISITOR`** (a checagem de e-mail único global só se aplica quando há e-mail).

### 4. Aceite coerente com o tipo

O aceite cria o usuário com o `user_type` do pedido:

- **`VISITOR`**: sem senha e sem cargo.
- **`EMPLOYEE`**: exige **cargo e senha** informados pela administração no aceite. O cargo vem de um endpoint leve **`GET /roles/options`**, de baixo privilégio (`MANAGE_ACCESS_REQUESTS` **ou** `MANAGE_USERS`), no espírito do ADR 0011 — sem abrir o CRUD de cargos (`MANAGE_ROLES`).

### 5. Telefone do motorista

No aceite, o telefone do usuário criado é `payload.driver.phone`; quando ausente, usa o `contactPhone` da solicitação (**fallback**).

## Consequências

- Visitante passa a ser, de fato, um cadastro "sem acesso"; deixa de existir a prática de senha default para motoristas.
- Login inalterado (e-mail + senha); o modelo agora admite `passwordHash` nulo e o login precisa tratar esse caso.
- O e-mail deixa de ser identidade obrigatória; o vínculo (`user_company`) permanece o eixo pessoa↔empresa.
- Duas migrações, sem backfill: (a) `user.email`/`user.password` nullable; (b) `access_request.user_type`. Visitantes existentes mantêm credenciais; solicitações antigas assumem `VISITOR`.
- Exige testes para: criação de Visitante sem credenciais, promoção para Colaborador, aceite por tipo, guarda de login sem senha e fallback de telefone.

## Alternativas consideradas

- **Manter `NOT NULL` e gerar e-mail/senha sintéticos** para o Visitante: rejeitada — polui a identidade e mantém uma senha previsível para quem não deveria acessar.
- **Não registrar o tipo na solicitação** (decidir apenas no aceite): rejeitada — o solicitante não consegue expressar a intenção (ex.: motorista que precisa de acesso) e o gestor perde o contexto ao decidir.
- **Guardar o tipo dentro do `payload` (jsonb)**: rejeitada — é atributo de primeira classe do pedido (aparece em lista/detalhe e decide o aceite); merece coluna própria com o enum já existente.
- **Expor cargo via `GET /roles` (`MANAGE_ROLES`)**: rejeitada — quem aceita solicitação não tem essa permissão; um endpoint de seleção enxuto é suficiente e alinhado ao ADR 0011.
