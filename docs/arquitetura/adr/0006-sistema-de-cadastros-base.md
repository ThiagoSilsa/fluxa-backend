# ADR 0006 — Cadastros base (tipos de veículo, veículos, departamentos e portarias)

Número do ADR: 0006
Título: Sistema de cadastros base: CRUD de tipos de veículo, veículos, departamentos e portarias com vínculos vehicle_department (1 por veículo) e user_vehicle (1 proprietário primário por veículo), placa normalizada com validação de formato, free_pass restrito a permissão específica, is_blocked derivado (não editável), desativação em vez de delete físico nos catálogos e exclusão física de tipo de veículo e departamento bloqueada com 409 quando em uso (por veículos)
Data: 2026-08-15
Responsável: Thiago

## Contexto

O RBAC operacional está implementado ([ADR 0004](./0004-sistema-de-cargos-e-permissoes.md)) e o sistema de usuários também ([ADR 0005](./0005-sistema-de-usuarios.md)). O modelo de dados dos cadastros base já existe nas migrations `0002`/`0003` ([modelagem-controle-veiculos.md](../modelagem/modelagem-controle-veiculos.md)): `vehicle_type`, `vehicle`, `department`, `vehicle_department`, `user_vehicle` e `entrance`, com seeds dos tipos padrão `FROTA`/`PARTICULAR` e das permissões (`MANAGE_VEHICLES`, `MANAGE_VEHICLE_TYPES`, `MANAGE_DEPARTMENTS`, `MANAGE_ENTRANCES`, `GRANT_FREE_PASS`). As regras de negócio do fluxo de acesso já estão definidas ([regras-negocio-controle-veiculos.md](../produto/regras-negocio-controle-veiculos.md)) e consomem esse catálogo (tipo do veículo, departamento padrão, motoristas, portarias).

Falta, porém, a **API de administração dos cadastros base** que a web vai consumir na Semana 2 (cronograma intensivo): CRUD de `vehicle_type`, `vehicle`, `department`, `entrance` e os vínculos `vehicle_department` (departamento padrão do veículo) e `user_vehicle` (motoristas). Este ADR define o contrato dessa API — rotas e permissões, desativação em vez de delete físico (com exceção de tipo de veículo e departamento, excluíveis fisicamente quando sem referências de veículos), placa normalizada com validação de formato, `free_pass` com permissão específica, `is_blocked` derivado (não editável) e as invariantes dos vínculos (1 departamento padrão e 1 proprietário primário por veículo).

## Decisão

### 1. Estrutura de features e rotas

Três features no backend, espelhando as permissões do catálogo `PermissionCode`:

- `src/features/vehicles/` — `vehicle_type`, `vehicle`, `vehicle_department`, `user_vehicle` (afinidade de domínio: o tipo e os vínculos são do catálogo de veículos);
- `src/features/departments/` — `department`;
- `src/features/entrances/` — `entrance`.

Rotas (todas via `JwtAuthGuard` + `PermissionsGuard`, com o bypass de `is_admin` do ADR 0004 §2):

| Rota                                                                                        | Permissão              |
| ------------------------------------------------------------------------------------------- | ---------------------- |
| `POST` / `GET` / `GET :id` / `PATCH :id` / `DELETE :id` `/vehicle-types`                    | `MANAGE_VEHICLE_TYPES` |
| `POST` / `GET` / `GET :id` / `PATCH :id` / `DELETE :id` `/departments`                      | `MANAGE_DEPARTMENTS`   |
| `POST` / `GET` / `GET :id` / `PATCH :id` / `DELETE :id` `/entrances`                        | `MANAGE_ENTRANCES`     |
| `POST` / `GET` / `GET :id` / `PATCH :id` / `DELETE :id` `/vehicles`                         | `MANAGE_VEHICLES`      |
| `GET` / `PUT` / `DELETE` `/vehicles/:id/department`                                         | `MANAGE_VEHICLES`      |
| `GET` / `POST` `/vehicles/:id/drivers` · `PATCH` / `DELETE` `/vehicles/:id/drivers/:userId` | `MANAGE_VEHICLES`      |

Cada rota é escopada pela **empresa da sessão**; referências de outro tenant devolvem **404** (padrão já adotado no ADR 0005 §1 — não revelar existência). A leitura de cada catálogo é **autossuficiente** (está sob a própria permissão de gestão): a composição de permissões necessária para operar uma tela (ex.: criar veículo exige escolher o tipo) é responsabilidade da configuração de cargos — um perfil que cria veículos combina `MANAGE_VEHICLES` + `MANAGE_VEHICLE_TYPES` (+ `MANAGE_DEPARTMENTS` se define o departamento padrão). Não há leitura "ampla" implícita de catálogo para quem gerencia outro catálogo.

### 2. Desativação em vez de delete físico (com exceções)

