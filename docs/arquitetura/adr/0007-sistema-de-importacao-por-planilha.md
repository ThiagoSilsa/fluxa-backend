# ADR 0007 — Importação de dados por planilha (XLSX)

Número do ADR: 0007
Título: Sistema de importação de cadastros por planilha XLSX: upload assíncrono com fila BullMQ, tabela import_job com fail-fast, templates gerados no client e referências por chaves naturais
Data: 2026-08-20
Responsável: Thiago

## Contexto

Para facilitar a integração do SOMAR em lugares novos, a administração precisa importar **cadastros base em lote** a partir de planilhas Excel (`.xlsx`): departamentos, veículos, usuários e o vínculo usuário-veículo. A infraestrutura de fila já existe (`@nestjs/bullmq`/`bullmq`/`ioredis`, Redis no `docker-compose.yml` e no `.env` — [ADR 0001](./0001-migrations-seeds-iniciais.md)), a permissão `MANAGE_IMPORTS` já está no catálogo e no papel Administração ([ADR 0004](./0004-sistema-de-cargos-e-permissoes.md)), e a tabela `import_job` já foi criada na migration `0005` ([modelagem-usuarios-empresas-permissoes.md](../modelagem/modelagem-usuarios-empresas-permissoes.md)) com ENUMs `import_job_type` (`VEHICLE`, `USER`, `USER_VEHICLE`) e `import_job_status` (`PENDING`, `PROCESSING`, `DONE`, `FAILED`, `PARTIAL`), colunas `file_url`, `errors` (jsonb), `created_by`, `total_rows` e `processed_rows`.

A equipe trouxe como referência um sistema de importação de outro aplicativo (upload multipart → job em `import_jobs` → fila BullMQ → worker em lote → histórico com progresso), com template XLSX gerado no client (aba fixa `data` + abas de regras/referência). Em discussão em 20/08, ficaram definidos: **escopo v1** (departamentos, veículos, usuários e vínculo usuário-veículo), **estratégia fail-fast** (qualquer linha inválida → job `FAILED`, nada inserido), **template gerado no client**, endpoints de consulta `GET /import-jobs` e `GET /import-jobs/:jobId`, rota web `/management/imports` (mantida, com abas), **polling de 3s**, testes de integração com **Redis via Testcontainers**, senha de usuário opcional com default (`IMPORT_DEFAULT_PASSWORD`), coluna opcional `department` no template de veículos, **remoção da coluna `errors`**, cargo referenciado por **nome** (o cargo não tem `code`), `POST /user-vehicles/import` na feature `vehicles`, e um **filtro global de `code`** de erro estável.

Este ADR define o contrato da API de importação, a evolução da tabela `import_job`, o processamento em fila, as regras fail-fast por recurso e os templates.

## Decisão

### 1. Escopo v1 e estrutura de features

Escopo v1: importar **departamentos**, **veículos**, **usuários** e **vínculo usuário-veículo** (espelha o ENUM `import_job_type` atual + `DEPARTMENT`). Não há feature nova "import" como dona de tabelas de domínio: o módulo de importação é **infraestrutura transversal**:

- `src/features/imports/` — módulo genérico de jobs: entidade/repositório `import_job`, use cases de listagem e status, controller `GET /import-jobs` + `GET /import-jobs/:jobId`; exporta `IMPORT_JOB_REPOSITORY`;
- cada feature de domínio (departments, vehicles, users) ganha o **seu** importador: use case (upload/validação estrutural + cria job + enfileira), processor (worker) e controller `POST /<recurso>/import`; o vínculo usuário-veículo vive na feature `vehicles` (`POST /user-vehicles/import`), que já detém `user_vehicle`;
- `src/shared/queue/` (módulo global de filas), `src/shared/spreadsheet/` (leitura XLSX — único ponto que conhece o ExcelJS) e `src/shared/filters/http-error-code.filter.ts` (código de erro estável) — conforme a lista de código transversal do AGENTS.md.

### 2. Processamento assíncrono com fila (BullMQ)

