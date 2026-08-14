# Regras de negócio — Controle de veículos e fluxo de acesso

> Regras de negócio do **escopo de controle de veículos e fluxo de acesso** do SOMAR: entrada/saída, bloqueios e impedimentos, ocupação/vagas, QR code, solicitações de cadastro e entrada inicial.
> Modelagem do banco deste escopo: [modelagem-controle-veiculos.md](../modelagem/modelagem-controle-veiculos.md).
> Decisão arquitetural de referência: [ADR 0001 — Migrations e seeds iniciais](../adr/0001-migrations-seeds-iniciais.md).
> Fonte consolidada: `planejamento/planejamento-geral.md` → "Decisões de negócio (resolvidas)".

## 1. Entrada e saída de veículos

1. **Busca**: o porteiro busca por **placa** ou lê o **QR code** (adesivo no veículo).
2. **Veículo bloqueado** (`vehicle_block` ACTIVE) → aviso **"VEÍCULO PROIBIDO DE ENTRAR"** + motivo; entrada negada; o porteiro **registra o impedimento** (`entry_denial`, `reason = BLOCKED`). O porteiro **não altera** o estado de bloqueio.
3. **Veículo cadastrado com `free_pass`** → libera direto, **não pergunta** quem está dentro (privacidade/segurança).
4. **Veículo cadastrado sem `free_pass`** → mostra os usuários vinculados; porteiro verifica quem pode dirigir (`can_drive`) e seleciona o condutor.
5. **Veículo não cadastrado ou motorista não vinculado** → solicitação (`access_request`) conforme o cenário e decisão de liberar com dados temporários (ver seção 6).
6. **Vaga do departamento cheia** → apenas avisa; o porteiro pode liberar **excedendo** a capacidade (`over_capacity = true`).
7. **Registra ENTRY**: cria `vehicle_movement` (ENTRY) + `vehicle_access` (INSIDE), vinculando `access_request_id` se houver.

### Conferência na saída

8. Ao registrar a **saída**, o sistema mostra ao porteiro **quem entrou com o veículo** (condutor do `vehicle_access`), para conferência na saída.

### Reentrada / dupla leitura

9. Se um veículo já estiver `INSIDE` e for registrada nova entrada, o sistema **força o registro da saída anterior** — fecha o `vehicle_access` INSIDE existente (marcando `forced_exit = true` + gerando `vehicle_movement` EXIT) e então registra a nova entrada. **Nunca há 2 acessos INSIDE do mesmo veículo**.
10. Na saída, por segurança, encerra **todos** os acessos `INSIDE` abertos do veículo.

### Saída sem entrada (`NO_EXIT`)

11. Ao registrar saída **sem entrada registrada**, o app **avisa o porteiro**, que pergunta os dados do passageiro e registra a saída — cria `vehicle_movement` EXIT (ledger completo) e `vehicle_access` com `status = NO_EXIT`. Se o veículo tiver `free_pass`, **não pergunta nada**.

### Encerramento manual (`MANUAL_CLOSED`)

12. Usado pela **administração** em casos especiais (ex.: veículo saiu em período sem porteiro). Ao encerrar, o sistema **gera um evento de saída** (`EXIT`, `source = MANUAL`, `doorman_id` = admin), mantendo o ledger consistente; no retorno, o fluxo segue normalmente.

### Pernoite e permanência

13. **Pernoite**: não muda nada — o veículo permanece `INSIDE` até a saída ser registrada, ou até um **admin alterar manualmente** o status.
14. **Permanência**: sem alerta de permanência prolongada (sem `expected_exit_at`).

## 2. Bloqueio (estado) vs. impedimento (evento)

15. Conceitos **separados**:
    - **Estado de bloqueio** (`vehicle_block`): define se o veículo **está ou não bloqueado** (portão de acesso). Gerenciado **somente pela administração** (permissão específica) ou pelo **sistema** (bloqueio automático).
    - **Impedimento** (`entry_denial`): sempre que o porteiro **impedir a entrada**, ele **registra o evento** (placa/veículo, motivo, portaria, quem impediu, quando). É um **ledger imutável** (auditoria/relatórios).
