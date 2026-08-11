# Planejamento — Migrations e Seeds iniciais do back-end

> Documento de planejamento da implementação das migrations (schema) e seeds (dados base) iniciais do `fluxa-backend`, conforme `AGENTS.md` e o schema em `planejamento/planejamento-backend/planejamento-back-end.md`.
> Padrão de referência de implementação: `migrations-seeds.md` (classes `MigrationInterface` + SQL cru via `queryRunner.query()`, datasources de CLI, scripts npm).

## 1. Objetivo

Criar, do zero, o schema do banco (todas as tabelas do MVP) e os dados base (permissões, cargos, empresa padrão, usuário admin, tipos de veículo) usando **migrations e seeds TypeORM** versionadas e idempotentes — nunca `synchronize` em produção.

## 2. Estrutura de arquivos a criar

```
src/shared/database/typeorm/
├── config/
│   ├── typeorm.config.ts           # Config runtime do TypeOrmModule (autoLoadEntities, synchronize=false)
│   ├── typeorm.datasource.ts       # DataSource CLI: migrations + seeds
│   └── typeorm.seed-datasource.ts  # DataSource CLI: apenas seeds
├── migrations/                     # NNNN-<slug>.ts (schema)
└── seeds/                          # NNNN-<slug>.ts (dados base)

test/run-db-migration.ts            # Valida migrations em Postgres real (Testcontainers)
```

- Pastas já existentes em `src/shared/database/` (config/migrations/seeds) — estão vazias; adicionar `typeorm/` por baixo mantendo o padrão do `migrations-seeds.md` de referência.
- Código do banco fica em `src/shared/database/typeorm/` (conforme `AGENTS.md`: código transversal em `src/shared/`).

## 3. Variáveis de ambiente (novas)

| Variável                 | Default (dev)       | Uso                               |
| ------------------------ | ------------------- | --------------------------------- |
| `DB_HOST`                | `localhost`         | host do Postgres                  |
| `DB_PORT`                | `5432`              | porta                             |
| `DB_USERNAME`            | `postgres`          | usuário                           |
| `DB_PASSWORD`            | `postgres`          | senha                             |
| `DB_NAME`                | `postgres`          | database                          |
| `DB_SYNCHRONIZE`         | `false`             | nunca `true` em produção          |
| `DB_LOGGING`             | `false`             | log de SQL                        |
| `ADMIN_DEFAULT_EMAIL`    | `admin@somar.local` | e-mail do admin seed              |
| `ADMIN_DEFAULT_PASSWORD` | valor dev fixo      | senha do admin seed (hash bcrypt) |

Adicionar em `.env.example` e no `validateEnvironment` (validação de env).

## 4. Scripts npm a adicionar no `package.json`

| Script                | Comando TypeORM                                 | Função                                     |
| --------------------- | ----------------------------------------------- | ------------------------------------------ |
| `db:migration:run`    | `typeorm migration:run` (datasource)            | Aplica migrations + seeds pendentes        |
| `db:migration:revert` | `typeorm migration:revert`                      | Reverte a última aplicada                  |
| `db:migration:show`   | `typeorm migration:show`                        | Lista pendentes/executadas                 |
| `db:seed:run`         | `typeorm -d <seed-datasource> migration:run`    | Aplica apenas seeds pendentes              |
| `db:seed:revert`      | `typeorm -d <seed-datasource> migration:revert` | Reverte o último seed                      |
| `test:db:migration`   | `ts-node test/run-db-migration.ts`              | Valida migrations do zero (Testcontainers) |

Padrão dos scripts (usar o compilado `.js` se `dist/` existir, senão `typeorm-ts-node-commonjs` com o fonte `.ts`), conforme `migrations-seeds.md` seção 3.

## 5. Migrations — sequência e conteúdo

