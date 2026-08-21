# ADR 0008 — Gerenciamento de dispositivos (device)

Número do ADR: 0008
Título: Sistema de gerenciamento de dispositivos do app do porteiro: CRUD por empresa com token gerado pelo backend (exibido uma única vez), rotação de token, vínculo opcional com portaria, desativação como suspensão (is_active) e exclusão física sem referências
Data: 2026-08-21
Responsável: Thiago

## Contexto

O app do porteiro roda em **dispositivos físicos** (tablet da portaria / celular) que o sistema identifica pela tabela `device` (criada na migration `0005` — [modelagem-usuarios-empresas-permissoes.md](../modelagem/modelagem-usuarios-empresas-permissoes.md)): `company_id`, `name`, `token` (unique por empresa), `platform` (`ANDROID`/`IOS`), `app_version`, `entrance_id` (FK → `entrance`), `last_sync_at` e `is_active`. O tablet é **compartilhado** (sem `user_id` — decisão do [planejamento-geral](../../../../../../planejamento/planejamento-geral.md)): vários porteiros logam no mesmo aparelho e quem executa cada ação é registrado em `doorman_id`/`requested_by`.

A permissão `MANAGE_DEVICES` já está no catálogo e no papel Administração ([ADR 0004](./0004-sistema-de-cargos-e-permissoes.md), seeds `0001`/`0002`). A feature `entrances` já conta os dispositivos vinculados para bloquear a exclusão física da portaria com 409 ([ADR 0006](./0006-sistema-de-cadastros-base.md) §2/§5, via `countDevicesByEntranceIdAndCompanyId`). A rota web `/management/devices` existe como placeholder. Falta, porém, a **API e a tela de administração dos dispositivos** — a web é a única frente disponível hoje (o app é da fase 2/3 do cronograma), e a administração precisa **pré-provisionar os tablets** e depois **monitorar e suspender** os aparelhos com segurança.

O registro do app na 1ª execução e o sync (push/pull incremental usando `token` e `last_sync_at`) pertencem à fase do app (semana 3+) — fora do escopo deste ADR. Em discussão em 21/08 ficaram definidos: **CRUD completo** (a administração cria o dispositivo e o backend gera o token), **token exibido apenas na criação** (write-only), **rotação de token** (`POST /devices/:id/rotate-token`), **exclusão física permitida (204)** — o `device` não tem FK de referência — com a **desativação** (`is_active = false`) como operação de segurança (invalida o token e, pelo planejamento, o app limpa o cache local).

Este ADR define o contrato da API de dispositivos, a geração/rotação do token, o vínculo com portaria e as regras de desativação/exclusão.

## Decisão

### 1. Estrutura da feature

Nova feature `src/features/devices/` espelhando o padrão de `entrances` (ADR 0006 §1): `domain/` (entity `Device`, `DEVICE_REPOSITORY`), `application/` (use cases create/list/get/update/delete/rotate-token + DTOs + response mapper), `presentation/` (controller), `infrastructure/` (ORM entity + repositório TypeORM + providers) e `tests/` (unit + integração). O módulo importa `AuthModule` (guards compartilhados — ADR 0007 §1) e registra `TypeOrmModule.forFeature([DeviceOrmEntity])`.

**Sem migration nova**: a tabela `device` já contém todas as colunas necessárias (`name`, `token`, `platform`, `app_version`, `entrance_id`, `last_sync_at`, `is_active`, timestamps). A ORM entity é criada agora (a tabela existia desde a `0005`, usada até então apenas via SQL na feature entrances).

### 2. Endpoints e permissões

Todos os endpoints exigem **`MANAGE_DEVICES`** (`JwtAuthGuard` + `PermissionsGuard`; bypass de `is_admin` conforme ADR 0004 §2). Tudo é escopado pela **empresa da sessão**; dispositivo de outro tenant → **404** (padrão ADR 0005 §1).