O upload **nunca** é processado de forma síncrona: o use case valida a estrutura (extensão, aba `data`, colunas), salva o arquivo em diretório temporário, cria o job `PENDING` e enfileira. O worker relê o arquivo do disco e processa em background.

- Uma fila por tipo: `import-departments`, `import-vehicles`, `import-users`, `import-user-vehicles`;
- `@Processor(QUEUE, { concurrency: 1 })` — evita corrida entre importações do mesmo tipo;
- `attempts: 2` com `backoff` exponencial (5000ms) — cobre Redis/transiência;
- `removeOnComplete: 50` / `removeOnFail: 100` — retenção do histórico;
- módulo `@Global()` registra `BullModule.forRootAsync` com `REDIS_HOST`/`REDIS_PORT`.

### 3. Estratégia fail-fast + evolução da tabela `import_job` (migration `0011`)

**Fail-fast**: o worker valida linha a linha e, no **primeiro** erro, marca o job `FAILED` com `errorMessage` `Linha N: ...`; **nada é inserido**. O usuário corrige a planilha e reimporta. Os contadores `success_count`/`error_count` são preenchidos (no sucesso, `successCount = total`; na falha, `errorCount = 1` com a mensagem).

A tabela `import_job` existente é **evoluída** (migration `0011-adapt-import-job-schema.ts`), não substituída:

- **Adiciona** `file_name` (varchar 255), `success_count` (int, default 0), `error_count` (int, default 0), `error_message` (text), `started_at` (timestamptz), `completed_at` (timestamptz);
- **Remove** a coluna `errors` (jsonb) — desenhada para importação parcial, sem uso no fail-fast (decisão 20/08; tabela vazia, sem perda);
- **Estende** o ENUM `import_job_type` com `ALTER TYPE ... ADD VALUE IF NOT EXISTS 'DEPARTMENT'`;
- `import_job_status` permanece com `PENDING`/`PROCESSING`/`DONE`/`FAILED` em uso (fail-fast) e `PARTIAL` no enum, **reservado** para uma eventual importação parcial futura;
- `file_url` e `created_by` permanecem (o worker grava o arquivo em disco; o criador do job é o ator autenticado).

`ALTER TYPE ... ADD VALUE` dentro da transação da migration é permitido no PG16 (o valor não pode ser usado na mesma transação — a migration não o usa).

### 4. Leitura centralizada da planilha (aba fixa `data`)

`src/shared/spreadsheet/read-spreadsheet.util.ts` é o **único arquivo** que conhece o ExcelJS: `readSheetAsRows({ buffer } | { filePath })` lê a aba fixa **`data`** (linha 1 = cabeçalho; dados da linha 2 em diante), ignora linhas vazias, descarta colunas sem cabeçalho, reduz células de fórmula/rich text/hyperlink/data ao texto exibido e lança 400 em células de erro (`#DIV/0!` etc.). Trocar a biblioteca de planilha é alterar um único arquivo.

### 5. Templates no client e referências por chaves naturais

O template é **gerado no client** (ExcelJS, import dinâmico), com a aba `data` (cabeçalho + linha de exemplo), a aba de **regras** e abas de **referência** populadas via API (tipos de veículo, departamentos, cargos). As colunas de referência usam **chaves naturais amigáveis** (nunca UUID):

| Recurso                     | Colunas da aba `data` (obrigatórias `*`)                                                                                                                                                                  |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Departamentos**           | `name*`, `parkingSpace*` (int ≥ 0), `description?`                                                                                                                                                        |
| **Veículos**                | `plate*` (formato BR, normalizada), `vehicleType*` (código do tipo, ex.: `FROTA`), `model?`, `color?`, `observation?`, `freePass?` (`true`/`false`), `department?` (nome — departamento padrão, opcional) |
| **Usuários**                | `email*`, `name*`, `type?` (`EMPLOYEE`/`VISITOR`, default `EMPLOYEE`), `password?`, `phone?`, `document?`, `role?` (nome do cargo)                                                                        |
| **Vínculo usuário-veículo** | `vehiclePlate*`, `userEmail*`, `isPrimary?` (`true`/`false`, default `false`), `canDrive?` (`true`/`false`, default `true`)                                                                               |

