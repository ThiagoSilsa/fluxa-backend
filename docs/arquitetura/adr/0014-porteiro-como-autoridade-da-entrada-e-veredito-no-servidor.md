# ADR 0014 — O porteiro é a autoridade da entrada; o sistema decide por ele (contexto + veredito no servidor)

Número do ADR: 0014
Título: O porteiro é a autoridade da entrada; o sistema decide por ele (contexto + veredito no servidor)
Data: 2026-09-12
Responsável: Thiago
Status: accepted (substitui o ADR 0010 §4)

## Contexto

O [ADR 0010](./0010-estrategia-de-implementacao-do-fluxo-de-acesso.md) §4 amarrou a entrada temporária a `access_request.entry_authorized = true` — ou seja, **só a administração libera** uma entrada que fuja do cadastro. Na prática o porteiro **não consegue liberar nada**: motorista sem vínculo, `can_drive = false`, veículo não cadastrado ou solicitação ainda `PENDING` terminam todos em negativa (`UNAUTHORIZED_DRIVER`, `UNREGISTERED`, 400). Isso contradiz a **regra 41**, que para o cenário `LINK` diz literalmente que "o porteiro **libera a entrada na hora** e a admin só formaliza o vínculo".

O segundo problema é de informação. A portaria só dispõe de `GET /vehicles/options` → `{ id, plate, model }`. O porteiro **não** sabe, antes de tentar, se o veículo está bloqueado, se é passe livre, quem pode dirigir, se existe solicitação para aquela placa, se o prazo venceu ou se há vaga no departamento. Ele descobre por tentativa e erro (409 de vaga cheia, denial de bloqueio, 400 de condutor). Enquanto isso, a resposta de `GET /qr-codes/:code` **já entrega** o agregado completo da entrada (`VehicleResponse` com `isBlocked`/`freePass`/`isActive`/tipo + departamento padrão + motoristas com `canDrive`) — mas só via QR, e o frontend a usa apenas para preencher a placa.

A consequência de UX é a árvore de decisão que hoje está na cabeça do porteiro (tipo de registro → cadastrado? → passe livre? → motorista? → vinculado? → solicitação? → status? → prazo? → permite?). Cada nível é uma pergunta cuja resposta o sistema **já tem**.

## Decisão

### 1. O porteiro decide a entrada; a administração formaliza o cadastro

A `access_request` **documenta a exceção**, não autoriza a entrada. O porteiro pode registrar entrada com uma solicitação da mesma placa em `PENDING`, `IN_CONTACT` ou `REGISTERED`. `entry_authorized` **deixa de ser pré-requisito** e passa a significar **pré-autorização opcional da administração** (ex.: visitante anunciado), com um único efeito: **sobrepõe** a negativa por prazo (regras 38/39).

### 2. Contexto + veredito no servidor

Novo endpoint de leitura **`GET /access/context?plate=&search=&departmentId=`** (`REGISTER_ENTRY` | `REGISTER_EXIT` | `REGISTER_DENIAL`) que promove o agregado do QR a lookup por placa e devolve, em **uma** resposta:

- **veículo**: cadastrado (`null` quando não), placa, modelo, cor, tipo, `freePass`, `isActive`, `isBlocked` + bloqueio ativo (`reason`, `blockType`, `blockedAt`);
- **departamento**: o selecionado, o padrão do veículo, `capacity`, `occupied` e `hasFreeSlot`;
- **motoristas**: vinculados (até 3, primário primeiro) e **sugestões** não vinculadas (até 3) quando `search` é informado — cada item com `linked` e `canDrive`;
- **solicitações da placa**: as últimas (qualquer status) com `status`, `type`, `requestedAt`, `daysOverdue`, `deadline`, `entryAuthorized` e o nome do motorista do `payload`;
- **acessos abertos**: os `INSIDE` da placa (para reentrada e para a conferência de saída);
- **veredito**: um único valor + motivos.

O frontend **não** recalcula nenhuma regra: ele exibe o veredito e coleta o que falta (departamento, motorista, dados do novo motorista).

### 3. Precedência do veredito

| Veredito               | Quando                                                                                                               |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `DENY_BLOCKED`         | existe `vehicle_block` ACTIVE (por veículo ou por placa) — **prevalece sobre tudo**, inclusive `freePass` (regra 20) |
| `DENY_INACTIVE`        | veículo cadastrado e `isActive = false`                                                                              |
| `ALLOW_FORCED_REENTRY` | já existe `vehicle_access` `INSIDE` da placa (regra 9 — a saída anterior é encerrada com `forced_exit`)              |
| `ALLOW`                | `freePass = true` (regra 3), ou há motorista vinculado com `canDrive = true` selecionado                             |
| `DENY_OVERDUE`         | solicitação aberta da placa vencida (regra 38/39) e **sem** pré-autorização                                          |
| `ALLOW_WITH_REQUEST`   | exceção de cadastro/vínculo: cria-se (ou reaproveita-se) a solicitação e libera                                      |
| `ALLOW_OVER_CAPACITY`  | vaga cheia no departamento escolhido (regra 6/25) — exige `overCapacity = true`                                      |

