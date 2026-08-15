# ADR 0005 — Sistema de usuários

Número do ADR: 0005
Título: Sistema de usuários: CRUD com vínculo multi-empresa — criar usuário já vinculado à empresa do ator reutilizando a pessoa existente (por e-mail), 409 para vínculo já existente, e troca de senha provisória por MANAGE_USERS (desvio temporário do ADR 0002, substituído no futuro pela recuperação de senha da pessoa)
Data: 2026-08-15
Responsável: Thiago

## Contexto

O RBAC operacional está implementado ([ADR 0004](./0004-sistema-de-cargos-e-permissoes.md)) e a identidade multi-empresa também ([ADR 0002](./0002-a-pessoa-e-a-identidade-e-a-empresa-e-um-vinculo.md)): `user` é a identidade global (`email`/`document` únicos) e `user_company` é o vínculo — o que muda por empresa (`type`, `is_active`) mora no vínculo, e a senha é da pessoa. As regras de negócio já definem que o mesmo usuário pode ter mais de uma companhia vinculada e que desativar um usuário é ato da empresa sobre a participação ([regras-negocio-usuarios-empresas-permissoes.md](../produto/regras-negocio-usuarios-empresas-permissoes.md), seção 2).

Falta, porém, a **API de gestão de usuários** que a web vai consumir na Semana 2 (cronograma intensivo): CRUD de `user`, `user_company` e `user_role`. Este ADR define o CRUD de usuários — em particular a regra de **criar já vinculado à empresa do ator**, reutilizando a pessoa quando ela já existe em outra empresa — e a **troca de senha provisória** por `MANAGE_USERS`, um desvio temporário e consciente do princípio do ADR 0002 (a senha é da pessoa), que será substituído no futuro por um sistema de recuperação de senha.

## Decisão

### 1. Gestão de usuários escopada por MANAGE_USERS e pela empresa da sessão

A feature `users` expõe o CRUD de usuários (`POST`/`GET`/`GET :id`/`PATCH`/`DELETE /users`), o vínculo de cargos (`user_role`) e a troca de senha. Todas as rotas exigem `MANAGE_USERS` (via `JwtAuthGuard` + `PermissionsGuard`, com o bypass de `is_admin` do ADR 0004 §2) e são escopadas pela empresa da sessão: listar, detalhar, editar e desativar atuam sobre usuários **com vínculo na empresa da sessão** (`user_company`), nunca sobre `user.company_id` (coluna não existe — ADR 0002).

**Gestão de administradores é exclusiva de administradores**: qualquer operação (editar, desativar, atribuir/retirar cargos, trocar senha) sobre um usuário com cargo `is_admin` ativo na empresa da sessão exige que o **ator tenha cargo `is_admin` ativo** na empresa da sessão → **403**.

### 2. Criar usuário já vinculado à empresa do ator, reutilizando a pessoa existente

`POST /users` cria o usuário **e já o vincula** à empresa do ator em uma única operação:

- **Pessoa não existe** (busca por `email` — identidade global): cria `user` (`name`, `email`, senha bcrypt, `phone?`, `document?`, `observation?`) **e** `user_company` (`company_id` da sessão, `type` do body, `is_active = true`) na mesma transação;
- **Pessoa já existe em outra empresa**: **não cria** `user` novo — apenas cria o `user_company` da empresa do ator. O body **não pode** conter dados da pessoa nem senha: `name`, `phone`, `document`, `observation` ou `password` presentes → **400** (`'Não é possível alterar dados da pessoa ao vincular um usuário existente.'`) — esses dados são da pessoa (ADR 0002), não da empresa, e a **senha não é alterada** no vínculo;
- **`type`** é aceito no body (`EMPLOYEE`/`VISITOR`) — a gestão pode criar visitantes diretamente, além do fluxo de solicitação de acesso;
- **Já existe vínculo** entre a pessoa e a empresa do ator (ativo ou inativo): **409** (`'Usuário já vinculado a esta empresa.'`) — reativar é operação de edição do vínculo, não de criação;
- **Senha**: obrigatória quando a pessoa é nova; **proibida** quando a pessoa já existe (vincular não troca senha — envio → 400);
- **`document`**: se informado e pertencer a outra pessoa → **409** (`'Documento já cadastrado.'`) — unique global (ADR 0002);
- **`email` normalizado** (`lowercase` + `trim`) antes da busca — o `UNIQUE (email)` do Postgres é case-sensitive e não pode permitir duas pessoas que só diferem por caixa;
- **Política de senha**: mínimo **6 caracteres** (aplica também à troca de senha);
- **Concorrência**: dois creates simultâneos com o mesmo e-mail — a violação do unique é traduzida em **409** (nunca 500 cru);
- A resposta indica se a pessoa foi criada ou se era um vínculo novo para pessoa existente.

