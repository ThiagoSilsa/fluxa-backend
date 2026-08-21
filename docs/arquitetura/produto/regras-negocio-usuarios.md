# Regras de negócio — Usuários

> Regras de negócio da **feature de usuários** (CRUD de `user`, `user_company` e `user_role`) do SOMAR.
> Modelagem do banco: [modelagem-usuarios-empresas-permissoes.md](../modelagem/modelagem-usuarios-empresas-permissoes.md).
> Decisão arquitetural: [ADR 0005 — Sistema de usuários](../adr/0005-sistema-de-usuarios.md).
> Complementa as regras gerais de [regras-negocio-usuarios-empresas-permissoes.md](./regras-negocio-usuarios-empresas-permissoes.md).

## 1. Acesso e escopo

1. O CRUD de usuários (criar, listar, detalhar, editar, excluir), o vínculo de cargos (`user_role`) e a troca de senha exigem `MANAGE_USERS` (ou `is_admin` — bypass do ADR 0004).
2. Tudo é escopado pela **empresa da sessão**: listar/detalhar/editar/desativar atuam sobre usuários **com vínculo** `user_company` na empresa da sessão — nunca via `user.company_id` (coluna não existe, ADR 0002).
3. **E-mail normalizado** (`lowercase` + `trim`) em login, `email-status`, criação e edição — o `UNIQUE (email)` do Postgres é case-sensitive e não pode permitir duas pessoas que só diferem por caixa.
4. **Política de senha**: mínimo de **6 caracteres** (aplica à criação e à troca de senha).
5. **Gestão de administradores é exclusiva de administradores**: qualquer operação (editar, excluir, atribuir/retirar cargos, trocar senha) sobre um usuário com cargo `is_admin` ativo na empresa da sessão exige que o **ator tenha cargo `is_admin` ativo** → **403**.

## 2. Criar usuário (já vinculado)

6. `POST /users` cria o usuário **e já o vincula** à empresa do ator (uma operação).
7. A pessoa é buscada por **e-mail** (identidade global, normalizado).
8. **Pessoa nova** → cria `user` + `user_company` (`type` do body, `is_active = true`); **senha obrigatória**.
9. **Pessoa já existe em outra empresa** → cria **apenas** o `user_company` da empresa do ator. O body **não pode** conter `name`, `phone`, `document` ou `password` → **400** (`'Não é possível alterar dados da pessoa ao vincular um usuário existente.'`) — dados da pessoa e senha não são alterados no vínculo.
10. **Já existe vínculo** com a empresa do ator (ativo ou inativo) → **409** (`'Usuário já vinculado a esta empresa.'`).
11. `document` informado e pertencente a outra pessoa → **409** (`'Documento já cadastrado.'`).
12. `type` é **obrigatório** no body (`EMPLOYEE`/`VISITOR`) — a gestão pode criar visitantes diretamente, além do fluxo de solicitação de acesso.
13. **Concorrência**: dois creates simultâneos com o mesmo e-mail — a violação do unique é traduzida em **409** (nunca 500 cru).

## 3. Consulta de existência (`email-status`)

14. `GET /users/email-status?email=` devolve **apenas** `{ exists }` — se existe conta com aquele e-mail (normalizado antes da consulta). Não devolve nome, nem em quais empresas a pessoa está (não vaza quem usa o sistema).
15. A rota é limitada por **throttle** (responde "existe conta?") e exige `MANAGE_USERS` (como as demais).
16. O frontend consulta com debounce (~500ms) no campo e-mail do formulário: `exists = true` → formulário vira **"vincular"** (some nome/telefone/documento/senha; botão "Vincular"); `exists = false` → cadastro de pessoa nova.

## 4. Edição de usuário (PATCH)

17. A edição é **parcial** (PATCH): só os campos enviados mudam.
18. **Dados da pessoa** (`name`, `phone`, `document`, `email`) são editáveis e **refletem em todas as empresas** onde a pessoa participa (são da pessoa — ADR 0002).
19. Trocar `email` para um endereço já usado em outra empresa (ou por outra pessoa) → **409** (`'E-mail já cadastrado.'`); o mesmo vale para `document` → **409** (`'Documento já cadastrado.'`) — unicidade global sem erro cru de banco.
20. **Dados do vínculo** (`type`, `is_active`) são da empresa da sessão e **não afetam** as demais empresas.
21. **Senha não é editada via PATCH** — há fluxo próprio (troca de senha, seção 7).
22. `is_active = false` via PATCH está sujeito à **invariante do último administrador** (seção 5) — desativar o último admin por edição também é 409.