Só `ALLOW_OVER_CAPACITY` e `ALLOW_FORCED_REENTRY` pedem **uma** confirmação extra; os demais têm ação única.

**Precedência** (implementada em `GET /access/context`): `DENY_BLOCKED` > `DENY_INACTIVE` > `DENY_OVERDUE` > `ALLOW_WITH_REQUEST` > `ALLOW_OVER_CAPACITY` > `ALLOW_FORCED_REENTRY` > `ALLOW`. Os requisitos que podem coexistir (`requiresRequest`, `reusableRequestId`, `requiresOverCapacity`, `isReentry`) são expostos **separadamente** no payload: em caso combinado o veredito é o da interação principal da ficha (a exceção, que envolve sub-formulário) e o cliente confirma os demais **antes** de enviar — evitando descobrir a vaga cheia por 409.

### 4. Prazo avaliado na leitura, sem job

`isOverdue` / `daysOverdue` / `deadline` são **derivados** de `requested_at` + `status` (`PENDING` > 3 dias; `IN_CONTACT` até 7 dias). O **bloqueio automático** em estado (`vehicle_block` `block_type = AUTOMATIC`) e a revogação automática continuam sendo tarefa futura (job/worker) — o veredito já entrega o comportamento correto sem alterar estado.

### 5. Liberar com exceção é **uma** operação

`POST /access/entry` ganha o bloco **opcional** `request { type, userType?, payload?, contactPhone?, departmentId? }`: a solicitação é criada **na mesma operação** e o `access_request_id` gravado no `vehicle_access`. Sem isso, um 409 de vaga cheia deixaria solicitação órfã e o retry bateria no "já existe solicitação aberta para esta placa". O contrato é **aditivo** (o app continua funcionando sem o bloco) e `accessRequestId` passa a ser aceito também para solicitações abertas, validando **`request.plate === plate`** (fecha o buraco atual, que aceita qualquer `accessRequestId` da empresa).

A garantia de "nada fica pela metade" é obtida por **ordem de escrita + reversão**, não por uma transação de banco única: todas as validações (inclusive a capacidade, que responde 409) acontecem **antes** da criação da solicitação; se a escrita da entrada falhar depois disso, a solicitação recém-criada é marcada `CANCELLED` (com observação automática), o que libera o unique parcial da placa para nova tentativa. Uma transação única exigiria propagar o `EntityManager` pelos repositórios de duas features (cada `createEntry` abre a própria transação) — complexidade desproporcional para um caso que só ocorre em erro de banco/concorrência.

### 6. Impedimento é evento, bloqueio é estado

Registrar impedimento grava `entry_denial` (com `reason` da lista fechada, veículo resolvido pela placa, portaria e `doorman_id`); **opcionalmente** — desmarcado por padrão — o mesmo fluxo cria um `block_request`. O porteiro **nunca** cria `vehicle_block` (regra 51-53).

## Consequências

- A tela da portaria deixa de ser dois formulários e passa a ser **um campo de placa + uma ficha com uma ação**; a política vive no servidor.
- `entry_authorized` fica semanticamente restrito a "pré-autorização da administração" (sobrepõe o prazo) — nenhum cliente precisa mais informá-lo para entrar.
- `GET /qr-codes/:code` e `GET /access/context` compartilham o mesmo agregado de ficha; o QR vira um **atalho de preenchimento de placa**, não um caminho paralelo.
- Passa a existir negativa por prazo (`entry_denial.reason = OVERDUE` — novo valor de enum, migração).
- O `POST /access/entry` cresce (bloco `request`), mas permanece retrocompatível; o app do porteiro (offline) não é afetado.
- A regra 41 passa a valer como está escrita, e as regras 45/48 precisam perder o texto do ADR 0010 §4.

## Alternativas consideradas

- **Manter o ADR 0010 §4 (admin autoriza a entrada)**: rejeitada — na prática o porteiro fica sem saída para o caso mais comum da portaria (motorista conhecido sem vínculo) e contradiz a regra 41.
- **Resolver o veredito no cliente** (N chamadas + regras no React): rejeitada — duplicaria a política (prazo 3/7 dias, precedência de bloqueio, `canDrive`) em duas linguagens, exigiria que o porteiro tivesse `MANAGE_VEHICLES`/`MANAGE_USERS` para ler motoristas e violaria a regra do `AGENTS.md` de não colocar regra de negócio em componente visual.
- **Criar `POST /access/entries-with-request`** em vez de estender `POST /access/entry`: rejeitada — é a **mesma** operação de negócio; um endpoint novo obrigaria web e app a escolher entre dois caminhos e duplicaria a validação de placa/portaria/capacidade.
- **Exigir a solicitação criada antes da entrada** (duas chamadas do cliente): rejeitada — sem atomicidade, uma falha na entrada deixa solicitação órfã e o retry é bloqueado pelo unique parcial de placa aberta.
