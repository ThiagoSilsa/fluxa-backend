# Regras de negócio — Importação de dados por planilha (XLSX)

> Regras de negócio do **sistema de importação em lote** do SOMAR: upload de `.xlsx` para importar **departamentos, veículos, usuários e vínculo usuário-veículo**, com processamento assíncrono (fila BullMQ), **fail-fast** e histórico de jobs por empresa.
> Decisão arquitetural: [ADR 0007 — Importação de dados por planilha](../adr/0007-sistema-de-importacao-por-planilha.md).
> Modelagem da tabela `import_job`: [modelagem-usuarios-empresas-permissoes.md](../modelagem/modelagem-usuarios-empresas-permissoes.md).
> Complementa as regras dos cadastros base: [regras-negocio-cadastros-base.md](./regras-negocio-cadastros-base.md).

## 1. Acesso e escopo

1. Todos os endpoints de importação e de consulta de jobs exigem **`MANAGE_IMPORTS`** (ou `is_admin`, bypass do ADR 0004). O `POST /vehicles/import` com `freePass = true` exige também **`GRANT_FREE_PASS`** → **403** sem ela.
2. Tudo é escopado pela **empresa da sessão**: criar job, processar, listar e consultar status atuam sobre a empresa da sessão; job de outro tenant → **404** (não revela existência).
3. O upload aceita apenas arquivos **`.xlsx`** de até **50MB** (validação no `FileInterceptor` e no client) → **400** fora disso.

## 2. Fluxo e ciclo de vida do job

4. O upload **não** processa a planilha de forma síncrona: o use case valida a estrutura (extensão, aba fixa `data`, planilha vazia, colunas obrigatórias presentes, colunas desconhecidas), salva o arquivo em diretório temporário, cria o job `PENDING` e enfileira na fila do tipo → responde `201 { jobId, status: 'PENDING' }`.
5. O worker processa em background (`concurrency: 1` por fila): marca `PROCESSING` + `startedAt`, relê a planilha do disco, valida **linha a linha** e insere em **lotes de 500** (`createBatch`).
6. **Fail-fast**: qualquer linha inválida → o job vai para `FAILED` com `errorMessage` `Linha N: ...` (linha 1 é o cabeçalho; dados começam na linha 2) e **nada é inserido**. O usuário corrige a planilha e reimporta.
7. Sucesso → `DONE` com `processedRows = totalRows`, `successCount = totalRows`, `errorCount = 0` e `completedAt`. Falha → `FAILED` com `errorCount = 1`, `errorMessage` e `completedAt`. O arquivo temporário é sempre removido (`finally`).
8. Retry: `attempts: 2` com backoff exponencial (5000ms) — falhas transitórias (Redis, disco) tentam de novo; o histórico no banco é a fonte da verdade da UI.
9. `PARTIAL` permanece no enum `import_job_status` como **reserva** (importação parcial é evolução futura) — não é produzido no v1.

## 3. Histórico e consulta

10. `GET /import-jobs?type=&limit=&offset=` lista os jobs da empresa da sessão, do mais recente para o mais antigo, no formato padrão `{ limit, offset, count, data }`.
11. `GET /import-jobs/:jobId` devolve o job (para o polling de 3s da UI) ou **404** se não existir/for de outro tenant.
12. `ImportJobResponse`: `{ id, type, status, totalRows, processedRows, successCount, errorCount, errorMessage, fileName, createdAt, startedAt, completedAt }`.

## 4. Planilha e template

13. A planilha tem **aba fixa chamada `data`** (linha 1 = cabeçalho). O template baixável (gerado **no client**, ExcelJS) ensina o padrão: aba `data` + aba de **regras** + abas de **referência** (tipos de veículo, departamentos, cargos — populadas via API).
14. Linhas totalmente vazias são ignoradas; colunas sem cabeçalho são descartadas; células de fórmula/rich text/hyperlink/data valem o **texto exibido**; células de erro (`#DIV/0!` etc.) → **400**.
15. Referências usam **chaves naturais** (nunca UUID): tipo de veículo pelo **código** (`vehicleType`), departamento pelo **nome**, cargo pelo **nome**, veículo pela **placa**, usuário pelo **e-mail**.
16. Valores booleanos: `true`/`false` (case-insensitive) — valores inválidos → erro de linha.

## 5. Importação de departamentos (`POST /departments/import`)