`vehicle_type`, `vehicle`, `department` e `entrance` têm `is_active` e são referenciados por vínculos, eventos e histórico (movimentos, bloqueios, QRs, acessos, devices). `DELETE :id` **desativa** (`is_active = false`, **204**), nunca apaga a linha; a reativação é `PATCH` com `is_active = true`. Desativar **não** remove, revoga nem fecha dependências (ver §10).

`user_vehicle` **não tem** `is_active` (migration `0002`): o vínculo motorista ↔ veículo é um fato pontual e a tabela guarda o unique `(company_id, user_id, vehicle_id)`. `DELETE /vehicles/:id/drivers/:userId` **remove a linha fisicamente** — a exceção de vínculo ao soft-delete, definida pelo próprio modelo.

`vehicle_type` é a **exceção de catálogo** (aprovada em 17/08, alinhada ao padrão de `role`/`user`): `DELETE /vehicle-types/:id` **exclui fisicamente** (204) quando **nenhum veículo** da empresa usa o tipo; com veículos referenciando (FK `vehicle.vehicle_type_id`), a exclusão é **bloqueada com 409** — a linha permanece e a suspensão reversível é `PATCH` com `is_active = false` (ver §6).

`department` também é **excluído fisicamente** (aprovado em 18/08, mesmo padrão): `DELETE /departments/:id` **exclui fisicamente** (204) quando **nenhum veículo** da empresa está vinculado via `vehicle_department` (departamento padrão); com vínculos, a exclusão é **bloqueada com 409** — a linha permanece e a suspensão reversível é `PATCH` com `is_active = false` (ver §7).

### 3. Placa: normalização obrigatória + validação de formato + unicidade

A placa é normalizada antes de qualquer uso (busca, criação, edição): `trim` + `uppercase` + remoção de hífens/espaços (`normalizePlate`). O `UNIQUE (company_id, plate)` do Postgres é case-sensitive e não pode permitir duas placas que só diferem por caixa.

Além da normalização, o cadastro **valida o formato brasileiro** (antigo `ABC1234` ou Mercosul `ABC1D23`, 7 caracteres) → **400** se não bater. Isso mantém o catálogo consistente e a busca por placa sem ruído; placas de veículos **não cadastrados** (fluxo da portaria, semana 3+) não passam por essa validação.

Placa já usada por outro veículo da empresa → **409** (tradução do unique; nunca 500 cru).

### 4. `is_blocked` é derivado — read-only no CRUD

O estado `vehicle.is_blocked` é **derivado** da existência de `vehicle_block` ACTIVE (regra de negócio 17 do fluxo de acesso) — o CRUD **não o edita** e **rejeita (400)** se o campo vier no body do `POST`/`PATCH`. O retorno de listagem/detalhe inclui `is_blocked` apenas como leitura (default `false` enquanto não houver bloqueios).

### 5. `free_pass` exige permissão específica (além de MANAGE_VEHICLES)

Conceder `free_pass` é ação restrita (regra do fluxo de acesso: "conceder/revogar é restrito a permissão específica"). No CRUD:

- A rota `/vehicles` exige `MANAGE_VEHICLES` no nível da classe;
- Enviar `free_pass = true` no **create** ou no **PATCH** exige, adicionalmente, **`GRANT_FREE_PASS`** → **403** sem ela (`is_admin` faz bypass, ADR 0004 §2). Enviar `free_pass = false` não é concessão e não exige a permissão extra.

### 6. `vehicle_type`: `code` normalizado e tipo inativo não selecionável

- `code` é normalizado (`trim` + `uppercase`) e único **por empresa** (unique `(company_id, code)`) → **409** em conflito;
- `is_fleet` é **classificação** editável (relatórios), não muda ocupação;
- `POST`/`PATCH /vehicles` só aceita `vehicle_type_id` de tipo **ativo** da empresa da sessão: tipo inexistente/outro tenant → **404**; tipo **inativo** → **400** (não selecionável para novos cadastros);
- Desativar um tipo **não** remove nem bloqueia os veículos que o usam — os vínculos permanecem e o tipo deixa apenas de ser selecionável;
- `DELETE /vehicle-types/:id` **exclui fisicamente** o tipo (204) quando **nenhum veículo** da empresa o usa; com veículos referenciando → **409** (bloqueio — a linha permanece; a suspensão reversível é `PATCH` com `is_active = false`).

### 7. `department`: `parking_space` obrigatório