16. `vehicle_block` é **histórico de estados**: 1 linha por bloqueio, **nunca deletada** e **nunca alterada** nos campos de bloqueio (`blocked_at/by`, `reason`, `block_type`, `plate`) após a criação. A única mutação permitida é `status ACTIVE → REVOKED` + preenchimento de `revoked_at/by/reason`.
17. O estado atual (`vehicle.is_blocked`) é **derivado** da existência de um bloqueio `ACTIVE`.
18. **Revogação**: somente admin/segurança com permissão, com **motivo obrigatório** (`revoked_reason`).
19. **Bloqueio por placa → veículo cadastrado depois**: quando um veículo com bloqueio ativo por placa (não cadastrado) é registrado, o sistema **vincula o bloqueio pela placa** (preenche `vehicle_id`) — **não revoga**.
20. **`free_pass` vs bloqueio**: o **bloqueio prevalece** — veículo com `free_pass` bloqueado não entra.

## 3. Ocupação e vagas

21. **Todos os veículos ocupam espaço, sem exceção** (particular, frota, free_pass, temporário) — ocupação = veículos com `vehicle_access` `INSIDE`.
22. **Tipos de veículo por empresa**: cada companhia define seus tipos (`vehicle_type`), não é enum fixo; no aceite de solicitação, a admin seleciona o tipo. `is_fleet` é apenas **classificação** (relatórios), não define ocupação.
23. A administração cadastra a **quantidade de vagas** de cada departamento — **obrigatório** no início da implementação (a portaria só opera após esse cadastro).
24. Veículo **sem departamento** informado conta nas **vagas livres** (total das vagas como _fallback_).
25. Vaga do departamento **cheia**: apenas avisa; o porteiro pode liberar **excedendo** (`over_capacity`).
26. **Vagas numeradas**: **não** implementadas no momento.
27. **Departamento**: vínculo **permanente** do veículo via `vehicle_department` (departamento padrão); o porteiro confirma o setor a **cada entrada** (por visita).

## 4. QR code

28. QR **revogado** (`is_active = false`) não resolve mais o veículo — ao escanear, o app mostra **"QR expirado"**.
29. Reemitir gera **novo** `code` (adesivo novo distinto do antigo); apenas **1 QR ativo por veículo** (unique parcial).
30. Geração/impressão dos QR (inclusive pós-importação de planilhas) é feita pela **web**, com permissão (`PRINT_QRCODE`).

## 5. Bloqueio automático por prazo de solicitação

31. Solicitação em `PENDING` há mais de **3 dias** (contados do `requested_at`) e **não** em `IN_CONTACT` → o sistema gera `vehicle_block` (`block_type = AUTOMATIC`) e o veículo passa a ser tratado como proibido de entrar.
32. Enquanto a solicitação estiver em `IN_CONTACT` (admin já em contato), o prazo de **3 dias se estende** — sem bloqueio automático — com **teto de 7 dias** total (contados do `requested_at`); após 7 dias, bloqueia automaticamente mesmo em `IN_CONTACT`.
33. **Revogação automática**: quando a administração registra o veículo de uma solicitação com bloqueio automático, o sistema **revoga o bloqueio automaticamente** (mesma linha, `revoked_reason` = "veículo cadastrado pela administração").

## 6. Solicitações de cadastro e vínculo (`access_request`)

34. O porteiro identifica o motorista por **busca no app** (nome/documento/telefone) e cria a solicitação conforme o cenário:
    - `NEW_USER` — veículo cadastrado, motorista **não**: no aceite cria `user` + vínculo (`user_vehicle`) com o veículo existente;
    - `NEW_VEHICLE` — motorista cadastrado, veículo **não**: no aceite cria `vehicle` + vínculo com o usuário existente;
    - `LINK` — ambos cadastrados **sem vínculo**: cria apenas `user_vehicle`; o porteiro **libera a entrada na hora** (ambos existem) e a admin só formaliza o vínculo;
    - `BOTH` — nenhum cadastrado: no aceite cria `user` + `vehicle` + vínculo.
