# ADR 0010 — Estratégia de implementação do fluxo de acesso

Número do ADR: 0010
Título: Estratégia de implementação do fluxo de acesso: ordem por dependências (bloqueio → solicitações → access core completo, sem TODOs), impedimento registrado automaticamente pelo endpoint de entrada, entrada temporária amarrada à solicitação autorizada e is_blocked mantido pela feature de bloqueio
Data: 2026-08-21
Responsável: Thiago

## Contexto

As tabelas do fluxo de acesso já existem (migrations `0003`/`0004` — [modelagem-controle-veiculos.md](../modelagem/modelagem-controle-veiculos.md)): `vehicle_access` (INSIDE/OUT/NO_EXIT/MANUAL_CLOSED, `forced_exit`, `over_capacity`, dados temporários), `vehicle_movement` (ledger imutável ENTRY/EXIT, `source`, `idempotency_key`, `sync_status`), `vehicle_block` (estado de bloqueio), `entry_denial` (ledger de impedimentos) e `block_request`. As regras de negócio do fluxo estão em [regras-negocio-controle-veiculos.md](../produto/regras-negocio-controle-veiculos.md): entrada/saída (§1), bloqueio vs. impedimento (§2), ocupação/vagas (§3) e solicitações (§6).

**Não existe** ainda nenhuma feature de acesso no backend. O cronograma previa o fluxo em etapas, mas a intenção (confirmada em 21/08) é que **a web tenha as mesmas funcionalidades do app**: registrar entrada, registrar saída, solicitar entrada com dados temporários, gestão de bloqueios — tudo consumindo a mesma API.

O problema central: o **access core (entrada/saída) é consumidor de quase tudo** — bloqueio (negar + motivo), impedimento (registrar quando negar), solicitação (veículo/motorista não cadastrados + dados temporários), ocupação (vaga cheia → `over_capacity`). Implementar o entry primeiro e "completar depois" geraria TODOs em cada ramo do fluxo. Em discussão em 21/08 ficou definida a **ordem por dependências**: construir primeiro o que o access core consome, e escrever o entry/saída **uma única vez, completo** (sem TODOs).

## Decisão

### 1. Ordem de implementação (dependências primeiro; access core por último)

| Marco  | Feature                           | Escopo                                                                                                                                                                                                             | Entrega                        |
| ------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| **M1** | Bloqueio e impedimento (`blocks`) | `vehicle_block` (admin bloqueia/revoga, motivo obrigatório; vínculo por placa ao cadastrar), `entry_denial` (ledger de impedimentos) e `block_request` (porteiro solicita; admin aprova/rejeita → cria o bloqueio) | Autocontida e testável sozinha |
| **M2** | Solicitações (`access-requests`)  | `access_request` (cenários NEW_USER/NEW_VEHICLE/LINK/BOTH, aceite/rejeição com resolução retroativa, vínculo `user_vehicle`, VISITOR, contato obrigatório, duplicidade por placa)                                  | Autocontida e testável sozinha |
| **M3** | **Access core** (`access`)        | entrada/saída/ocupação escritos **uma única vez, completos** — todos os ramos já implementados (ver §6)                                                                                                            | Zero TODOs de fluxo            |
| **M4** | Integrações finas                 | QR (`source = QRCODE`, resolve já existe), `entrance_id` do device, sync/offline (idempotência)                                                                                                                    | Camadas finas sobre o core     |
| **M5** | Web                               | telas espelhando o app (entrada, saída, solicitações, bloqueios, ocupação)                                                                                                                                         | Mesmos endpoints               |

Cada marco termina **testável** (unit + integração). A ordem evita o "efeito TODO": o entry não é implementado parcialmente e remendado depois — quando for escrito (M3), suas dependências (M1/M2) já existem.

### 2. `vehicle.is_blocked` é mantido pela feature de bloqueio (mesma transação)

O `is_blocked` do veículo é **derivado** (existe `vehicle_block` ACTIVE — ADR 0006 §4). A feature `blocks` (M1) é a **única** que escreve essa coluna: ao criar um bloqueio, seta `vehicle.is_blocked = true` na mesma transação; ao revogar, recalcula (`false` se não restar bloqueio ativo). Assim o access core (M3) **apenas lê** `vehicle.is_blocked` — sem join em `vehicle_block`, sem acoplamento e sem retrabalho.

### 3. Impedimento registrado automaticamente pelo endpoint de entrada

Ao **negar** a entrada (bloqueado, não autorizado, motorista sem `can_drive`), o `POST /access/entry` **registra o `entry_denial` automaticamente** (reason derivado: `BLOCKED`/`UNREGISTERED`/`UNAUTHORIZED_DRIVER`/`OTHER`, `doorman_id` = ator, vínculo com o `vehicle_block` que motivou, quando houver) e responde o motivo para o client exibir. O ledger de impedimentos fica **sempre consistente**, sem o client coordenar dois endpoints (regra 2 implementada por contrato).