### 2.1. Consulta de existência por e-mail (email-status)

`GET /users/email-status?email=...` responde **apenas** `{ exists: boolean }` — se existe conta com aquele e-mail no sistema (normalizado antes da consulta). Não devolve nome, empresas nem qualquer outro dado (não vaza quem usa o sistema — ADR 0002 §8), exige `MANAGE_USERS` (como as demais rotas) e é limitada por **throttle** (é a rota que responde "existe conta?"). O frontend consulta com debounce no campo e-mail do formulário de criação: `exists = true` → o formulário vira **"vincular"** (esconde nome/telefone/documento/senha; botão "Vincular"); `exists = false` → segue o cadastro de pessoa nova.

### 3. Edição de usuário (PATCH)

`PATCH /users/:id` é **parcial** (só os campos enviados mudam) e exige vínculo do alvo com a empresa da sessão (senão → 404):

- **Dados da pessoa** (`name`, `phone`, `document`, `observation`, `email`) são editáveis e **refletem em todas as empresas** onde a pessoa participa (são da pessoa — ADR 0002). A troca de `email` para um endereço já usado em outra empresa (ou por outra pessoa) → **409** (`'E-mail já cadastrado.'`); o mesmo vale para `document` → **409** (`'Documento já cadastrado.'`) — unicidade global preservada sem depender do erro cru do banco (lacuna existente em sistemas de referência);
- **Dados do vínculo** (`type`, `is_active`) são da empresa da sessão e **não afetam** as demais empresas;
- **Senha não é editada via PATCH** — há fluxo próprio (troca de senha, seção 6);
- `is_active = false` via PATCH está sujeito à **invariante do último administrador** (seção 4) — desativar o último admin por edição também é 409;
- **Usuário com cargo `is_admin` ativo** só pode ser editado por ator com cargo `is_admin` ativo → **403**.

### 4. Desativar usuário é desativar o vínculo (com invariante do último administrador)

`DELETE /users/:id` (ou a edição do vínculo) **desativa a participação** (`user_company.is_active = false`), conforme ADR 0002 §3 — não exclui a pessoa nem remove dados pessoais. Uma pessoa sem nenhum vínculo ativo não entra em lugar nenhum.

**Invariante**: não é possível **desativar o vínculo do último usuário com cargo `is_admin` ativo** na empresa da sessão → **409** (`'Não é possível remover o último administrador ativo da empresa.'`). Assim como o cargo `is_admin` é imutável pelo CRUD (ADR 0004 §4), a administração da empresa não pode ficar órfã. Além disso, desativar **qualquer** usuário com cargo `is_admin` ativo exige ator com cargo `is_admin` ativo → **403**.

### 5. Vínculo de cargos por endpoints próprios

Cargos do usuário (`user_role`) são gerenciados por endpoints próprios (`POST`/`GET`/`DELETE /users/:id/roles`), espelhando o padrão de `role_permission` do ADR 0004 §6. Só são aceitos cargos da **empresa da sessão** (cross-tenant → 4xx); o vínculo é sempre da empresa da sessão e a duplicidade é impedida pelo unique `(company_id, user_id, role_id)`. `DELETE /users/:id/roles/:roleId` rejeita remover o cargo `is_admin` do **último usuário com cargo `is_admin` ativo** da empresa → **409** (mesma invariante da seção 4).

**Governança**: o cargo `is_admin` **é do sistema** — não é editável por nenhum usuário (criar/editar/desativar o cargo já é proibido pelo ADR 0004 §4); dele se gerencia **apenas a atribuição** (`user_role`). Atribuir **ou retirar** um cargo `is_admin` de um usuário exige que o **ator tenha cargo `is_admin` ativo** na empresa da sessão → **403** (um gestor com `MANAGE_USERS` sem `is_admin` não cria nem remove administradores). Gerenciar cargos de um usuário com cargo `is_admin` ativo também exige ator `is_admin` → **403**.

### 6. Troca de senha provisória por MANAGE_USERS

A troca de senha (`PATCH /users/:id/password`) exige `MANAGE_USERS` e tem escopo restrito:

- **Escopo**: o usuário alvo precisa ter **vínculo ativo com a empresa da sessão**; caso contrário → **404** (não revela se a pessoa existe em outra empresa — respostas indistinguíveis, ADR 0002 §8);
- **Efeito**: altera `user.password` — a senha **é da pessoa** (ADR 0002), portanto a troca vale para **todos os vínculos** da pessoa, em todas as empresas. Efeito cross-tenant inerente, aceito e documentado;
- **Sem autosserviço**: não há rota pública para o usuário trocar a própria senha — a troca é exclusivamente por `MANAGE_USERS`;
- **Usuário administrador**: trocar a senha de um usuário com cargo `is_admin` ativo exige ator com cargo `is_admin` ativo → **403**;
- **Política**: a senha nova exige **mínimo 6 caracteres**;
- **Sessões**: tokens existentes **continuam válidos** após a troca (o guard não revalida a senha) — comportamento aceito na provisória.

### 7. Desvio temporário — será substituído pela recuperação de senha

A regra §6 é uma **medida provisória e consciente**: documenta um desvio temporário do princípio do ADR 0002 (nenhuma empresa é dona da senha da pessoa). No futuro, quando o **sistema de recuperação de senha** (por pessoa, valendo para todos os vínculos do mesmo e-mail) entrar no escopo, **nenhuma empresa poderá trocar a senha do usuário** — a troca passará a ser ato da própria pessoa. O código marca `TODO: <Tarefa Futura>` no ponto da troca.

### 8. Auditoria futura

Troca de senha é ação sensível. `audit_log` está fora do MVP, mas a implementação deve marcar `TODO: <Tarefa Futura>` para registrar trocas de senha na auditoria quando ela entrar no escopo.

## Consequências

- A web ganha a API para a tela de **usuários**: criar (já vinculado), consultar existência por e-mail, listar, detalhar, editar, desativar e atribuir cargos — tudo escopado pela empresa da sessão.
- A mesma pessoa em N empresas = 1 linha em `user` + N vínculos; vincular em nova empresa **nunca** duplica a pessoa nem altera seus dados pessoais ou senha — e o contrato **rejeita (400)** o envio desses dados no vínculo.
- A rota `email-status` devolve só `{ exists }` (com throttle): a interface adapta o formulário sem vazar quem usa o sistema.
- A troca de senha por `MANAGE_USERS` é **temporária** e tem efeito cross-tenant: exceção explícita ao ADR 0002, substituída no futuro pela recuperação de senha da pessoa.
- 409 para vínculo duplicado, documento e e-mail conflitantes preserva as unicidades globais do ADR 0002 (com e-mail normalizado em `lowercase`); a invariante do **último administrador ativo** impede a administração de ficar órfã; a **governança de `is_admin`** torna a gestão de administradores (editar, desativar, atribuir/retirar cargo, trocar senha) exclusiva de administradores, e o cargo `is_admin` permanece intocável pelo CRUD (é do sistema — ADR 0004 §4).
- Seeds e testes de integração seguem o padrão de criar `user` + `user_company` + `user_role` (ADR 0002, Consequências).

## Alternativas consideradas

### 1. Criar usuário sem vínculo (vincular depois)

Rejeitado: "criar já vinculado" é a operação natural de gestão — evita o estado intermediário de pessoa sem empresa e reduz idas ao banco; o vínculo é criado na mesma transação.

### 2. Duplicar a pessoa por empresa (modelo pré-ADR 0002)

Rejeitado: contradiz o ADR 0002 — dados pessoais e senha divergiriam por empresa e a recuperação de senha da pessoa ficaria impossível.

### 3. Reativar vínculo inativo silenciosamente no create

Rejeitado: reativar é edição do vínculo (operação distinta); o create com vínculo existente devolve **409**, mantendo a semântica e evitando reativações implícitas surpreendentes.

### 4. Troca de senha como fluxo da própria pessoa (sem MANAGE_USERS)

Rejeitado **por ora**: sem sistema de recuperação de senha, o usuário sem acesso não teria como se recuperar; a troca por `MANAGE_USERS` é a medida provisória até a recuperação de senha entrar no escopo (quando o papel da empresa cai).

### 5. Ignorar dados pessoais no vínculo em vez de rejeitar

Rejeitado: "ignorar" criaria um contrato ambíguo (o cliente acha que enviou e valeu); rejeitar com **400** torna o contrato estrito e testável, e a rota `email-status` permite à interface nem tentar enviar esses campos quando a pessoa já existe.