## 5. Excluir e desativar usuário

23. `DELETE /users/:id` **exclui a participação** na empresa da sessão — em uma transação remove o cargo (`user_role`) e o vínculo (`user_company`). Se for a **última empresa** da pessoa **sem histórico operacional** (movements, access_requests, bloqueios, importações etc.), **remove também a pessoa** (`user`); caso contrário a pessoa **permanece** (tem outra empresa ou histórico preservado). A exclusão é **irreversível**.
24. Pessoa sem nenhum vínculo ativo não entra em lugar nenhum.
25. **Invariante**: não é possível **excluir o vínculo do último usuário com cargo `is_admin` ativo** da empresa → **409** (`'Não é possível remover o último administrador ativo da empresa.'`).
26. **Reativar**: `PATCH` com `is_active = true` (edição do vínculo) — caminho explícito de reativação.

## 6. Cargos do usuário (`user_role`)

27. **Um usuário tem no máximo UM cargo por empresa** — unique `(company_id, user_id)` (migration `0009`). Atribuir um segundo cargo ao mesmo usuário na mesma empresa → **409**.
28. Cargos do usuário são gerenciados por endpoints próprios (`POST`/`GET`/`DELETE /users/:id/roles`) **e** pelo `roleId` aceito em `POST /users` e `PATCH /users/:id` — criar/vincular já com cargo e trocar o cargo no mesmo payload (replace do cargo único).
29. Só são aceitos cargos da **empresa da sessão** (cross-tenant → 4xx).
30. Remover o cargo `is_admin` do **último usuário com cargo `is_admin` ativo** da empresa → **409** (mesma invariante da seção 5).
31. O cargo `is_admin` **é do sistema** — não é editável por nenhum usuário (criar/editar/desativar/reativar/excluir o cargo é proibido pelo ADR 0004 §4); dele se gerencia **apenas a atribuição** (`user_role`).
32. **Governança**: atribuir **ou retirar** cargo `is_admin` de um usuário exige **ator com cargo `is_admin` ativo** na empresa da sessão → **403**; gerenciar cargos de um usuário com cargo `is_admin` ativo também exige ator `is_admin` → **403**.
33. A listagem e o detalhe de usuários devolvem o **resumo do cargo** (`role: { userRoleId, roleId, roleName, isAdmin } | null`) — enriquecido em lote, sem N+1.
34. **Excluir fisicamente um cargo desvincula todos os usuários** (ADR 0004 §5): o `DELETE /roles/:id` remove o `user_role` em cascata — o resumo `role` do usuário passa a `null` e ele fica **sem cargo**. A exclusão é proibida para cargos `is_admin` (não conflita com a invariante do último administrador, regra 30). O frontend exige confirmação com aviso explícito de que os usuários vinculados ficarão sem cargo.

## 7. Troca de senha (provisória)

32. `PATCH /users/:id/password` exige `MANAGE_USERS` e muda a senha **da pessoa** (`user.password`). Trocar a senha de um usuário com cargo `is_admin` ativo exige ator com cargo `is_admin` ativo → **403** (regra 5).
33. O alvo precisa ter **vínculo ativo com a empresa da sessão**; caso contrário → **404** (não revela se a pessoa existe em outra empresa).
34. A senha é **da pessoa** (ADR 0002): a troca vale para **todos os vínculos** da pessoa, em todas as empresas — efeito cross-tenant inerente.
35. **Sem autosserviço**: não há rota pública para o usuário trocar a própria senha — a troca é exclusivamente por `MANAGE_USERS`.
36. **Sessões**: tokens existentes **continuam válidos** após a troca (o guard não revalida a senha) — comportamento aceito na provisória.
37. **Medida provisória**: até o sistema de recuperação de senha entrar no escopo. Quando entrar, **nenhuma empresa** poderá trocar a senha do usuário — a troca passa a ser ato da própria pessoa.

## Referências

- [ADR 0005 — Sistema de usuários](../adr/0005-sistema-de-usuarios.md)
- [ADR 0002 — A pessoa é a identidade e a empresa é um vínculo](../adr/0002-a-pessoa-e-a-identidade-e-a-empresa-e-um-vinculo.md)
- [Modelagem — Usuários, empresas e permissões](../modelagem/modelagem-usuarios-empresas-permissoes.md)
- [Regras de negócio — Usuários, empresas e permissões](./regras-negocio-usuarios-empresas-permissoes.md)
