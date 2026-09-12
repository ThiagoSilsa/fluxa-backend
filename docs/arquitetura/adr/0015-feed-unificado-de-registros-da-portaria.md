# ADR 0015 — Registros da portaria em um feed unificado (movimentos + impedimentos)

Número do ADR: 0015
Título: Registros da portaria em um feed unificado (movimentos + impedimentos)
Data: 2026-09-12
Responsável: Thiago

## Contexto

A portaria produz três coisas observáveis: **entradas**, **saídas** e **impedimentos**. Entradas e saídas vivem em `vehicle_movement` (`type` ENTRY/EXIT — ledger imutável, com `source`, `entrance_id`, `doorman_id`, `plate_snapshot`, `occurred_at`); impedimentos vivem em `entry_denial` (`reason`, `observation`, `block_id`, `entrance_id`, `doorman_id`, `occurred_at`). São tabelas separadas, com ciclos de vida diferentes (estado de acesso × auditoria de negativa).

Nenhuma das duas tem **leitura**: o `EntryDenialRepository` só implementa `create` e não existe `GET` de movimentos em lugar nenhum. A tela da portaria hoje não mostra histórico — o porteiro acabou de registrar uma entrada e ela simplesmente desaparece.

A tela precisa de **uma** linha do tempo, mais recente primeiro, e o porteiro opera em vários dispositivos simultâneos (regra 61, tablet compartilhado sem dono), então a lista é fonte de verdade operacional: ele precisa ver o registro que outro porteiro acabou de fazer.

## Decisão

Novo endpoint **`GET /access/records`** (`REGISTER_ENTRY` | `REGISTER_EXIT` | `REGISTER_DENIAL`), que devolve a **união** dos dois ledgers ordenada por `occurred_at DESC`, no envelope padrão `{ limit, offset, data, count, parameters }`.

- **Sem tabela nova.** A união é feita na leitura (`UNION ALL` sobre os dois ledgers), preservando cada um como fonte única do seu fato. Uma tabela "records" duplicaria o ledger e criaria o problema clássico de reconciliação.
- **Item achatado** (sem `type` discriminado polimórfico), com as denormalizações resolvidas na própria query: `{ id, kind: ENTRY|EXIT|DENIAL, plate, driverName, vehicleModel, departmentName, entranceName, doormanName, reason, observation, occurredAt, accessId }`.
- **Filtros**: `kind?`, `plate?` (parcial, normalizada), `dateFrom?`, `dateTo?`, `entranceId?`, `doormanId?`, `limit` (1..100, default 20), `offset`. **Sem janela de tempo padrão** — a portaria abre a tela e vê o movimento recente, com filtros como refinamento.
- **`parameters.entrances`** (id + nome das portarias ativas) para alimentar o filtro de portaria sem exigir `MANAGE_ENTRANCES` do porteiro.
- **Sem endpoint de detalhe.** O impedimento carrega a observação no próprio item; a linha expande. Um `GET /access/records/:id` obrigaria uma segunda chamada para o caso mais comum (só ler o motivo).
- **Atualização**: o cliente refaz a busca após cada registro e faz polling curto (a lista é operacional, não um relatório).

## Consequências

- O porteiro passa a ter o estado da portaria na tela — inclusive de outros dispositivos — e o impedimento deixa de ser um beco sem saída (hoje o frontend nem conhece o ledger: o denial só aparece como resultado automático de uma negativa).
- A query é um `UNION ALL` com joins de nomes (veículo, departamento, portaria, porteiro); o `count` exige um `SELECT` envolvendo a união. Custo aceitável para o volume da portaria (dezenas de linhas por dia por empresa), e o índice por `(company_id, occurred_at DESC)` em cada ledger sustenta a ordenação.
- Fica registrado que **não** existem endpoints de relatório/agregação sobre esses ledgers — dashboards futuros devem nascer de queries próprias, não deste feed.

## Alternativas consideradas

- **Duas listas / duas abas** (movimentos e impedimentos separados): rejeitada — o porteiro teria de cruzar mentalmente duas linhas do tempo para responder "o que aconteceu aqui?", que é exatamente o problema atual.
- **Tabela `access_record` alimentada por evento**: rejeitada — duplica o ledger, exige backfill e reconciliação, e viola o princípio de ledger imutável (`vehicle_movement` já é o registro imutável).
- **Endpoint por ledger** (`GET /access/movements` + `GET /entry-denials`): rejeitada — duas chamadas, duas paginações e merge no cliente, sem ganho (ninguém consulta impedimento isoladamente na portaria).
- **Exigir `VIEW_DASHBOARDS`** para o feed: rejeitada — o porteiro precisa da própria lista operacional e não tem essa permissão; o feed é operação, não dashboard.