> Regras (AGENTS.md / migrations-seeds.md): numeração `NNNN` zero-padded sequencial; classe `<NomePascalCase><sufixo-numérico>`; SQL cru idempotente (`IF NOT EXISTS`/`DROP ... IF EXISTS`); nomes explícitos de constraints/índices (`PK_`, `UQ_`, `IDX_`, `FK_`); `down()` simétrico; JSDoc no topo explicando quê/porquê; `synchronize: false`.
> Decisão: colunas enumeradas usam **enum do Postgres** (`CREATE TYPE ... AS ENUM`), porque os enums do schema são estáveis; alternativa (se evolução frequente) é `varchar + CHECK` — registrar em ADR quando implementar.

### 0001 — `create-initial-multi-tenant-rbac-schema`

- `CREATE EXTENSION IF NOT EXISTS "pgcrypto"` (para `gen_random_uuid()`).
- **Enum** `user_type` (`EMPLOYEE`, `VISITOR`).
- **company**: id uuid PK default `gen_random_uuid()`, name varchar(255) NOT NULL, is_active bool NOT NULL DEFAULT true, timezone varchar(64) NOT NULL DEFAULT `'America/Sao_Paulo'`, created_at/updated_at timestamptz NOT NULL DEFAULT now().
- **user**: id uuid PK, company_id uuid NOT NULL **FK→company**, name varchar(255) NOT NULL, email varchar(255) NOT NULL, password varchar(255) NOT NULL (hash), phone varchar(32) NULL, document varchar(32) NULL, type user_type NOT NULL DEFAULT `'VISITOR'`, is_active bool NOT NULL DEFAULT true, observation text NULL, photo_url varchar(512) NULL, created_at/updated_at.
  - `UQ_user_company_id_email` — UNIQUE (company_id, email)
  - `UQ_user_company_id_document` — UNIQUE (company_id, document)
  - `IDX_user_company_id` — (company_id)
- **role**: id uuid PK, company_id uuid NOT NULL **FK→company**, name varchar(100) NOT NULL, description text NULL, is_admin bool NOT NULL DEFAULT false, is_active bool NOT NULL DEFAULT true, created_at/updated_at.
- **permission** (catálogo global, **sem** company_id): id uuid PK, code varchar(100) NOT NULL, description text NULL, created_at/updated_at. `UQ_permission_code` — UNIQUE (code).
- **role_permission**: id uuid PK, company_id uuid NOT NULL FK, role_id uuid NOT NULL **FK→role**, permission_id uuid NOT NULL **FK→permission**, created_at/updated_at. `UQ_role_permission_company_role_permission` — UNIQUE (company_id, role_id, permission_id).
- **user_role**: id uuid PK, company_id uuid NOT NULL FK, user_id uuid NOT NULL **FK→user**, role_id uuid NOT NULL **FK→role**, created_at/updated_at. `UQ_user_role_company_user_role` — UNIQUE (company_id, user_id, role_id).

### 0002 — `create-vehicle-catalog-schema`

- **vehicle_type**: id uuid PK, company_id uuid NOT NULL FK, code varchar(50) NOT NULL, name varchar(100) NOT NULL, description text NULL, is_fleet bool NOT NULL DEFAULT false, is_active bool NOT NULL DEFAULT true, created_at/updated_at. `UQ_vehicle_type_company_id_code` — UNIQUE (company_id, code).
- **vehicle**: id uuid PK, plate varchar(10) NOT NULL (normalizada), company_id uuid NOT NULL FK, model varchar(100) NULL, color varchar(50) NULL, observation text NULL, is_blocked bool NOT NULL DEFAULT false, free_pass bool NOT NULL DEFAULT false, vehicle_type_id uuid NOT NULL **FK→vehicle_type**, is_active bool NOT NULL DEFAULT true, created_at/updated_at.
  - `UQ_vehicle_company_id_plate` — UNIQUE (company_id, plate)
  - `IDX_vehicle_company_id_vehicle_type_id` — (company_id, vehicle_type_id)
