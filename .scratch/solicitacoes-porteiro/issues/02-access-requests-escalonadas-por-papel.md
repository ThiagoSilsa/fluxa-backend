# 02: Access-requests escalonadas por papel

**What to build:** A listagem e o detalhe de solicitações de acesso passam a respeitar o papel do ator: o gestor (`MANAGE_ACCESS_REQUESTS`) vê todas; o porteiro (`CREATE_ACCESS_REQUEST`) vê e abre apenas as próprias — e consegue cancelar as que criou.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] `GET /access-requests` retorna todas para quem tem `MANAGE_ACCESS_REQUESTS` e apenas `requestedBy = actor` para quem tem `CREATE_ACCESS_REQUEST` (sem parâmetro público de solicitante).
- [ ] `GET /access-requests/:id` segue o mesmo escalonamento (solicitante só abre a própria).
- [ ] `POST /access-requests/:id/cancel` continua validando propriedade e funciona para o porteiro.
- [ ] Ator sem `CREATE_*` nem `MANAGE_*` recebe 403.
- [ ] Comportamento do gestor permanece inalterado.
- [ ] Testes unit + integração cobrindo os dois papéis e o isolamento (ver spec §Testing).
