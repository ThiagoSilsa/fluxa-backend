# ADR 0004 — Sistema de cargos e permissões

Número do ADR: 0004
Título: Sistema de cargos e permissões: CRUD de cargos protegido contra alteração de cargos is_admin, vínculo de permissões por cargo (role_permission) e leitura do catálogo de permissões restrita a administrador (is_admin) ou MANAGE_ROLES
Data: 2026-08-15
Responsável: Thiago

## Contexto

A fundação do RBAC já existe: as tabelas `role`, `permission` (catálogo global) e `role_permission` foram criadas na migration `0001`, com seeds de permissões (`0001-seed-initial-permissions`) e de cargos padrão da empresa SOMAR (`0002-seed-default-company-roles-admin-vehicle-types` — Administração com `is_admin`, Segurança, Presidência e Porteiro). O login multi-empresa ([ADR 0002](./0002-a-pessoa-e-a-identidade-e-a-empresa-e-um-vinculo.md)) e o endurecimento do login ([ADR 0003](./0003-endurecimento-do-login-rate-limiting-contexto-e-eventos.md)) também estão implementados.

Falta, porém, a **API de gestão de cargos e permissões** que a web vai consumir na Semana 2 (cronograma intensivo):

- **Sem CRUD de `role`** — o administrador não consegue criar, editar, desativar nem consultar cargos;
- **Sem vínculo `role_permission`** — não há como associar/remover permissões de um cargo pela aplicação;
- **Sem leitura do catálogo `permission`** — a tela de cargos da web não tem de onde listar as permissões disponíveis;
- **Sem regra de proteção dos cargos `is_admin`** — é preciso decidir o que o CRUD pode (e não pode) fazer com eles.

Este ADR define as decisões de implementação do sistema de cargos e permissões: o CRUD de cargos, o vínculo de permissões, a leitura do catálogo e as regras de segurança (multi-tenant e proteção dos cargos de administração).

## Decisão

### 1. Leitura do catálogo de permissões restrita a administrador ou MANAGE_ROLES

A rota de recuperação do catálogo (`GET /permissions`) só é acessível quando o ator, na empresa da sessão:

- possui um cargo com `is_admin = true` **ou**
- possui a permissão `MANAGE_ROLES`.

Ou seja: **`is_admin` OU `MANAGE_ROLES`**. Um usuário comum sem essas condições recebe 403.

### 2. `is_admin` como acesso total (bypass de permissões)

Um cargo com `is_admin = true` concede **acesso total à administração**: o ator não depende das permissões listadas em `role_permission`. No `PermissionsGuard`, um ator com cargo `is_admin` ativo na empresa da sessão **ignora as verificações de permissão** — na mesma linha do bypass de `SUPER_ADMIN` já existente.

Isso torna a regra da seção 1 natural: o administrador acessa `GET /permissions` pelo `is_admin`, sem precisar ter `MANAGE_ROLES` explícita.

### 3. CRUD de cargos (`role`)

A feature `roles` expõe o CRUD completo de cargos:

- `POST /roles` — criar cargo;
- `GET /roles` — listar com paginação e filtro (formato padrão `{ limit, offset, data, count, parameters? }`);
- `GET /roles/:id` — detalhar cargo;
- `PATCH /roles/:id` — atualizar cargo;
- `DELETE /roles/:id` — desativar cargo (soft: `is_active = false`).

Todas as rotas exigem `MANAGE_ROLES` (via `JwtAuthGuard` + `PermissionsGuard`) e são escopadas pelo `company_id` da sessão.

### 4. Cargos `is_admin` protegidos (imutáveis pelo CRUD)

**Não é possível criar, editar ou excluir cargos com `is_admin = true` pelo CRUD**:

- `POST /roles` rejeita `is_admin: true`;
- `PATCH /roles/:id` rejeita alterar `is_admin` (em qualquer direção) e rejeita qualquer edição de um cargo que já é `is_admin`;
- `DELETE /roles/:id` rejeita desativar um cargo `is_admin`.

Cargos de administração são **responsabilidade do sistema**: hoje são criados pelos seeds; no futuro, quando o painel administrativo do sistema com `super_admin` for implementado, serão criados **automaticamente quando uma nova empresa for criada** (o cargo `is_admin` padrão da empresa). Essa criação automática está fora do escopo atual.

### 5. Desativação de cargo não remove vínculos

Desativar um cargo (`is_active = false`) **não remove** os vínculos existentes em `role_permission` e `user_role`. A desativação apenas impede novos usos: o cargo deixa de valer na resolução de permissões do ator, mas o histórico de vínculos permanece (sem destruição de dados).

### 6. Vínculo de permissões ao cargo (`role_permission`)

A feature `roles` também gerencia o vínculo de permissões:

- `POST /roles/:id/permissions` — associar permissão ao cargo;
- `DELETE /roles/:id/permissions/:permissionId` — remover permissão do cargo;
- `GET /roles/:id/permissions` — listar as permissões do cargo (com o catálogo disponível para associar).

Regras:

- Só são aceitas permissões do **catálogo global** (`permission`), jamais permissões inventadas; permissão inexistente → erro 4xx;
- A duplicidade é impedida pelo unique `(company_id, role_id, permission_id)`;
- O vínculo é sempre da **empresa da sessão**;
- Exige `MANAGE_ROLES`.

### 7. Multi-tenant sempre

Toda operação (criar/ler/atualizar/desativar cargo, associar/remover permissão) é **escopada pela empresa da sessão**: o `company_id` vem da sessão (JWT/ator) e nunca do body. Referências (`role_id`, `permission_id` no vínculo etc.) são validadas no mesmo `company_id` — um cargo de outra empresa é inacessível e um vínculo cross-tenant é rejeitado. O catálogo `permission` é global (sem `company_id`), mas o **vínculo** `role_permission` carrega o `company_id` da empresa da sessão.

## Consequências

- A web ganha a API para as telas de **cargos/permissões** (criar cargo, associar permissões, listar o catálogo).
- Cargos `is_admin` ficam **blindados** contra a administração: sem risco de rebaixar a própria administração nem de criar admins pelo CRUD.
- O catálogo de permissões só é exposto a quem pode gerenciar cargos (ou é admin) — não vaza para usuários comuns.
- A regra de desativação preserva histórico e evita cascatas de exclusão.
- Multi-tenant garantido em nível de aplicação: cargos e vínculos nunca vazam entre empresas.

## Alternativas consideradas

### 1. Permitir CRUD completo de cargos `is_admin`

Rejeitado: permitir criar/editar/excluir cargos de administração pelo CRUD abre **escalada de privilégios** (criar um admin, rebaixar o admin existente, desativar a administração) e conflita com a responsabilidade do sistema sobre eles. A criação automática do cargo admin de novas empresas fica para o painel com `super_admin`.

### 2. Exigir apenas `MANAGE_ROLES` na rota do catálogo de permissões

Rejeitado: um administrador (`is_admin`) deve acessar o catálogo sem depender de permissão listada — `is_admin` é acesso total por definição. A regra é **`is_admin` OU `MANAGE_ROLES`**.

### 3. Exclusão física de cargos

Rejeitado: cargos são referenciados por `role_permission` e `user_role`; exclusão física destruiria histórico e quebraria vínculos. O modelo prevê desativação (`is_active`), que não remove vínculos existentes.