- **department**: id uuid PK, name varchar(100) NOT NULL, company_id uuid NOT NULL FK, description text NULL, parking_space int NOT NULL DEFAULT 0, is_active bool NOT NULL DEFAULT true, created_at/updated_at.
- **vehicle_department**: id uuid PK, company_id uuid NOT NULL FK, vehicle_id uuid NOT NULL **FK→vehicle**, department_id uuid NOT NULL **FK→department**, is_active bool NOT NULL DEFAULT true, created_at/updated_at. `UQ_vehicle_department_company_vehicle` — UNIQUE (company_id, vehicle_id).
- **user_vehicle**: id uuid PK, company_id uuid NOT NULL FK, user_id uuid NOT NULL **FK→user**, vehicle_id uuid NOT NULL **FK→vehicle**, is_primary bool NOT NULL DEFAULT false, can_drive bool NOT NULL DEFAULT true, created_at/updated_at.
  - `UQ_user_vehicle_company_user_vehicle` — UNIQUE (company_id, user_id, vehicle_id)
  - `UQ_user_vehicle_company_vehicle_primary_true` — **unique parcial** (company_id, vehicle_id) WHERE is_primary = true (1 dono por veículo)
- **vehicle_qr_code**: id uuid PK, company_id uuid NOT NULL FK, vehicle_id uuid NOT NULL **FK→vehicle**, code varchar(64) NOT NULL (token por emissão), is_active bool NOT NULL DEFAULT true, issued_by uuid NULL **FK→user**, printed_at timestamptz NULL, created_at/updated_at.
  - `UQ_vehicle_qr_code_company_code` — UNIQUE (company_id, code)
  - `UQ_vehicle_qr_code_company_vehicle_active_true` — **unique parcial** (company_id, vehicle_id) WHERE is_active = true (1 QR ativo por veículo)

### 0003 — `create-access-and-block-schema`

- **Enums**: `vehicle_block_type` (`MANUAL`, `AUTOMATIC`), `vehicle_block_status` (`ACTIVE`, `REVOKED`), `entry_denial_reason` (`BLOCKED`, `UNREGISTERED`, `UNAUTHORIZED_DRIVER`, `OTHER`), `sync_status` (`PENDING`, `SYNCED`), `block_request_status` (`PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`).
- **entrance**: id uuid PK, company_id uuid NOT NULL FK, name varchar(100) NOT NULL, is_active bool NOT NULL DEFAULT true, created_at/updated_at.
- **vehicle_block**: id uuid PK, company_id uuid NOT NULL FK, vehicle_id uuid NULL **FK→vehicle**, plate varchar(10) NOT NULL, block_type vehicle_block_type NOT NULL DEFAULT `'MANUAL'`, reason text NOT NULL, status vehicle_block_status NOT NULL DEFAULT `'ACTIVE'`, blocked_by uuid NULL **FK→user**, blocked_at timestamptz NOT NULL DEFAULT now(), revoked_by uuid NULL **FK→user**, revoked_at timestamptz NULL, revoked_reason text NULL, created_at/updated_at.
  - `UQ_vehicle_block_company_vehicle_active` — **unique parcial** (company_id, vehicle_id) WHERE status = 'ACTIVE' AND vehicle_id IS NOT NULL
  - `UQ_vehicle_block_company_plate_active_unreg` — **unique parcial** (company_id, plate) WHERE status = 'ACTIVE' AND vehicle_id IS NULL
- **entry_denial**: id uuid PK, company_id uuid NOT NULL FK, vehicle_id uuid NULL **FK→vehicle**, plate_snapshot varchar(10) NOT NULL, block_id uuid NULL **FK→vehicle_block**, reason entry_denial_reason NOT NULL, observation text NULL, entrance_id uuid NULL **FK→entrance**, doorman_id uuid NOT NULL **FK→user**, occurred_at timestamptz NOT NULL DEFAULT now(), sync_status sync_status NOT NULL DEFAULT `'PENDING'`, idempotency_key uuid NOT NULL, created_at/updated_at.
  - `UQ_entry_denial_company_idempotency_key` — UNIQUE (company_id, idempotency_key)
  - `IDX_entry_denial_company_occurred_at` — (company_id, occurred_at)