- `parking_space` (vagas) é **obrigatório** no create → **400** se ausente (não é seedado — cadastro da administração); aceita `0` (departamento sem vagas);
- `DELETE /departments/:id` **exclui fisicamente** o departamento (204) quando **nenhum veículo** da empresa está vinculado via `vehicle_department`; com vínculos → **409** (bloqueio — a linha permanece; a suspensão reversível é `PATCH` com `is_active = false`). As tabelas históricas futuras (`vehicle_access`, `vehicle_movement`, `access_request`) têm `department_id` **nullable** e, enquanto a portaria não existir (semana 3+), não geram referências que bloqueiem a exclusão;
- Desativar um departamento **não** apaga `vehicle_department` nem acessos históricos; o departamento inativo deixa de ser selecionável na confirmação de setor da portaria e como novo departamento padrão (regra §8).

### 8. `vehicle_department` — um departamento padrão por veículo (upsert)

O unique `(company_id, vehicle_id)` permite **um** departamento padrão por veículo, ativo ou não. Como criar uma segunda linha quebraria o unique, o contrato é de **upsert na linha única**:

- `PUT /vehicles/:id/department { department_id }`: se não existe linha → cria; se existe (ativa ou inativa) → atualiza `department_id` e `is_active = true`. Valida departamento **ativo** da empresa da sessão (404 inexistente/outro tenant; 400 inativo);
- `GET /vehicles/:id/department`: devolve o vínculo ativo ou **404**;
- `DELETE /vehicles/:id/department`: **desativa** (`is_active = false`) — o veículo fica sem departamento padrão (conta nas vagas livres na portaria). O unique continua valendo, então definir novamente reativa/atualiza a mesma linha.

### 9. `user_vehicle` — motoristas com invariante de 1 primário

- `POST /vehicles/:id/drivers { user_id, is_primary?, can_drive? }`: o usuário deve ter **vínculo ativo** (`user_company` ativo) com a empresa da sessão → **404** caso contrário (validação multi-tenant da referência de `user` pelo vínculo — ADR 0002/0005); o veículo deve ser da empresa da sessão → **404**; vínculo já existente → **409** (unique `(company_id, user_id, vehicle_id)`);
- **Invariante: apenas 1 proprietário primário por veículo** (unique parcial). Marcar `is_primary = true` em um motorista **desmarca o primário anterior** do mesmo veículo na mesma transação (semântica de substituição, como a do `vehicle_department`); dois writes simultâneos caem no unique parcial → **409** (salvaguarda de concorrência, nunca 500 cru);
- `PATCH /vehicles/:id/drivers/:userId { is_primary?, can_drive? }`: ajusta o vínculo **sem remover+recriar** (mudar `can_drive`/`is_primary` é operação de gestão corrente; recriar quebraria o vínculo e o histórico);
- `DELETE /vehicles/:id/drivers/:userId`: remove o vínculo fisicamente (§2). Qualquer `type` de usuário (inclusive `VISITOR`) com vínculo ativo pode ser motorista.

### 10. Desativar catálogo não afeta dependências

Desativar `vehicle`, `vehicle_type`, `department` ou `entrance` **não** fecha acessos `INSIDE`, não revoga QR ativo, não revoga bloqueios nem apaga vínculos — operações de bloqueio/QR são de outras features (`MANAGE_BLOCKS`, `PRINT_QRCODE`, semana 3+). Consequências aceitas:

- Veículo desativado deixa de operar na portaria (não resolve na busca), mas um acesso `INSIDE` em andamento segue até a saída ser registrada (não pode "prender" o veículo);
- Departamentos e portarias inativos permanecem no histórico (movimentos, `vehicle_access`, `entry_denial`, `device`) e apenas deixam de ser selecionáveis para novos vínculos.

As únicas exclusões físicas de catálogo são `vehicle_type` (**bloqueada com 409** enquanto houver veículos usando o tipo — §2/§6) e `department` (**bloqueada com 409** enquanto houver veículos vinculados via `vehicle_department` — §2/§7); com referência, a linha permanece e a desativação segue sendo a operação de suspensão.

### 11. Detalhe e listagens

`GET /vehicles/:id` devolve o veículo **agregado** (para a tela da web): dados do veículo + `vehicle_type` (`{ id, code, name, is_fleet }`) + `department` padrão ativo (`{ id, name }` ou `null`) + `drivers` (`[{ user_id, name, is_primary, can_drive }]`) + `is_blocked` (derivado).

Listagens seguem o formato padrão `{ limit, offset, data, count, parameters? }` (AGENTS.md §3), com filtros:

- `GET /vehicle-types?search=&isFleet=&isActive=&limit=&offset=`;
- `GET /departments?search=&isActive=&limit=&offset=`;
- `GET /entrances?search=&isActive=&limit=&offset=`;
- `GET /vehicles?search=&vehicleTypeId=&departmentId=&freePass=&isActive=&limit=&offset=` — `search` normaliza a placa antes de buscar (busca por placa ou trecho de modelo); `parameters` com `allowed_values` completos para `vehicleTypeId` (tipos ativos) e `departmentId` (departamentos ativos).