| Método   | Rota                                                           | Entrada                             | Resposta                                                          |
| -------- | -------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------- |
| `POST`   | `/devices`                                                     | `{ name, platform, entranceId? }`   | `201 { device, token }` — **token exibido apenas nesta resposta** |
| `GET`    | `/devices?search=&isActive=&limit=&offset=&sortBy=&sortOrder=` | —                                   | `{ limit, offset, count, data[], parameters[] }`                  |
| `GET`    | `/devices/:id`                                                 | —                                   | device ou **404**                                                 |
| `PATCH`  | `/devices/:id`                                                 | `{ name?, entranceId?, isActive? }` | device atualizado ou **404**                                      |
| `DELETE` | `/devices/:id`                                                 | —                                   | **204** ou **404**                                                |
| `POST`   | `/devices/:id/rotate-token`                                    | —                                   | `{ device, token }` — novo token exibido uma única vez            |

`DeviceResponse`: `{ id, name, platform, appVersion, entranceId, entrance (resumo ou null), lastSyncAt, isActive, createdAt, updatedAt }` — **o token nunca aparece na resposta** (write-only, §3). Formato de listagem padrão do AGENTS.md §3.

### 3. Token: geração, write-only e rotação

- **Geração**: `crypto.randomBytes(16).toString('hex')` do Node (32 caracteres hex — cabe no `varchar(64)`), gerado no `CreateDeviceUseCase` e no `RotateDeviceTokenUseCase`.
- **Write-only**: o token é devolvido **somente** na criação (`POST /devices`) e na rotação (`POST /devices/:id/rotate-token`). **Nunca** é listado, detalhado ou editável (`GET /devices`, `GET /devices/:id`, `PATCH /devices/:id` e `DeviceResponse` não o expõem). Se a administração precisar de um novo token (tablet perdido/substituído), **rotaciona** — o token anterior deixa de valer.
- **Rotação** (`POST /devices/:id/rotate-token`): gera novo token e grava `updated_at`. Invalida o anterior (o aparelho antigo para de sincronizar na fase do sync). O device permanece com o mesmo `id`, vínculos e status.
- O token é o **identificador de sync** (semana 3+): a validação de um sync de um device **desativado** ou com token rotacionado é **rejeitada** (TODO na implementação do sync).

### 4. Vínculo com portaria (`entrance_id`)

- O vínculo é **opcional** e por `entrance_id` (FK → `entrance`). Ao vincular, a portaria deve **existir e estar ativa** na mesma empresa → senão **400** (a leitura do catálogo de portarias para o seletor vem do `parameters` da listagem, §5).
- Portaria de outro tenant → **404** (não revela existência).
- Desvincular = `PATCH` com `entranceId: null`.
- Se a portaria vinculada for **desativada**, o vínculo **permanece** (ADR 0006 §5: a portaria inativa apenas deixa de ser selecionável para novos vínculos) — o device apenas deixa de operar naquela portaria quando ela for reativada ou o vínculo trocado.
- A exclusão física de uma portaria continua **bloqueada com 409** enquanto houver dispositivos vinculados (mecanismo já existente em `entrances` — `countDevicesByEntranceIdAndCompanyId`; ADR 0006 §2/§5).

### 5. Listagem com `parameters` (opções de portaria)

`GET /devices` segue o padrão de metadados do ADR 0006 §11 (como `vehicles` faz com tipos/departamentos): além de `{ limit, offset, count, data }`, devolve **`parameters`** com `allowed_values` das **portarias ativas** da empresa (`[{ id, name }]`, chave `entrance_id`). O front usa essas opções no formulário **sem importar a feature entrances** (AGENTS.md frontend: "Não possuir importações entre features").

Filtros/ordenação: `search` (nome, case-insensitive), `isActive` (filtro de estado), `sortBy` (`name`, `createdAt`, `lastSyncAt`) e `sortOrder` (`asc`/`desc`), `limit`/`offset`.