- **block_request**: id uuid PK, company_id uuid NOT NULL FK, vehicle_id uuid NULL **FK→vehicle**, plate varchar(10) NOT NULL, reason text NOT NULL, status block_request_status NOT NULL DEFAULT `'PENDING'`, requested_by uuid NOT NULL **FK→user**, requested_at timestamptz NOT NULL DEFAULT now(), handled_by uuid NULL **FK→user**, handled_at timestamptz NULL, observation text NULL, status_history jsonb NOT NULL DEFAULT `'[]'`, resolved_block_id uuid NULL **FK→vehicle_block**, sync_status sync_status NOT NULL DEFAULT `'PENDING'`, idempotency_key uuid NOT NULL, created_at/updated_at.
  - `UQ_block_request_company_idempotency_key` — UNIQUE (company_id, idempotency_key)
  - `UQ_block_request_company_plate_pending` — **unique parcial** (company_id, plate) WHERE status = 'PENDING'
  - `IDX_block_request_company_status` — (company_id, status)

### 0004 — `create-movement-and-occupancy-schema`

- **Enums**: `movement_type` (`ENTRY`, `EXIT`), `movement_source` (`APP`, `WEB`, `QRCODE`, `PLATE`, `INITIAL`, `MANUAL`), `access_status` (`INSIDE`, `OUT`, `NO_EXIT`, `MANUAL_CLOSED`).
- **occupancy_snapshot**: id uuid PK, company_id uuid NOT NULL FK, date date NOT NULL, slot_total int NOT NULL, slot_occupied int NOT NULL, occupancy_by_department jsonb NOT NULL DEFAULT `'[]'`, peak_occupancy int NOT NULL DEFAULT 0, peak_at timestamptz NULL, created_at/updated_at. `UQ_occupancy_snapshot_company_date` — UNIQUE (company_id, date).
- **vehicle_access**: id uuid PK, company_id uuid NOT NULL FK, vehicle_id uuid NULL **FK→vehicle**, temporary_plate varchar(10) NULL, driver_user_id uuid NULL **FK→user**, temporary_driver_name varchar(255) NULL, department_id uuid NULL **FK→department**, access_request_id uuid NULL (coluna **sem FK nesta migração** — FK adicionada na 0005), over_capacity bool NOT NULL DEFAULT false, status access_status NOT NULL DEFAULT `'INSIDE'`, forced_exit bool NOT NULL DEFAULT false, entry_at timestamptz NULL, exit_at timestamptz NULL, closed_by uuid NULL **FK→user**, closed_at timestamptz NULL, created_at/updated_at.
  - `IDX_vehicle_access_company_status` — (company_id, status)
  - `IDX_vehicle_access_company_vehicle_status` — (company_id, vehicle_id, status)
  - `IDX_vehicle_access_company_temporary_plate` — (company_id, temporary_plate)
- **vehicle_movement**: id uuid PK, company_id uuid NOT NULL FK, access_id uuid NULL **FK→vehicle_access**, vehicle_id uuid NULL **FK→vehicle**, type movement_type NOT NULL, occurred_at timestamptz NOT NULL, plate_snapshot varchar(10) NOT NULL, driver_user_id uuid NULL **FK→user**, department_id uuid NULL **FK→department**, source movement_source NOT NULL, entrance_id uuid NULL **FK→entrance**, doorman_id uuid NULL **FK→user**, sync_status sync_status NOT NULL DEFAULT `'PENDING'`, idempotency_key uuid NOT NULL, created_at/updated_at.
  - `UQ_vehicle_movement_company_idempotency_key` — UNIQUE (company_id, idempotency_key)
  - `IDX_vehicle_movement_company_occurred_at` — (company_id, occurred_at)
  - `IDX_vehicle_movement_company_plate_snapshot` — (company_id, plate_snapshot)
  - `IDX_vehicle_movement_company_vehicle_occurred_at` — (company_id, vehicle_id, occurred_at)

> Ordem dentro da migração: `occupancy_snapshot` → `vehicle_access` → `vehicle_movement` (movement FK→access).

### 0005 — `create-request-device-import-schema`