35. No aceite, a admin define o vínculo: default `can_drive = true`; `is_primary` opcional (com ou sem; **apenas 1 primário por veículo**). O usuário criado na solicitação é do tipo **`VISITOR`**.
36. **Contato**: `contact_phone` (whatsapp) é **obrigatório** em `NEW_USER`/`NEW_VEHICLE`/`BOTH`; dispensável em `LINK` (ambos já existem).
37. **Resolução retroativa (opção A)**: ao aceitar, o sistema atualiza **todas** as `vehicle_access` (abertas INSIDE **e** já fechadas OUT/NO_EXIT) daquele veículo/placa — preenche `vehicle_id` e troca o condutor temporário pelo usuário criado. O `vehicle_movement` (ledger) **permanece imutável** (`vehicle_id` null + `plate_snapshot`).
38. **Entrada com dados temporários** é possível para motorista (`temporary_driver_name`) e/ou veículo (`temporary_plate`, `vehicle_id` NULL).
39. **Departamento**: o porteiro só pode selecionar um departamento **já criado**; se o setor não existir, a solicitação é feita **sem departamento** (conta nas vagas livres).
40. **Duplicidade**: status `DUPLICATED` foi **removido** — duplicidade vira `REJECTED` (+ observação); ao buscar o veículo, o porteiro vê que ele está cadastrado normalmente. Unique parcial evita solicitação aberta duplicada da mesma placa.
41. Ao buscar veículo **não cadastrado**: solicitação em `PENDING`/`IN_CONTACT` → mostra "**em análise**"; `REJECTED`/`CANCELLED`/`REGISTERED` → **nenhum aviso**.
42. **Rejeitar/registrar** é exclusivo da **administração**; o **porteiro pode cancelar** solicitação própria apenas em `PENDING`.
43. O porteiro tem **tela no app** para consultar as solicitações.

## 7. Solicitação de bloqueio pelo porteiro (`block_request`)

44. O porteiro pode **solicitar** o bloqueio de um veículo (cadastrado ou não, motivo obrigatório); a **administração aprova ou rejeita**.
45. `APPROVED` → o sistema cria `vehicle_block` (`block_type = MANUAL`, `blocked_by` = admin que aprovou); `REJECTED` → não bloqueia. O porteiro **nunca altera** o estado diretamente.
46. Unique parcial evita pedido de bloqueio **pendente duplicado** da mesma placa.

## 8. Entrada inicial (go-live)

47. Os dados do caderno de papel são **descartados** (sem importação).
48. Veículos **já presentes** no local quando o sistema entrar no ar são registrados pela **administração** como "**entrada inicial**": `vehicle_movement` (ENTRY, `source = INITIAL`, `occurred_at` = momento do go-live, `doorman_id` = admin) + `vehicle_access` (`INSIDE`) com departamento informado (ou "vagas livres"). O ledger nasce consistente e a ocupação/dashboard começam corretos.

## 9. Offline e sync (app do porteiro)

49. **Cache local** de veículos/placas para busca por placa/QR **sem rede**; **minimização de dados pessoais (LGPD)**: no dispositivo fica apenas o **nome** do motorista — documento, telefone e foto são exibidos apenas **online**, nunca no cache.
50. **Retenção do cache**: limpar ao **deslogar**, quando o **device é desativado** e após **30 dias sem sincronizar**.
51. Movimentos e solicitações criados offline ficam em **fila local** e sincronizam automaticamente quando há internet (mesmo mecanismo: `idempotency_key` + `sync_status`).
52. No sync, o servidor **revalida as regras** (ex.: bloqueio criado enquanto o app estava offline, prazo de 3 dias, vaga cheia); o servidor é a **fonte da verdade**.
53. O app é **apenas do porteiro** — cadastros sempre exigem internet (web/admin) → **sem conflito de cadastro**. Caso raríssimo de 2 solicitações para a mesma placa: a administração aceita uma e rejeita a outra (fluxo normal).
54. **Device compartilhado**: o tablet da portaria **não tem dono** — vários porteiros logam no mesmo `device`; quem executa cada ação é registrado em `doorman_id`/`requested_by`. O tablet pode ser vinculado a uma **portaria** (`device.entrance_id`), preenchendo `entrance_id` dos eventos automaticamente.

## 10. Fuso horário

55. Padrão **brasileiro**, definido por empresa (`company.timezone`, default `America/Sao_Paulo`). Os cortes de "dia x" no dashboard e relatórios usam o fuso da empresa.

## Referências

- [Modelagem — Controle de veículos e fluxo de acesso](../modelagem/modelagem-controle-veiculos.md)
- [Modelagem — Usuários, empresas e permissões](../modelagem/modelagem-usuarios-empresas-permissoes.md)
- [ADR 0001 — Migrations e seeds iniciais](../adr/0001-migrations-seeds-iniciais.md)
- [Regras de negócio — Usuários, empresas e permissões](./regras-negocio-usuarios-empresas-permissoes.md)
- Fonte consolidada: `planejamento/planejamento-geral.md` (Decisões de negócio resolvidas) e `planejamento/planejamento-frontend/planejamento-aplicativo-celular.md` (offline/sync)
