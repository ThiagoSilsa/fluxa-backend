# 01: Endpoints de seleção para solicitantes

**What to build:** O porteiro (quem tem `CREATE_ACCESS_REQUEST` ou `CREATE_BLOCK_REQUEST`) consegue buscar veículos cadastrados da empresa por placa ou modelo e usuários ativos por nome ou e-mail, através de endpoints leves de seleção — sem precisar de permissões de gerenciamento de veículos/usuários. O frontend deixa de receber 403 e passa a popular os seletores de veículo e usuário.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] `GET /vehicles/options?search=&limit=&offset` retorna itens `{ id, plate, model }` da própria empresa, correspondendo a placa ou modelo (ILIKE normalizado), na forma `{ limit, offset, data, count }`.
- [ ] `GET /users/options?search=&limit=&offset` retorna usuários ativos da empresa `{ id, name, email }`, por nome ou e-mail, na mesma forma de lista.
- [ ] Ambos exigem `JwtAuthGuard` e a guarda composta `CREATE_ACCESS_REQUEST` **ou** `CREATE_BLOCK_REQUEST`; sem elas → 403.
- [ ] Não retornam dados de outras empresas (multi-tenant) e não expõem campos administrativos/`parameters`.
- [ ] Controllers documentados (Swagger) e seguindo DTOs de apresentação/aplicação + use cases.
- [ ] Testes unit + integração cobrindo os dois endpoints, os dois papéis e o isolamento por empresa (ver spec §Testing).