- **Enums**: `access_request_type` (`NEW_USER`, `NEW_VEHICLE`, `LINK`, `BOTH`), `access_request_status` (`PENDING`, `IN_CONTACT`, `REGISTERED`, `REJECTED`, `CANCELLED`), `contact_channel` (`WHATSAPP`, `PHONE`, `EMAIL`), `device_platform` (`ANDROID`, `IOS`), `import_job_type` (`VEHICLE`, `USER`, `USER_VEHICLE`), `import_job_status` (`PENDING`, `PROCESSING`, `DONE`, `FAILED`, `PARTIAL`).
- **access_request**: id uuid PK, company_id uuid NOT NULL FK, idempotency_key uuid NOT NULL, type access_request_type NOT NULL, plate varchar(10) NOT NULL, vehicle_id uuid NULL **FK→vehicle**, user_id uuid NULL **FK→user**, status access_request_status NOT NULL DEFAULT `'PENDING'`, entry_authorized bool NOT NULL DEFAULT false, authorized_by uuid NULL **FK→user**, authorized_at timestamptz NULL, requested_by uuid NOT NULL **FK→user**, requested_at timestamptz NOT NULL DEFAULT now(), handled_by uuid NULL **FK→user**, handled_at timestamptz NULL, contact_channel contact_channel NULL, contact_phone varchar(32) NULL, department_id uuid NULL **FK→department**, payload jsonb NOT NULL DEFAULT `'{}'`, status_history jsonb NOT NULL DEFAULT `'[]'`, resolved_user_id uuid NULL **FK→user**, resolved_vehicle_id uuid NULL **FK→vehicle**, observation text NULL, created_at/updated_at.
  - `UQ_access_request_company_idempotency_key` — UNIQUE (company_id, idempotency_key)
  - `UQ_access_request_company_plate_open` — **unique parcial** (company_id, plate) WHERE status IN ('PENDING','IN_CONTACT')
  - `IDX_access_request_company_status` — (company_id, status)
  - `IDX_access_request_company_plate_status` — (company_id, plate, status)
- **device**: id uuid PK, company_id uuid NOT NULL FK, name varchar(100) NOT NULL, token varchar(64) NOT NULL, platform device_platform NOT NULL, app_version varchar(32) NULL, entrance_id uuid NULL **FK→entrance**, last_sync_at timestamptz NULL, is_active bool NOT NULL DEFAULT true, created_at/updated_at. `UQ_device_company_token` — UNIQUE (company_id, token).
- **import_job**: id uuid PK, company_id uuid NOT NULL FK, type import_job_type NOT NULL, status import_job_status NOT NULL DEFAULT `'PENDING'`, file_url varchar(512) NULL, created_by uuid NULL **FK→user**, errors jsonb NOT NULL DEFAULT `'[]'`, total_rows int NOT NULL DEFAULT 0, processed_rows int NOT NULL DEFAULT 0, created_at/updated_at.
- **Ajuste**: `ALTER TABLE "vehicle_access" ADD CONSTRAINT "FK_vehicle_access_access_request_id" FOREIGN KEY ("access_request_id") REFERENCES "access_request"("id")` (FK adiada da 0004).

### 0006 — `create-audit-log-schema` _(versão completa — opcional nesta leva)_

- **Enum** `audit_actor_type` (`USER`, `SYSTEM`, `API`).
- **audit_log**: id uuid PK, company_id uuid NULL FK (ações globais sem tenant), actor_user_id uuid NULL **FK→user**, actor_role_id uuid NULL **FK→role** (snapshot), actor_type audit_actor_type NOT NULL, action varchar(64) NOT NULL, entity_type varchar(64) NOT NULL, entity_id uuid NULL, request_id uuid NULL, context jsonb NOT NULL DEFAULT `'{}'`, old_values jsonb NULL, new_values jsonb NULL, created_at timestamptz NOT NULL DEFAULT now() (imutável — sem updated_at).
- Se adiada, criar migração posterior `0006` quando a auditoria entrar no escopo (sem impacto nas anteriores).

## 6. Seeds — sequência e conteúdo

