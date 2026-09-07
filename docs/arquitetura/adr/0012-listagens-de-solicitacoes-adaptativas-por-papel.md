# ADR 0012 — Listagens de solicitações adaptativas por papel

Número do ADR: 0012
Título: GET /access-requests e GET /block-requests passam a ser escalonadas por papel — quem gerencia vê todas; quem apenas cria vê somente as próprias solicitações, com detalhe e cancelamento alcançáveis
Data: 2026-09-07
Responsável: Thiago

## Contexto

Hoje `GET /access-requests` e `GET /block-requests` são exclusivas de gestão (`MANAGE_ACCESS_REQUESTS` e `MANAGE_BLOCKS`, no nível de controller) e **não** aceitam filtro por solicitante. O porteiro cria solicitações de acesso (`CREATE_ACCESS_REQUEST`) e de bloqueio (`CREATE_BLOCK_REQUEST`), mas não tem como **listar, acompanhar ou cancelar** as próprias: os endpoints de cancelamento (`POST /:id/cancel`) existem e já validam a propriedade (`requestedBy === actor`), porém ficam **inalcançáveis** sem uma lista/detalhe que o porteiro possa abrir.

Regra de produto: o solicitante acompanha e cancela **as próprias** solicitações; o gestor vê e decide sobre **todas**.

## Decisão

### 1. Escalonamento automático por papel (sem parâmetro público)

O filtro é aplicado no **servidor** a partir do JWT (`actor.id`); nenhum query param novo de solicitante é exposto — um cliente não consegue pedir solicitações de terceiros.

- `GET /access-requests`: ator com `MANAGE_ACCESS_REQUESTS` → **todas**; ator com `CREATE_ACCESS_REQUEST` → apenas `requestedBy = actor`.
- `GET /block-requests`: ator com `MANAGE_BLOCKS` → **todas**; ator com `CREATE_BLOCK_REQUEST` → apenas `requestedBy = actor`.

### 2. Detalhe também escalonado

- `GET /access-requests/:id` e `GET /block-requests/:id`: gestor vê qualquer; solicitante vê apenas a própria (as demais respondem como não encontradas). Necessário para a UI de "minhas solicitações" abrir o registro e cancelar.

### 3. Cancelamento deixa de ser inalcançável

`POST /access-requests/:id/cancel` e `POST /block-requests/:id/cancel` já validam a propriedade no backend e permanecem como estão — agora alcançáveis pelo porteiro via lista/detalhe próprios.

### 4. UI (frontend)

A página de solicitações ganha, para o porteiro, a visão **"Minhas solicitações"** abrangendo solicitações de **acesso e de bloqueio**, com ação de cancelar; o gestor mantém a visão atual (todas + decisões).

## Consequências

- O porteiro passa a acompanhar e cancelar as próprias solicitações (acesso e bloqueio), fechando o ciclo iniciado ao criá-las.
- Segurança preservada: o escopo "só as minhas" é decidido no servidor pelo papel, sem confiar no cliente e sem enumerar registros de terceiros.
- Comportamento do gestor inalterado; mudança é aditiva ao contrato atual (mesmas rotas, respostas ampliadas para o papel de solicitante).
- Exige testes de integração cobrindo os dois papéis em cada lista.

## Alternativas consideradas

- **Parâmetro público `requesterId`/`mine`**: rejeitado — confiaria no cliente para escopar, permitindo tentar listar solicitações de terceiros (enumerar/`requesterId` de outro), além de exigir checagem extra por papel em cada chamada.
- **Rota dedicada `GET /my-requests`**: rejeitada — duplicaria o código de listagem/filtros e a superfície de API; escalonar as mesmas rotas existentes por papel é mais simples e consistente.