### 6. Endpoints e permissões

Todos os endpoints exigem **`MANAGE_IMPORTS`** (`JwtAuthGuard` + `PermissionsGuard`; bypass de `is_admin` conforme ADR 0004 §2). O `POST /vehicles/import` com `freePass = true` exige também **`GRANT_FREE_PASS`** (mesma regra do CRUD — ADR 0006 §4).

| Método | Rota                                | Entrada                         | Resposta                           |
| ------ | ----------------------------------- | ------------------------------- | ---------------------------------- |
| `POST` | `/departments/import`               | multipart `file` (.xlsx ≤ 50MB) | `201 { jobId, status: 'PENDING' }` |
| `POST` | `/vehicles/import`                  | multipart `file`                | `201 { jobId, status: 'PENDING' }` |
| `POST` | `/users/import`                     | multipart `file`                | `201 { jobId, status: 'PENDING' }` |
| `POST` | `/user-vehicles/import`             | multipart `file`                | `201 { jobId, status: 'PENDING' }` |
| `GET`  | `/import-jobs?type=&limit=&offset=` | —                               | `{ limit, offset, count, data[] }` |
| `GET`  | `/import-jobs/:jobId`               | —                               | job ou **404**                     |

`ImportJobResponse`: `{ id, type, status, totalRows, processedRows, successCount, errorCount, errorMessage, fileName, createdAt, startedAt, completedAt }`. Tudo escopado pela **empresa da sessão**; job de outro tenant → **404** (padrão ADR 0005 §1).

**Senha de usuário**: a coluna `password` é **opcional**; em branco, o worker usa a senha padrão de onboarding da env `IMPORT_DEFAULT_PASSWORD` (criada no `.env.example`). E-mails normalizados (ADR 0005); pessoa já existente em outra empresa vira apenas `user_company` (mesma semântica do `CreateUserUseCase`).

### 7. Código de erro estável (filtro global)

`src/shared/filters/http-error-code.filter.ts` — `@Catch()` global (registrado via `APP_FILTER` no `AppModule`) que adiciona `code` estável ao corpo de erro, derivado da mensagem (normalização NFD → `_` → `UPPERCASE`; prefixo `ERROR_` quando começa com dígito). Erros de importação seguem o padrão `Linha {N}: {descrição}` → `LINHA_{N}_{MENSAGEM}`; colunas ausentes/desconhecidas geram códigos próprios. O client já espera `payload.code` (`ApiErrorPayload`); o filtro beneficia o app inteiro, não só a importação.

### 8. Validação fail-fast por recurso e `createBatch`

No worker, cada linha é validada com as mesmas regras dos use cases de cadastro (ADR 0006 / ADR 0005), **por chave natural** e dentro da empresa da sessão:

- **Departamento**: `name` 2–255; `parkingSpace` int ≥ 0; nome duplicado na empresa → erro (não há unique no banco — checagem em código);
- **Veículo**: placa normalizada + formato BR; `vehicleType` (code) existente e ativo na empresa; `freePass` `true`/`false` (exige `GRANT_FREE_PASS`); `department` (nome) existente na empresa; placa duplicada → erro;
- **Usuário**: e-mail normalizado/válido; `name` obrigatório (pessoa nova); `type` válido; `document` único; `role` (nome) existente e ativo; e-mail duplicado → erro;
- **Vínculo**: `vehiclePlate` existente; `userEmail` existente com `user_company` **ativo**; vínculo duplicado → erro; `isPrimary = true` respeita a invariante de 1 primário por veículo (desmarca o anterior na mesma transação — ADR 0006 §9).

A inserção é em **lotes (`createBatch`, chunks de 500)** nos repositórios de destino, na mesma transação de cada chunk. Para `user`, o `createBatch` cria `user` + `user_company` (+ `user_role` quando `role` informado); para `user_vehicle`, o batch respeita o unique parcial do primário.