17. Colunas: `name*`, `parkingSpace*`, `description?`.
18. Por linha: `name` entre 2 e 255 caracteres; `parkingSpace` inteiro ≥ 0 (0 = sem vagas); **nome duplicado na empresa → erro** (não há unique no banco — checagem em código). `is_active = true` no import.

## 6. Importação de veículos (`POST /vehicles/import`)

19. Colunas: `plate*`, `vehicleType*` (código), `model?`, `color?`, `observation?`, `freePass?`, `department?` (nome — departamento padrão, opcional).
20. Por linha: placa **normalizada** (`trim` + `uppercase` + sem hífen/espaços) e **formato brasileiro** (`ABC1234`/`ABC1D23`) → erro se inválido; `vehicleType` (código) deve existir e estar **ativo** na empresa → erro; `freePass` exige `GRANT_FREE_PASS` (senão **403** antes do job); `department` (nome), se preenchido, deve existir na empresa → erro; **placa duplicada na empresa → erro** (unique `(company_id, plate)`).
21. Quando `department` é informado, o processor cria o veículo e define o **departamento padrão** (mesma semântica do `PUT /vehicles/:id/department` — ADR 0006 §8). `is_blocked` é derivado (não entra no import); `is_active = true`.
22. `isPrimary`/`canDrive` **não** fazem parte do template de veículos — vínculos de motorista entram na importação de vínculo usuário-veículo.

## 7. Importação de usuários (`POST /users/import`)

23. Colunas: `email*`, `name*`, `type?` (`EMPLOYEE`/`VISITOR`, default `EMPLOYEE`), `password?`, `phone?`, `document?`, `role?` (nome).
24. Por linha: e-mail **normalizado** e válido; `name` obrigatório (pessoa nova); `type` válido; `document` (se informado) **único** na base → erro; `role` (nome), se preenchido, deve existir e estar **ativo** na empresa → erro; **e-mail duplicado na empresa → erro**.
25. **Senha**: coluna opcional. Em branco, o worker usa a senha padrão de onboarding da env **`IMPORT_DEFAULT_PASSWORD`**. A senha é sempre gravada como hash (mesmo mecanismo do `CreateUserUseCase` — ADR 0005).
26. Pessoa com e-mail **já existente** em outra empresa → cria **apenas** o vínculo `user_company` (não sobrescreve dados da pessoa); pessoa nova → cria `user` + `user_company` (+ `user_role` quando `role` informado).

## 8. Importação de vínculo usuário-veículo (`POST /user-vehicles/import`)

27. Colunas: `vehiclePlate*`, `userEmail*`, `isPrimary?` (default `false`), `canDrive?` (default `true`).
28. Por linha: veículo pela placa deve existir na empresa → erro; usuário pelo e-mail deve existir com **vínculo `user_company` ativo** na empresa → erro; **vínculo duplicado → erro** (unique `(company_id, user_id, vehicle_id)`); `isPrimary = true` respeita a invariante de **1 proprietário primário por veículo** (desmarca o anterior na mesma transação — ADR 0006 §9; concorrência cai no unique parcial → erro).
29. Qualquer `type` de usuário com vínculo ativo (inclusive `VISITOR`) pode ser vinculado como motorista.

## 9. Erros e códigos

30. Mensagens de erro por linha seguem `Linha {N}: {descrição}`; o filtro global de exceções deriva um **`code` estável** (ex.: `LINHA_3_PLACA_JA_CADASTRADA`), que o client usa para traduzir e exibir.
31. Erros estruturais (sem passar pelo worker) → **400** na hora do upload: arquivo não `.xlsx`, planilha vazia, aba `data` ausente, colunas obrigatórias ausentes, colunas desconhecidas. Job **não** é criado nesses casos.
32. A fila não disponível (Redis fora do ar) → o use case falha e **remove o arquivo temporário** (não deixa job órfão nem lixo em disco).

## 10. Fora do escopo (evolução futura)

33. Importação **parcial** (status `PARTIAL` + erros por linha persistidos), geração de QR codes pós-importação, e importação de portarias/movimento não fazem parte do v1.

## Referências

- [ADR 0007 — Importação de dados por planilha](../adr/0007-sistema-de-importacao-por-planilha.md)
- [Modelagem — usuários, empresas e permissões](../modelagem/modelagem-usuarios-empresas-permissoes.md)
- [Regras de negócio — Cadastros base](./regras-negocio-cadastros-base.md)
