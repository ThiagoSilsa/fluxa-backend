# ADR 0011 — Endpoints de seleção de baixo privilégio para solicitantes

Número do ADR: 0011
Título: Novos endpoints leves de seleção (veículos por placa/modelo e usuários por nome/e-mail) acessíveis ao porteiro — solicitantes de acesso e de bloqueio — sem exigir permissões de gerenciamento (MANAGE_VEHICLES/MANAGE_USERS)
Data: 2026-09-07
Responsável: Thiago

## Contexto

As telas de solicitação (frontend) precisam que o **porteiro** pesquise veículos cadastrados (por placa ou modelo) e usuários (por nome ou e-mail) para montar os cenários NEW_USER / NEW_VEHICLE / LINK das solicitações de acesso, além da busca usada nas solicitações de bloqueio.

Hoje a busca é feita com `GET /vehicles?search=` e `GET /users?search=`, ambos protegidos no nível de controller por `MANAGE_VEHICLES` e `MANAGE_USERS`. Um porteiro que detém apenas `CREATE_ACCESS_REQUEST`/`CREATE_BLOCK_REQUEST` recebe **403** — por isso as buscas "não funcionam" para ele. Além disso, essas listagens expõem as entidades completas (todos os campos) e os `parameters` de filtro — muito mais do que um seletor precisa.

O padrão existente `GET /vehicles/driver-candidates` (ativos como `{id, name}`, `MANAGE_VEHICLES`) atende apenas a gestão de veículos (escolha de condutor na tela do veículo), não o porteiro nem a seleção de veículos.

## Decisão

### 1. Dois endpoints leves de seleção

- **`GET /vehicles/options?search=<term>&limit=&offset=`** — escopo pela company do JWT (multi-tenant); busca normalizada correspondendo a **placa OU modelo** (ILIKE, mesmo comportamento atual do seletor); resposta mínima por item `{ id, plate, model }` na forma de lista padrão `{ limit, offset, data, count }`, **sem** `parameters` e sem campos administrativos/sensíveis.
- **`GET /users/options?search=<term>&limit=&offset=`** — usuários **ativos** da company; busca por **nome OU e-mail** (ILIKE); resposta mínima por item `{ id, name, email }` na forma padrão `{ limit, offset, data, count }`.

### 2. Guarda por papel de solicitante

Ambos os endpoints ficam atrás de `JwtAuthGuard` e de uma **guarda composta reutilizável**: o ator precisa ter `CREATE_ACCESS_REQUEST` **ou** `CREATE_BLOCK_REQUEST` (não exige `MANAGE_VEHICLES`/`MANAGE_USERS`). Isso cobre exatamente o perfil do porteiro que cria solicitações, sem abrir leitura geral de veículos/usuários.

### 3. Por que não liberar `GET /vehicles` e `GET /users` ao porteiro

As listagens gerais devolvem as entidades completas e os `parameters` de filtro (pensadas para telas de gestão com `MANAGE_*`). Liberá-las ampliaria a superfície de dados muito além da seleção e misturaria o contrato de gestão com o de seleção. Endpoints dedicados e enxutos mantêm o princípio do menor privilégio e uma semântica de filtro clara.

### 4. Consumo pelo frontend

O frontend troca as chamadas atuais dos seletores (hoje `GET /vehicles?search=`/`GET /users?search=` nos pickers da feature de solicitações) por esses endpoints, mantendo o comportamento esperado: veículo buscado por placa ou modelo (mostrando modelo como detalhe) e usuário por nome/e-mail (mostrando e-mail para desambiguar). Os pickers passam a ser componentes compartilhados (sem importação entre features).

## Consequências

- O porteiro pesquisa veículos e usuários para criar solicitações **sem** permissões de gerenciamento.
- Superfície de dados exposta na seleção é mínima (`id`, `plate`, `model` / `id`, `name`, `email`), escopada pela company.
- Dois endpoints pequenos novos, seguindo a forma de lista padrão já usada no projeto.
- `GET /vehicles/driver-candidates` permanece para a gestão de veículos; a convivência é aceitável — uma eventual consolidação futura deve ser avaliada separadamente.

## Alternativas consideradas

- **Liberar `GET /vehicles` e `GET /users` para quem tem `CREATE_*`**: rejeitada — expõe entidades completas e `parameters` de gestão a um perfil que só cria solicitações.
- **Reutilizar `GET /vehicles/driver-candidates` para usuários**: rejeitada — retorna apenas ativos com `{id, name}` (sem e-mail para desambiguar) e é protegido por `MANAGE_VEHICLES`, mantendo o mesmo problema de permissão para o porteiro.