> Regras (migrations-seeds.md): DML idempotente (`ON CONFLICT DO NOTHING`, `WHERE NOT EXISTS`), hash de senha, pré-condições, JSDoc, `down()` simétrico.
> Hash de senha: **bcrypt** (`bcrypt` já é dependência do projeto) — usar um hash bcrypt pré-computado como constante (determinístico) ou `bcrypt.hashSync(password, 10)` no seed com `WHERE NOT EXISTS` por e-mail.

### 0001 — `seed-initial-permissions`

Catálogo global de permissões (`permission`), `ON CONFLICT (code) DO NOTHING`:

`MANAGE_COMPANY`, `MANAGE_USERS`, `MANAGE_ROLES`, `MANAGE_VEHICLES`, `MANAGE_VEHICLE_TYPES`, `MANAGE_DEPARTMENTS`, `MANAGE_ENTRANCES`, `MANAGE_BLOCKS`, `MANAGE_ACCESS_REQUESTS`, `MANAGE_BLOCK_REQUESTS`, `MANAGE_IMPORTS`, `MANAGE_DEVICES`, `GRANT_FREE_PASS`, `PRINT_QRCODE`, `VIEW_DASHBOARDS`, `REGISTER_ENTRY`, `REGISTER_EXIT`, `REGISTER_DENIAL`, `CREATE_ACCESS_REQUEST`, `CANCEL_ACCESS_REQUEST`, `CREATE_BLOCK_REQUEST`, `MANUAL_CLOSE_ACCESS`, `INITIAL_ENTRY`.

### 0002 — `seed-default-company-roles-admin-vehicle-types`

Dados base por empresa — pré-condição: rodar após a 0001 (permissões).

1. **Company padrão** (SOMAR): `INSERT ... SELECT` com `WHERE NOT EXISTS (SELECT 1 FROM company WHERE name = 'SOMAR')`, `timezone = 'America/Sao_Paulo'`.
2. **Roles** da empresa: `ADMINISTRAÇÃO` (`is_admin = true`), `SEGURANÇA`, `PRESIDÊNCIA`, `PORTEIRO` — `WHERE NOT EXISTS` por (company_id, name).
3. **role_permission** (mapeamento inicial; ajustável pela admin depois — decisão "não engessar"):
   - `PORTEIRO`: REGISTER_ENTRY, REGISTER_EXIT, REGISTER_DENIAL, CREATE_ACCESS_REQUEST, CANCEL_ACCESS_REQUEST, CREATE_BLOCK_REQUEST, VIEW_DASHBOARDS
   - `SEGURANÇA`: tudo do PORTEIRO + MANAGE_BLOCKS
   - `PRESIDÊNCIA`: VIEW_DASHBOARDS, GRANT_FREE_PASS, MANAGE_BLOCKS
   - `ADMINISTRAÇÃO`: todas as permissões (via `is_admin = true` e role_permission completa)
4. **Usuário admin**: e-mail `ADMIN_DEFAULT_EMAIL` (fallback `admin@somar.local`), senha bcrypt de `ADMIN_DEFAULT_PASSWORD` (fallback dev), `type = EMPLOYEE`, `is_active = true` — `WHERE NOT EXISTS` por (company_id, email) + `user_role` ADMINISTRAÇÃO.
5. **vehicle_type** padrão da empresa: `FROTA` (`is_fleet = true`), `PARTICULAR` (`is_fleet = false`) — `ON CONFLICT (company_id, code) DO NOTHING`.

> **Departamentos** e **vagas** não são seed: são cadastro da administração (decisão: "admin cadastra a quantidade de vagas — obrigatório"). Nota no seed de que a portaria só opera após esse cadastro.

## 7. Ordem de execução e dependências

1. `npm run test:db:migration` — valida que **todas** as migrations aplicam do zero (Testcontainers + Postgres real).
2. `npm run db:migration:run` no ambiente alvo (aplica migrations + seeds 0001/0002 juntos, em ordem de sufixo).
3. `npm run db:migration:show` — confirma tudo aplicado.
4. Ambientes novos: mesmo fluxo. Produção: `DB_SYNCHRONIZE=false`, só migrations.

