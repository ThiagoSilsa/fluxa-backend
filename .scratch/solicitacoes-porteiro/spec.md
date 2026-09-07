# Spec — Solicitações do porteiro (backend)

Status: ready-for-agent

## Problem Statement

O porteiro, ao criar solicitações de acesso (novo motorista / novo veículo / vincular) e de bloqueio, precisa buscar **veículos** e **usuários** da empresa — mas os endpoints de busca exigem permissões de gerenciamento (`MANAGE_VEHICLES`/`MANAGE_USERS`) que ele não tem, então as buscas falham (403) e a UI não consegue preencher os seletores.

Além disso, o porteiro **cria** solicitações de acesso e de bloqueio, porém as listagens são exclusivas de gestão e não aceitam filtro por solicitante: ele não consegue **ver, acompanhar nem cancelar** as próprias solicitações (o cancelamento existe e valida propriedade, mas fica inalcançável).

## Solution

1. Dois endpoints leves de **seleção** acessíveis ao porteiro, escopados pela empresa e com dados mínimos.
2. Listagens e detalhe de `access-requests` e `block-requests` **escalonadas por papel**: quem gerencia vê todas; quem apenas cria (`CREATE_*`) vê somente as próprias. O cancelamento passa a ser alcançável.

## User Stories

1. Como porteiro, quero buscar veículos cadastrados da empresa por placa ou modelo, para criar solicitações sem depender de permissão de gestão.
2. Como porteiro, quero buscar usuários ativos da empresa por nome ou e-mail, para identificar corretamente o envolvido na solicitação.
3. Como porteiro, quero ver apenas as minhas solicitações de acesso, para acompanhar o status sem ver as dos outros.
4. Como porteiro, quero ver apenas as minhas solicitações de bloqueio, para acompanhar o que pedi.
5. Como gestor, quero continuar vendo e decidindo sobre todas as solicitações de acesso e de bloqueio.
6. Como porteiro, quero abrir o detalhe de uma solicitação minha e cancelá-la quando criei por engano.
7. Como usuário sem permissão alguma de solicitação/gestão, não quero acessar nenhuma dessas buscas nem listagens.

## Implementation Decisions

- **`GET /vehicles/options?search=&limit=&offset`**: busca normalizada por **placa OU modelo** (ILIKE), escopo pela company do JWT; item `{ id, plate, model }`; resposta na forma de lista padrão `{ limit, offset, data, count }`, sem `parameters`.
- **`GET /users/options?search=&limit=&offset`**: usuários **ativos** da company, busca por **nome OU e-mail** (ILIKE); item `{ id, name, email }`; forma de lista padrão.
- **Guarda composta reutilizável**: acesso aos endpoints de seleção para quem tem `CREATE_ACCESS_REQUEST` **ou** `CREATE_BLOCK_REQUEST`; nunca exige `MANAGE_VEHICLES`/`MANAGE_USERS`.
- **Listagens escalonadas por papel (sem parâmetro público)**: `GET /access-requests` e `GET /block-requests` — ator com a permissão de gestão correspondente vê todas; ator com a permissão de criação vê apenas `requestedBy = actor.id`. O filtro é decidido no servidor pelo JWT.
- **Detalhe escalonado**: `GET /access-requests/:id` e `GET /block-requests/:id` — gestor vê qualquer; solicitante vê apenas a própria.
- **Cancelamento**: `POST /access-requests/:id/cancel` e `POST /block-requests/:id/cancel` permanecem validando propriedade; nenhuma mudança de regra.
- Seguir as convenções do repo: controllers → use cases → DTOs de apresentação/aplicação; um controller por arquivo; Swagger nos controllers; listas no formato `{ limit, offset, data, count }`; multi-tenant por `company_id`.
- Sem mudança nos tipos/cenários de `access-request` nem no enum de bloqueio.

## Testing Decisions

- Testar **comportamento externo** (HTTP), não detalhes de implementação.
- Perfil **porteiro** (`CREATE_*`): busca de veículos/usuários retorna 200 só da própria empresa; listagens/detalhe retornam apenas as próprias; cancelar a própria funciona.
- Perfil **gestor** (`MANAGE_*`): vê todas; detalhe de qualquer uma.
- Sem permissão (`CREATE_*` nem `MANAGE_*`): 403 nas buscas e listagens.
- Isolamento multi-tenant: dados de outra empresa nunca retornam.
- Normalização de placa e busca placa/modelo e nome/e-mail.
- Prior art: testes de integração por feature (supertest + contexto compartilhado, conforme `AGENTS.md` §5) e unit com mocks de repositório via Symbol tokens.

## Out of Scope

- Não alterar tipos/cenários de `access-request` nem o enum de bloqueio.
- Não unificar num único feed as solicitações de acesso e de bloqueio no backend (fica a cargo da UI).
- Não liberar `GET /vehicles`/`GET /users` (gestão) para o porteiro.
- Não adicionar expiração/bloqueio automático.

## Further Notes

- Registrado nos ADRs 0011 e 0012 (`fluxa-backend/docs/arquitetura/adr/`).
- Consumido pelos tickets 08/09/10 da spec de frontend (`ajustes-de-paginas`).