### 9. Acompanhamento do job (polling)

O client faz **polling a cada 3s** em `GET /import-jobs/:jobId` enquanto o job ativo não finaliza, com barra de progresso e contadores; ao finalizar, o histórico é invalidado. SSE/WebSocket ficam como evolução futura (ver alternativas).

### 10. Testes

- **Unitários**: use cases de import (extensão, vazio, colunas faltando/desconhecidas, validação por linha, enfileiramento), processors (XLSX real em disco → `DONE` com contadores; linha inválida → `FAILED` com `Linha N: ...`), use cases de list/status; fixture XLSX centralizada em `src/test/support/xlsx-fixture.ts`;
- **Integração**: novo `src/test/support/redis-test-container.ts` (Testcontainers Redis); `imports.integration.spec.ts` com upload real via supertest + aguardar o job + verificar registros no banco, caso de falha e permissões.

### 11. Fora do escopo desta decisão

Importação **parcial** (status `PARTIAL` + erros por linha persistidos), QR codes pós-importação, importação de movimento/ocupação e de portarias ficam para evolução futura. O código marca `TODO: <Tarefa Futura>` onde a interação for necessária.

## Consequências

- O upload não trava a requisição HTTP nem estoura timeouts; o usuário acompanha progresso e histórico por empresa (`GET /import-jobs`), e erros são acionáveis (`Linha N: ...` com `code` traduzível no client).
- A integração em lugares novos fica muito mais simples: administrador baixa o template (client), preenche e envia; a base nasce consistente (mesmas regras do CRUD).
- A tabela `import_job` fica alinhada ao modelo de histórico (contadores, mensagem, tempos); a coluna `errors` é removida sem perda (tabela vazia) e `PARTIAL` permanece no enum como reserva.
- O filtro global de `code` passa a enriquecer todas as respostas de erro da API com um identificador estável — o front já consumia `payload.code`.
- Dependência operacional: o módulo de filas exige **Redis** disponível (já presente no docker-compose); sem Redis, os uploads falham ao enfileirar (o use case lança erro e limpa o arquivo temporário).

## Alternativas consideradas

### 1. Importação parcial (status `PARTIAL` + `errors` jsonb persistindo erros por linha)

Rejeitada em 20/08: o schema original da tabela `import_job` (com `errors` e `PARTIAL`) foi desenhado para isso, mas a discussão optou pelo **fail-fast** — mais simples de operar e de depurar, mensagem clara (`Linha N: ...`), e o usuário corrige e reimporta. A coluna `errors` foi **removida** (decisão C); `PARTIAL` permanece no enum como reserva para uma evolução futura sem nova migration de tipo.

### 2. Processamento síncrono no upload

Rejeitado: arquivos grandes travariam a requisição e estourariam timeouts; sem histórico nem progresso.

### 3. Template gerado no server (endpoint `GET /imports/templates/:type`)

Rejeitado: o client já gera com ExcelJS sem custo de endpoint novo, mantém as abas de regras/referência dinâmicas e não adiciona I/O de geração no back.

### 4. SSE/WebSocket para acompanhamento

Rejeitado na v1: polling de 3s é suficiente para importações em lote e muito mais simples de operar; SSE/WebSocket ficam como evolução.

### 5. Criar uma tabela nova espelhando o modelo de referência (`import_jobs` com varchar/CHECK)

Rejeitado: a tabela `import_job` já existe (migration `0005`), está vazia e sem uso, e seus ENUMs já refletem o domínio (tipos de importação do SOMAR). Evoluí-la (migration `0011`) mantém o modelo único e evita tabela órfã.

### 6. Manter a coluna `errors` (jsonb) como reserva

Rejeitado (decisão C): com o fail-fast definido, a coluna seria schema morto; a tabela está vazia, então a remoção é limpa. O status `PARTIAL` já basta como reserva semântica para evolução futura.