Dependências entre arquivos:

- Migrations: 0001 (RBAC) → 0002 (catálogo) → 0003 (bloqueios) → 0004 (movimento, com FK de access_request adiada) → 0005 (requests/device/import + FK adiada) → 0006 (auditoria, opcional).
- Seeds: 0001 (permissões) antes de 0002 (roles referenciam permissões). Suffix numérico de seeds deve ser **maior** que o de migrations? **Não** — seeds e migrations compartilham a tabela `migrations`; o sufixo precisa ser **único e crescente entre todos** (seeds `0001-seed-...` podem colidir com migration `0001-...`). Portanto: seeds usam sufixo próprio único (ex.: base `17...0001` vs migrations `17...0000`+offset) — ver o padrão do projeto de referência (sufixos distintos por arquivo).

## 8. Validação e conformidade (AGENTS.md)

- [ ] JSDoc no topo de cada migration/seed (quê e porquê; links p/ ADR quando aplicável)
- [ ] `up()` idempotente (`IF NOT EXISTS`, `ON CONFLICT`, `WHERE NOT EXISTS`)
- [ ] `down()` presente e simétrico (todas as constraints/índices com `DROP ... IF EXISTS`)
- [ ] Nomes explícitos de `PK_/UQ_/IDX_/FK_` em tudo
- [ ] `CREATE TYPE` com `DO $$ BEGIN IF NOT EXISTS ... END $$` (idempotência de enums) ou `CREATE TYPE IF NOT EXISTS` onde suportado
- [ ] `synchronize: false` no datasource; schema só por migrations
- [ ] Seeds com senha via env + fallback dev; nada de segredo hardcoded
- [ ] `npm run test:db:migration` verde (aplica do zero)
- [ ] `npm run lint` verde ao final
- [ ] Se decisão arquitetural (ex.: enum vs varchar+CHECK), registrar ADR antes de codar

## 9. Fora de escopo (nesta leva)

- Tabelas/features de versão completa que dependem de decisão posterior (auditoria — migração 0006 adiada).
- Dados de departamentos/vagas (cadastro pela admin).
- Backfill de dados (não há dados legados — go-live usa `source = INITIAL`).

---

## 10. Plano de implementação em fases

> Cada fase é **independentemente verificável** e só depende das anteriores. Ordem: infraestrutura → migrations (uma a uma, validando do zero) → seeds → validação final.
> Regra transversal: cada migration/seed segue o checklist do `AGENTS.md` (JSDoc, idempotência, `down()` simétrico, nomes `PK_/UQ_/IDX_/FK_`).

### Fase 1 — Infraestrutura de banco (datasources, env e scripts)

**Arquivos**: `.env.example`, validação de env, `src/shared/database/typeorm/config/typeorm.config.ts`, `typeorm.datasource.ts`, `typeorm.seed-datasource.ts`, scripts no `package.json`, `test/run-db-migration.ts`.

- Adicionar env vars `DB_*` e `ADMIN_DEFAULT_*` no `.env.example` e no `validateEnvironment`;
- Criar os 3 datasources (runtime com `autoLoadEntities`/`synchronize=false`; CLI migrations+seeds; CLI só seeds);
- Adicionar scripts `db:migration:run|revert|show`, `db:seed:run|revert`, `test:db:migration` (padrão com `dist/` vs fonte);
- Instalar devDependency **`testcontainers`** e criar `test/run-db-migration.ts` (Postgres 16 + `npm run build` + `db:migration:run`).

**Verificação**: `npm run db:migration:show` executa sem erro (lista vazia); datasources carregam; `npm run lint` verde.

### Fase 2 — Migration `0001` (RBAC multi-tenant)

**Arquivo**: `src/shared/database/typeorm/migrations/0001-create-initial-multi-tenant-rbac-schema.ts`.

- `pgcrypto`, enum `user_type`, tabelas `company`, `user`, `role`, `permission` (global), `role_permission`, `user_role` + uniques/índices do plano (seção 5.0001).