### 4. Entrada temporária amarrada à solicitação autorizada

Entrada com dados temporários (veículo/motorista não cadastrados — `temporary_plate`/`temporary_driver_name`, `vehicle_id`/`driver_user_id` NULL) **só é aceita com uma `access_request` em `entry_authorized = true`** (aceite/liberação pela administração — M2). O `POST /access/entry` recebe `accessRequestId` e valida a autorização; sem solicitação autorizada → **nega** (regra 5). O vínculo `access_request_id` é gravado no `vehicle_access`. Isso mantém a regra "o porteiro decide liberar após criar a solicitação" sem permitir entrada temporária solta.

### 5. Idempotência e sync no core (sem retrabalho)

O access core grava desde já `idempotency_key` (uuid, NOT NULL) e `sync_status`: na web, o request pode enviar `idempotencyKey` (uuid, opcional — para retry/offline do app no futuro); **se ausente, o servidor gera** e grava `sync_status = SYNCED` (evento online). Quando o app offline existir (M4/fase 3), ele manda a chave e o sync revalida as regras — o schema e o core já estão prontos.

### 6. Access core (M3) — contrato de comportamento (todos os ramos)

- **Entrada** (`POST /access/entry`, `REGISTER_ENTRY`): busca por **placa normalizada** (ou QR no app); veículo **ativo**; **bloqueado** → nega + `entry_denial` (automático, §3); **não cadastrado** → exige solicitação autorizada (§4); `free_pass` → libera sem condutor; senão condutor (`can_drive`) ou temporário via solicitação; departamento opcional (pré-seleciona o padrão; vazio = vagas livres); **vaga cheia** → 409 exigindo `overCapacity = true` para liberar; **reentrada** (já INSIDE) → encerra o acesso anterior com `forced_exit = true` + gera `vehicle_movement` EXIT, depois registra a nova entrada (nunca 2 INSIDE).
- **Saída** (`POST /access/exit`, `REGISTER_EXIT`): por placa; encerra **todos** os INSIDE abertos (OUT); **conferência do condutor** via `GET /access/open?plate=` (devolve o INSIDE aberto com condutor); **NO_EXIT** (sem entrada) → cria `vehicle_access` NO_EXIT + `vehicle_movement` EXIT com dados do passageiro (ou sem, se `free_pass`).
- **Ocupação** (`GET /access/occupancy`, `VIEW_DASHBOARDS`): contagem de INSIDE por departamento + vagas livres em tempo real (a contagem já é necessária internamente para o `over_capacity`). Capacidade das vagas livres = **soma do `parkingSpace` dos departamentos ativos** (regra 24).
- `source` do movimento: **server-side** — web/placa → `PLATE`; QR → `QRCODE`; app → `APP`; admin manual → `MANUAL`; entrada inicial → `INITIAL` (futuro). `entrance_id`: **null na web** (preenchido do device quando vinculado — app).

### 7. Fora do escopo desta decisão (integrações futuras já planejadas)

Bloqueio **automático** por prazo de solicitação (3 dias / teto 7 dias — job, semana 3+), `occupancy_snapshot` (job diário), entrada inicial (`INITIAL`), sync/offline do app (push/pull, revalidação), auditoria (`audit_log`). O código marca `TODO: <Tarefa Futura>` apenas nessas integrações **realmente futuras** — nunca nos ramos do fluxo core (M1–M3 os cobre).

## Consequências

- O access core é escrito **uma vez e completo**: cada ramo (bloqueado, não cadastrado, free_pass, condutor, vaga cheia, reentrada, NO_EXIT) já nasce implementado porque suas dependências vieram antes (M1/M2).
- **Sem TODOs no fluxo principal**: a web e o app consomem a mesma API pronta desde o M3; as integrações finas (M4) são adições, não remendos.
- O ledger fica consistente: `entry_denial` é gravado junto com a negação; `vehicle_access`/`vehicle_movement` sempre em transação; idempotência pronta para o offline.
- Cada marco (M1–M5) é testável isoladamente, facilitando a revisão a cada entrega.
- `is_blocked` tem um dono único (feature de bloqueio) — evita dupla escrita e inconsistência.

## Alternativas consideradas

### 1. Access core primeiro (ordem do cronograma original)

Rejeitada: o entry dependeria de bloqueio/solicitação ainda inexistentes → TODOs em cada ramo (veículo bloqueado passa, não cadastrado não tem fluxo), exigindo retrabalho do use case no M3. A ordem por dependências evita o retrabalho.

### 2. Impedimento via endpoint separado (client coordena)

Rejeitada: exigiria o client chamar `POST /access/entry` (nega) e depois `POST /entry-denials` — risco de ledger inconsistente quando o segundo falha. O registro automático garante o ledger.

### 3. Entrada temporária livre (sem solicitação)

Rejeitada: contraria a regra 5 (não cadastrado → solicitação). Amarrar à solicitação autorizada mantém a regra e o rastro (`access_request_id`).
