# ADR 0001 — Migrations e seeds iniciais

Número do ADR: 0001
Título: Migrations e seeds iniciais: schema versionado por migrations TypeORM com SQL cru e dados base por seeds idempotentes
Data: 2026-08-11
Responsável: Thiago

## Contexto

O back-end do sistema SOMAR (controle de acesso de veículos) está na Fase 0 e precisa de um banco PostgreSQL com todo o schema do MVP (empresa, usuários, RBAC, veículos, fluxo de acesso, bloqueios, solicitações, sync, importação) e de dados base para operar (permissões, cargos, empresa padrão, usuário admin, tipos de veículo).

O projeto adota as convenções de `AGENTS.md`: docs antes do código, código transversal em `src/shared/`, multi-tenant por `company_id`, e o padrão de migrations/seeds de referência descrito em `migrations-seeds.md` (classes `MigrationInterface` com SQL cru via `queryRunner.query()`, datasources de CLI, scripts npm). O schema completo está em `planejamento/planejamento-backend/planejamento-back-end.md`.

A decisão precisa definir: como versionar o schema, como carregar dados base, como tratar colunas enumeradas, como organizar as migrations em sequência (incluindo dependências circulares de FKs) e o que é seedado versus o que fica para a administração.

## Decisão

### 1. Schema versionado exclusivamente por migrations TypeORM com SQL cru

Migrations são classes `MigrationInterface` com SQL cru em `up()`/`down()` via `queryRunner.query()`, sem `synchronize` e sem geração automática a partir de entidades. O `synchronize` fica sempre `false` no runtime e no datasource de CLI. O schema é escrito à mão, versionado e idempotente (`IF NOT EXISTS`, `DROP ... IF EXISTS`).

### 2. Seeds como migrations de DML idempotente, com datasource próprio

Dados base (permissões, cargos, empresa padrão, admin, tipos de veículo) são seeds implementados como `MigrationInterface` com DML idempotente (`ON CONFLICT DO NOTHING`, `WHERE NOT EXISTS`). Dois datasources de CLI: `typeorm.datasource.ts` (migrations + seeds) e `typeorm.seed-datasource.ts` (apenas seeds), permitindo rodar seeds independentemente em CI/CD.

### 3. Sufixo numérico único entre migrations e seeds

Migrations e seeds compartilham a mesma tabela `migrations` do TypeORM; portanto, o sufixo numérico da classe (que define a ordem) é **único e crescente entre todos os arquivos** — não pode haver `0001` de migration e `0001` de seed. A numeração de arquivo (`NNNN-`) é zero-padded, sequencial e nunca reutilizada.

### 4. Colunas enumeradas como enums nativos do PostgreSQL

Colunas com conjunto fechado de valores (status, tipos, fontes) usam `CREATE TYPE ... AS ENUM` do Postgres, porque os enums do schema são estáveis e definidos previamente no planejamento. A criação é idempotente (`DO $$ BEGIN IF NOT EXISTS ... END $$`).

### 5. Migrations agrupadas por domínio lógico, em 6 arquivos

- `0001` — RBAC multi-tenant: company, user, role, permission (global), role_permission, user_role (+ `pgcrypto`, enum `user_type`);
- `0002` — catálogo de veículos: vehicle_type, vehicle, department, vehicle_department, user_vehicle, vehicle_qr_code;
- `0003` — bloqueios e portarias: entrance, vehicle_block, entry_denial, block_request;
- `0004` — movimento e ocupação: occupancy_snapshot, vehicle_access, vehicle_movement;
- `0005` — solicitações, device e importação: access_request, device, import_job;
- `0006` — auditoria (versão completa; adiável sem impacto nas anteriores).

### 6. Dependência circular de FKs resolvida com FK adiada

`vehicle_access.access_request_id` referencia `access_request`, que é criada em migração posterior. A coluna é criada na `0004` **sem constraint**, e a `FOREIGN KEY` é adicionada via `ALTER TABLE ... ADD CONSTRAINT` na `0005`, quando `access_request` existe. Isso mantém cada migração aplicável do zero.

### 7. Dados base seedados; dados operacionais ficam com a administração

Seedados: catálogo de permissões (23 códigos), empresa padrão SOMAR (`timezone = America/Sao_Paulo`), cargos (Administração, Segurança, Presidência, Porteiro) com mapeamento inicial de permissões, usuário admin (`bcrypt`, e-mail/senha via ambiente) e tipos de veículo padrão (FROTA, PARTICULAR). **Departamentos e vagas não são seedados** — são cadastro da administração (decisão de negócio: "admin cadastra a quantidade de vagas — obrigatório").

### 8. Senha do admin via variável de ambiente com bcrypt

O hash da senha do usuário admin usa `bcrypt` (já dependência do projeto), com e-mail/senha vindos de `ADMIN_DEFAULT_EMAIL`/`ADMIN_DEFAULT_PASSWORD` (fallback apenas em dev). Nada de segredo hardcoded.

## Consequências

- Histórico completo e reversível do schema (`down()` simétrico em tudo), com rastreabilidade por arquivo e pelo conteúdo da tabela `migrations`.
- Validação garantida por `npm run test:db:migration` (Testcontainers + Postgres real aplicando do zero) antes de qualquer ambiente.
- `synchronize` nunca é confiado para produção — o schema evolui somente por migrations.
- Enums nativos dão integridade no banco, porém exigem `ALTER TYPE` para evoluir valores futuros (custo aceito pela estabilidade dos enums).
- Ambientes novos sobem com um único comando (`db:migration:run`), já com permissões, cargos, empresa e admin disponíveis.
- Cargos/permissões iniciais são um ponto de partida ajustável pela administração na web (decisão de não engessar), não um contrato rígido.

## Alternativas consideradas

### 1. `synchronize: true` em produção
Rejeitado: sem versionamento, sem histórico, sem `down()`; alterações automáticas de schema sem revisão e sem rastreabilidade. Quebra a regra de migrations como único caminho.

### 2. Geração automática de migrations a partir das entidades
Rejeitado: o projeto escreve o schema à mão para ter controle fino de constraints, uniques parciais, enums e índices; a geração automática produz SQL genérico e sem idempotência controlada.

### 3. `varchar + CHECK` em vez de enum do Postgres
Rejeitado nesta leva: os enums do schema são estáveis e definidos previamente; enums nativos são mais expressivos e seguros. Se o conjunto de valores passar a evoluir com frequência, esta alternativa pode ser reavaliada (registrando nova ADR).

### 4. Script SQL único de bootstrap
Rejeitado: sem versionamento por arquivo, sem `down()`, sem rastreabilidade na tabela `migrations`, difícil de aplicar incrementalmente em ambientes existentes.

### 5. Seedar departamentos e vagas padrão
Rejeitado: a decisão de negócio define que a administração cadastra departamentos e a quantidade de vagas (obrigatório no início); seeds desses dados criariam estado operacional fictício.