**Verificação**: `npm run test:db:migration` aplica **do zero até 0001**; `db:migration:show` lista 0001 executada; conferir tabelas/FKs via `psql`/query; `db:migration:revert` + `run` reaplicam sem erro.

### Fase 3 — Migration `0002` (catálogo de veículos)

**Arquivo**: `0002-create-vehicle-catalog-schema.ts`.

- `vehicle_type`, `vehicle`, `department`, `vehicle_department`, `user_vehicle`, `vehicle_qr_code` + uniques e **uniques parciais** (`is_primary`, QR ativo).

**Verificação**: do zero aplica 0001+0002; `down()` da 0002 reverte apenas a 0002 (testar revert parcial + re-run).

### Fase 4 — Migration `0003` (bloqueios e portarias)

**Arquivo**: `0003-create-access-and-block-schema.ts`.

- Enums `vehicle_block_type/status`, `entry_denial_reason`, `sync_status`, `block_request_status`; `entrance`, `vehicle_block`, `entry_denial`, `block_request` + uniques parciais de bloqueio ativo.

**Verificação**: do zero até 0003; conferir enums e partial indexes; revert/rerun.

### Fase 5 — Migration `0004` (movimento e ocupação)

**Arquivo**: `0004-create-movement-and-occupancy-schema.ts`.

- Enums `movement_type/source`, `access_status`; `occupancy_snapshot`, `vehicle_access` (**sem** FK `access_request_id`), `vehicle_movement` (FK→access). Ordem interna: snapshot → access → movement.

**Verificação**: do zero até 0004; conferir que `vehicle_access.access_request_id` existe como coluna **sem** constraint; revert/rerun.

### Fase 6 — Migration `0005` (requests, device e import) + FK adiada

**Arquivo**: `0005-create-request-device-import-schema.ts`.

- Enums `access_request_type/status`, `contact_channel`, `device_platform`, `import_job_type/status`; `access_request`, `device`, `import_job`; **`ALTER TABLE` adicionando a FK** `vehicle_access → access_request`.

**Verificação**: do zero até 0005; conferir a FK adiada em `information_schema`; revert/rerun. _(Migration 0006 — auditoria — fica fora desta leva.)_

### Fase 7 — Seeds (dados base)

**Arquivos**: `seeds/0001-seed-initial-permissions.ts`, `seeds/0002-seed-default-company-roles-admin-vehicle-types.ts`.

- 0001: catálogo de 23 permissões (`ON CONFLICT DO NOTHING`);
- 0002: company SOMAR + 4 roles + role_permission + admin (bcrypt via env) + vehicle_types FROTA/PARTICULAR (`WHERE NOT EXISTS`/`ON CONFLICT`).

**Verificação**: `db:migration:run` aplica migrations + seeds; **reexecutar os seeds** (idempotência — sem duplicar); `SELECT` confere permissões/roles/admin/vehicle_types; `db:seed:revert` reverte os seeds sem quebrar o schema.

### Fase 8 — Validação final e conformidade

- `npm run test:db:migration` **verde completo** (do zero: migrations + seeds, Postgres real);
- `npm run lint` verde;
- Revisar checklist da seção 8 (JSDoc, idempotência, `down()` simétrico, nomes de constraints);
- Conferir se a ADR 0001 precisa de atualização pós-implementação.

**Verificação**: fluxo completo em ambiente limpo + CI rodando as mesmas validações.

### Dependências entre fases

```
Fase 1 (infra) → 2 (0001) → 3 (0002) → 4 (0003) → 5 (0004) → 6 (0005) → 7 (seeds) → 8 (validação)
```

- Fases 2–6 são sequenciais (cada migration depende do schema anterior);
- Fase 7 depende de 6 (tabelas) e de 2 (permissões existem para roles);
- Fase 8 depende de todas.

### Critério de aceite da entrega

- Banco limpo sobe com **1 comando** (`db:migration:run`) já com schema + dados base;
- `test:db:migration` verde garante reprodutibilidade do zero;
- Nenhum dado operacional fake (departamentos/vagas ficam para a admin);
- Reversibilidade: cada `down()` individual funciona.
