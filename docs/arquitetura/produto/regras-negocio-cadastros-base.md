# Regras de negócio — Cadastros base (tipos, veículos, departamentos e portarias)

> Regras de negócio da **API de administração dos cadastros base** do SOMAR: CRUD de `vehicle_type`, `vehicle`, `department`, `entrance` e os vínculos `vehicle_department` (departamento padrão) e `user_vehicle` (motoristas).
> Modelagem do banco: [modelagem-controle-veiculos.md](../modelagem/modelagem-controle-veiculos.md).
> Decisão arquitetural: [ADR 0006 — Cadastros base](../adr/0006-sistema-de-cadastros-base.md).
> Complementa as regras do fluxo de acesso: [regras-negocio-controle-veiculos.md](./regras-negocio-controle-veiculos.md).

## 1. Acesso e escopo

1. Os CRUDs de cadastros base exigem a permissão do catálogo (`MANAGE_VEHICLE_TYPES`, `MANAGE_DEPARTMENTS`, `MANAGE_ENTRANCES`, `MANAGE_VEHICLES`) — ou `is_admin` (bypass do ADR 0004).
2. Tudo é escopado pela **empresa da sessão**: listar, detalhar, editar e desativar atuam sobre registros da empresa da sessão; referência de outro tenant → **404** (não revela existência).
3. A leitura de cada catálogo está sob a própria permissão de gestão (autossuficiente). Perfis que criam veículos combinam `MANAGE_VEHICLES` + `MANAGE_VEHICLE_TYPES` (+ `MANAGE_DEPARTMENTS` se definem o departamento padrão) — composição feita na configuração de cargos.
4. **Desativação em vez de delete físico**: `DELETE :id` em `vehicle_type`, `vehicle`, `department` e `entrance` desativa (`is_active = false`); reativar é `PATCH` com `is_active = true`. **Exceções**: o vínculo `user_vehicle` (sem `is_active` no modelo) é removido fisicamente; e `vehicle_type` é **excluído fisicamente** (204) quando nenhum veículo da empresa o usa — com veículos referenciando (FK `vehicle.vehicle_type_id`), a exclusão é **bloqueada com 409** (a linha permanece; a suspensão reversível é PATCH com `is_active = false`).
5. **Concorrência/unicidade** (placa por empresa, `code` de tipo por empresa, vínculo duplicado, segundo `is_primary`, segundo `vehicle_department`) → **409** estável, nunca 500 cru.

## 2. Tipos de veículo (`vehicle_type`)

6. `POST`/`PATCH /vehicle-types`: `code` normalizado (`trim` + `uppercase`) e **único por empresa** → **409** em conflito.
7. `is_fleet` é **classificação** editável (relatórios/frota em uso), não muda ocupação — todos os veículos ocupam vaga.
8. Desativar um tipo **não** remove nem bloqueia os veículos que o usam: os vínculos permanecem e o tipo deixa apenas de ser selecionável para novos cadastros. **Excluir** (`DELETE /vehicle-types/:id`, 204) remove fisicamente o tipo **somente quando nenhum veículo da empresa o usa**; com veículos referenciando → **409** (bloqueio — a linha permanece).
9. O seed já cria os tipos padrão `FROTA` (is_fleet) e `PARTICULAR` para a empresa SOMAR — o CRUD gerencia os demais.

## 3. Veículos (`vehicle`)

10. **Placa**: normalizada (`trim` + `uppercase` + sem hífen/espaços) antes de qualquer uso; cadastro valida formato brasileiro (antigo `ABC1234` ou Mercosul `ABC1D23`, 7 caracteres) → **400** se inválido; placa já usada por outro veículo da empresa → **409**.
11. `vehicle_type_id` é **obrigatório** no create e deve apontar para tipo **ativo** da empresa da sessão: inexistente/outro tenant → **404**; inativo → **400**.
12. `model`, `color` e `observation` são opcionais.
13. **`is_blocked` é derivado** (existe `vehicle_block` ACTIVE) — o CRUD **não o edita**; enviar `is_blocked` no `POST`/`PATCH` → **400**. O retorno o inclui apenas como leitura.
14. **`free_pass` exige `GRANT_FREE_PASS`**: enviar `free_pass = true` no create ou no PATCH exige `MANAGE_VEHICLES` **+** `GRANT_FREE_PASS` → **403** sem ela. `free_pass = false` não exige a permissão extra.
15. Desativar um veículo **não** fecha acessos `INSIDE` em andamento (a saída continua sendo registrada), não revoga QR ativo nem bloqueios; o veículo desativado apenas deixa de operar na portaria.
16. O PATCH é **parcial**: `plate` (renormalizada, com 409 em conflito), `model`, `color`, `observation`, `vehicle_type_id`, `free_pass`, `is_active`.

