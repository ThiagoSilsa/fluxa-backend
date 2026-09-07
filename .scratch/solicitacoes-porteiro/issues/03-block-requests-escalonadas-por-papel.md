# 03: Block-requests escalonadas por papel

**What to build:** A listagem e o detalhe de solicitações de bloqueio passam a respeitar o papel do ator: o gestor (`MANAGE_BLOCKS`) vê todas; o porteiro (`CREATE_BLOCK_REQUEST`) vê e abre apenas as próprias — e consegue cancelar as que criou.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] `GET /block-requests` retorna todas para quem tem `MANAGE_BLOCKS` e apenas `requestedBy = actor` para quem tem `CREATE_BLOCK_REQUEST` (sem parâmetro público de solicitante).
- [ ] `GET /block-requests/:id` segue o mesmo escalonamento (solicitante só abre a própria).
- [ ] `POST /block-requests/:id/cancel` continua validando propriedade e funciona para o porteiro.
- [ ] Ator sem `CREATE_*` nem `MANAGE_*` recebe 403.
- [ ] Comportamento do gestor permanece inalterado.
- [ ] Testes unit + integração cobrindo os dois papéis e o isolamento (ver spec §Testing).