### 6. Desativação vs. exclusão física

- **Desativação** (`PATCH /devices/:id` com `isActive = false`) é a operação de **suspensão**: o device permanece no histórico, deixa de ser operável e o token deixa de valer para sync (semana 3+). Reativação: `PATCH` com `isActive = true`. Desativar **não** remove o vínculo com a portaria nem o histórico.
- **Exclusão física** (`DELETE /devices/:id`, **204**) é **permitida** — o `device` **não tem FK de referência** de outras tabelas (os eventos usam `entrance_id`, não `device_id`; a auditoria futura guardaria `device_id` apenas em jsonb de contexto). Diferente de `vehicle_type`/`department`/`entrance`/`vehicle` (ADR 0006 §2), não há bloqueio 409. A exclusão remove o token (o aparelho para de ser reconhecido). A UI enfatiza a desativação; a exclusão fica disponível (ex.: aparelho devolvido/danificado).
- A exclusão de uma portaria com devices vinculados continua 409 (independente do device estar ativo ou não — o vínculo existe na linha).

### 7. Campos imutáveis e somente leitura

- **`platform`** é **imutável** após a criação (propriedade física do aparelho) — `PATCH` não a altera (ignorada ou 400 se divergente).
- **`app_version`** e **`last_sync_at`** são **somente leitura** na web — preenchidos pelo app no registro/sync (semana 3+). `PATCH` não os altera.
- `token` é **write-only** (§3).

### 8. Fora do escopo (evolução futura)

Registro do app na 1ª execução (reivindicação de device pré-criado por token ou criação automática), endpoints de sync (push/pull incremental, `last_sync_at`, revalidação de regras), cache offline/limpeza por desativação, retenção de 30 dias e auditoria — todos da fase do app (semana 3+). O código marca `TODO: <Tarefa Futura>` onde a interação for necessária.

## Consequências

- A administração consegue **pré-provisionar** os tablets (criar com nome/plataforma/portaria e obter o token uma única vez) e, depois, **monitorar** (versão, último sync) e **suspender** aparelhos com segurança (desativação invalida o token e dispara a limpeza de cache no app).
- A tabela `device` existente é aproveitada **sem migration nova**; a ORM entity e o repositório passam a ser a fonte de acesso (o count da feature entrances pode migrar para o repositório de devices — manter o token `ENTRANCE_REPOSITORY.countDevices...` funcionando até a migração da feature entrances, com `TODO`).
- **Segurança do token**: write-only + rotação cobre aparelho perdido/comprometido sem expor o segredo na UI.
- **Sem dependência cross-feature no front**: as portarias ativas chegam via `parameters` da listagem.
- A exclusão física de `device` não quebra FKs nem histórico (sem referências); a desativação continua sendo a operação recomendada de suspensão.

## Alternativas consideradas

### 1. Apenas gerenciar devices registrados pelo app (sem CRUD de criação)

Rejeitada: a web é a única frente disponível agora e a administração precisa **pré-provisionar** os tablets (nome, plataforma, portaria, token) antes do app existir. O CRUD completo não conflita com o registro futuro do app (o registro por token "reivindica" o device pré-criado).

### 2. Exclusão bloqueada (só desativação)

Rejeitada: `device` não tem FK de referência, então o delete físico é seguro e útil (aparelho devolvido/danificado). A desativação permanece como operação de suspensão e segurança (token inválido + limpeza de cache no app).

### 3. Token re-exibível sob demanda

Rejeitada: expor o segredo na UI reduz a segurança; a rotação cobre a necessidade de um novo token (write-only desde a criação).

### 4. Front importar o service de entrances para popular o seletor de portaria

Rejeitada: viola a regra "Não possuir importações entre features" do AGENTS.md do frontend. Usa-se o padrão `parameters.allowed_values` já adotado em `vehicles` (ADR 0006 §11), mantendo a leitura do catálogo sob a própria permissão.