## 4. Departamentos (`department`)

17. **`parking_space` é obrigatório** no create → **400** se ausente (não é seedado — cadastro da administração); `0` é aceito (departamento sem vagas).
18. Desativar um departamento **não** apaga `vehicle_department` nem acessos históricos; o departamento inativo deixa de ser selecionável na confirmação de setor da portaria e como novo departamento padrão.
19. Veículo cujo departamento padrão foi desativado **não perde o vínculo** — conta nas vagas livres na portaria até receber um novo departamento padrão.

## 5. Portarias (`entrance`)

20. `entrance` é **independente** de departamento — CRUD próprio.
21. Desativar uma portaria **não** apaga o histórico (movimentos, `entry_denial`, devices); a portaria inativa apenas deixa de ser selecionável para novos `device`/movimentos (semana 3+).

## 6. Departamento padrão do veículo (`vehicle_department`)

22. **Um departamento padrão por veículo** (unique `(company_id, vehicle_id)`): o contrato é _upsert_ na linha única — `PUT /vehicles/:id/department` cria se não existe e atualiza (reativando) se existe.
23. O departamento informado deve ser **ativo** da empresa da sessão: inexistente/outro tenant → **404**; inativo → **400**.
24. `GET /vehicles/:id/department` devolve o vínculo ativo ou **404**.
25. `DELETE /vehicles/:id/department` **desativa** o vínculo (`is_active = false`) — o veículo fica sem departamento padrão (vagas livres na portaria); definir novamente reativa/atualiza a mesma linha.

## 7. Motoristas (`user_vehicle`)

26. `POST /vehicles/:id/drivers { user_id, is_primary?, can_drive? }`: o motorista deve ter **vínculo ativo** (`user_company` ativo) com a empresa da sessão → **404** caso contrário; o veículo deve ser da empresa da sessão → **404**; vínculo já existente → **409**.
27. Qualquer `type` de usuário com vínculo ativo (inclusive `VISITOR`) pode ser motorista.
28. **Apenas 1 proprietário primário por veículo**: marcar `is_primary = true` **desmarca o primário anterior** do mesmo veículo (mesma transação); dois writes simultâneos caem no unique parcial → **409**.
29. `PATCH /vehicles/:id/drivers/:userId { is_primary?, can_drive? }` ajusta o vínculo **sem remover+recriar** (mudar `can_drive`/`is_primary` é operação de gestão corrente).
30. `DELETE /vehicles/:id/drivers/:userId` **remove o vínculo fisicamente** (o modelo não tem `is_active` em `user_vehicle`).
31. `can_drive` (default `true`) controla a autorização na portaria (semana 3+): motorista com `can_drive = false` vinculado não pode ser selecionado como condutor.

## 8. Detalhe e listagens

32. `GET /vehicles/:id` devolve o veículo **agregado**: dados do veículo + `vehicle_type` (`{ id, code, name, is_fleet }`) + departamento padrão ativo (`{ id, name }` ou `null`) + motoristas (`[{ user_id, name, is_primary, can_drive }]`) + `is_blocked` (derivado).
33. Listagens no formato padrão `{ limit, offset, data, count, parameters? }`:
    - `GET /vehicle-types?search=&isFleet=&isActive=&limit=&offset=`;
    - `GET /departments?search=&isActive=&limit=&offset=`;
    - `GET /entrances?search=&isActive=&limit=&offset=`;
    - `GET /vehicles?search=&vehicleTypeId=&departmentId=&freePass=&isActive=&limit=&offset=` — `search` normaliza a placa antes de buscar (placa ou trecho de modelo); `parameters` traz `allowed_values` completos para `vehicleTypeId` (tipos ativos) e `departmentId` (departamentos ativos).

## 9. Fora do escopo (semana 3+)

34. QR code (`PRINT_QRCODE`), bloqueios/`entry_denial`/`block_request` (`MANAGE_BLOCKS`) e `access_request` (`MANAGE_ACCESS_REQUESTS`) são features futuras — o CRUD de cadastros não cria nem altera essas tabelas.
35. O fluxo de portaria consome o catálogo: veículo desativado não resolve na busca; tipo inativo não é selecionável; departamento inativo não é selecionável na confirmação de setor; `can_drive = false` não pode ser selecionado como condutor.

## Referências

- [Modelagem — Controle de veículos e fluxo de acesso](../modelagem/modelagem-controle-veiculos.md)
- [ADR 0006 — Cadastros base](../adr/0006-sistema-de-cadastros-base.md)
- [Regras de negócio — Controle de veículos e fluxo de acesso](./regras-negocio-controle-veiculos.md)
- [Planejamento em fases — CRUDs de RBAC e cadastros base (Fase 2)](../../../../planejamento-cruds-rbac-cadastros.md)