### 12. Concorrência e unicidade → 409 (nunca 500 cru)

Violações de unique (placa por empresa, `code` de tipo por empresa, vínculo `user_vehicle` duplicado, segundo `is_primary` simultâneo, `vehicle_department` por veículo) são traduzidas em **409** com mensagem estável, no mesmo padrão do ADR 0005 (transações + tradução do `QueryFailedError`).

### 13. Fora do escopo desta decisão

Permanecem em features futuras (semana 3+): `vehicle_qr_code` (`PRINT_QRCODE`), `vehicle_block`/`entry_denial`/`block_request` (`MANAGE_BLOCKS`), `access_request` (`MANAGE_ACCESS_REQUESTS`) e o fluxo de portaria. O CRUD não cria nem altera essas tabelas; o código marca `TODO: <Tarefa Futura>` onde a interação for necessária (ex.: revogar QR ao desativar veículo, quando a feature de QR existir).

## Consequências

- A web ganha a API para as telas de **tipos, veículos, departamentos e portarias**: CRUD com desativação (reativável), placa normalizada com validação de formato, `free_pass` restrito a `GRANT_FREE_PASS` e o detalhe agregado do veículo (tipo + departamento padrão + motoristas + `is_blocked`).
- O catálogo nasce consistente para o fluxo de acesso: tipos ativos selecionáveis, departamentos com vagas obrigatórias, portarias desativáveis sem apagar histórico, e vínculos com as invariantes do modelo (1 departamento padrão, 1 proprietário primário) preservadas pela API (upsert/substituição) e pelo banco (uniques parciais).
- `user_vehicle` é a exceção **de vínculo** ao soft-delete — o modelo não prevê `is_active` no vínculo, e a remoção é física. No catálogo, `vehicle_type` e `department` são as exceções: excluíveis fisicamente (204), **bloqueadas com 409** enquanto houver veículos da empresa usando o tipo / vinculados ao departamento.
- Cross-tenant devolve 404 (mesmo padrão do ADR 0005), e a referência a `user` em `user_vehicle` é validada pelo vínculo ativo `user_company` (nunca por coluna inexistente `user.company_id`).
- A composição de permissões fica na configuração de cargos (cada catálogo é autossuficiente): perfis que criam veículos combinam `MANAGE_VEHICLES` + `MANAGE_VEHICLE_TYPES` (+ `MANAGE_DEPARTMENTS`), como já faz o seed da Administração.

## Alternativas consideradas

### 1. Delete físico nos catálogos (vehicle, vehicle_type, department, entrance)

Rejeitado em sua forma ampla: `vehicle`, `department` e `entrance` são referenciados por vínculos e histórico (movimentos, bloqueios, QRs, acessos, devices); delete físico quebraria FKs e o histórico de auditoria. Desativação é o padrão já usado em `role`/`user_company` (ADR 0004/0005).

**Exceções aprovadas — `vehicle_type` (17/08) e `department` (18/08):** a exclusão física é permitida **apenas** quando não há referências ativas — `vehicle_type` sem veículos usando o tipo (FK `vehicle.vehicle_type_id`); `department` sem veículos vinculados via `vehicle_department`. Com referências, o backend devolve **409** (bloqueio), preservando FKs e histórico. A suspensão reversível continua disponível via `PATCH` com `is_active = false`.

### 2. Trocar departamento padrão criando uma nova linha de `vehicle_department`

Rejeitado: o unique `(company_id, vehicle_id)` impediria criar a segunda linha enquanto a antiga existir (ativa ou inativa). O upsert na linha única (reutilizando a linha inativa) é o contrato que respeita o modelo.

### 3. `is_primary` com 409 quando já existe primário

Rejeitado: "definir o proprietário primário" é uma substituição natural — a interface não deveria exigir desmarcar o anterior em dois passos. A substituição em transação (desmarcar os demais) mantém o unique parcial como salvaguarda de concorrência.

### 4. Aceitar placa livre (só normalizar, sem validar formato)

Rejeitado: placas inconsistentes poluem o catálogo e a busca na portaria. O formato brasileiro (antigo/Mercosul) cobre os veículos reais do contexto; a validação é do cadastro, não do fluxo de portaria.

### 5. Leitura ampla de catálogos (ex.: quem tem MANAGE_VEHICLES lê vehicle_types e departments)

Rejeitado: criaria dependências implícitas de permissão e guard OR (mais complexo de testar/manter). A composição de permissões no cargo é explícita e já é a prática do seed de Administração.

### 6. Sem PATCH em `user_vehicle` (remover e recriar para mudar `can_drive`/`is_primary`)

Rejeitado: remover+recriar perde o vínculo (e seu histórico) e é frágil; ajustar `can_drive`/`is_primary` é operação de gestão corrente da tela de veículos.
