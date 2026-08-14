# Regras de negócio — Usuários, empresas e permissões

> Regras de negócio do **escopo de tenant, usuários e RBAC** do SOMAR, incluindo o **suporte operacional** (device, importação) e a **auditoria** (versão completa).
> Modelagem do banco deste escopo: [modelagem-usuarios-empresas-permissoes.md](../modelagem/modelagem-usuarios-empresas-permissoes.md).
> Decisões arquiteturais de referência: [ADR 0001 — Migrations e seeds iniciais](../adr/0001-migrations-seeds-iniciais.md), [ADR 0002 — A pessoa é a identidade e a empresa é um vínculo](../adr/0002-a-pessoa-e-a-identidade-e-a-empresa-e-um-vinculo.md) e [ADR 0003 — Endurecimento do login: rate limiting, contexto de sessão e eventos](../adr/0003-endurecimento-do-login-rate-limiting-contexto-e-eventos.md).
> Fonte consolidada: `planejamento/planejamento-geral.md` → "Decisões de negócio (resolvidas)".

## 1. Multi-tenant e identidade da pessoa

1. O sistema é **multi-tenant**: pode ser usado pela SOMAR, mas já escalável para outro órgão da prefeitura.
2. **A pessoa é a identidade; a empresa é o vínculo** (ADR 0002): `user` não tem `company_id`; a participação numa empresa é uma linha em `user_company`. Toda tabela tem `company_id` (exceto `permission` — catálogo global —, `user` — identidade da pessoa — e `audit_log`, que pode ter `company_id` NULL para ações globais).
3. Toda referência (`user_id`, `vehicle_id`, `role_id`, `department_id` etc.) deve pertencer ao **mesmo `company_id`** da linha — garantia em nível de **aplicação** (não expressável em SQL puro). Com o ADR 0002, a validação de usuário passa a ser via vínculo `user_company` (user_id, company_id) em vez de `user.company_id`.
4. `email` e `document` são **únicos globalmente** em `user` (a pessoa é única no sistema) — um mesmo e-mail/documento não pode existir em duas linhas.
5. **Fuso horário**: padrão **brasileiro**, definido por empresa (`company.timezone`, default `America/Sao_Paulo`). Os cortes de "dia x" no dashboard e relatórios usam o fuso da empresa.

## 2. Usuários e vínculos (`user_company`)

6. **Login** por **e-mail e senha** (da pessoa). A senha é armazenada como **hash (bcrypt)**, nunca texto puro.
7. **O mesmo usuário pode ter mais de uma companhia vinculada** (`user_company`, `UNIQUE (user_id, company_id)`).
8. O que muda por empresa mora no **vínculo**: `type` (`EMPLOYEE`/`VISITOR`) e `is_active`. **Desativar um usuário é ato da empresa sobre a participação** — uma pessoa sem nenhum vínculo ativo não entra em lugar nenhum.
9. Dados pessoais (`name`, `email`, `password`, `phone`, `document`, `observation`, `photo_url`) são **da pessoa**: editar em uma empresa reflete em todas.
10. Usuários criados via solicitação de acesso são do tipo **`VISITOR`** (no vínculo daquela empresa).
11. **LGPD** (decisões em aberto em `planejamento/pendencias.md`): política de **retenção** e **acesso** de foto/documento/telefone, consentimento de visitantes, quem visualiza a foto do condutor, descarte de solicitações `REJECTED` com dados pessoais e direito de exclusão/atualização.

## 3. Login e sessão multi-empresa

12. Se o usuário tem **uma** empresa vinculada → entra **direto** na sua companhia (sem seleção).
13. Se tem **mais de uma** empresa vinculada → o login devolve a lista de empresas e o usuário **seleciona qual companhia quer acessar**.
14. `companyId` é um campo **opcional no body do login** (mesma requisição da credencial). O JWT carrega `{ sub, companyId, email }` — a empresa da sessão viaja no token.
15. A **lista de empresas só é devolvida depois de a senha conferir** — nunca expor as empresas de um e-mail antes da autenticação.
16. **Respostas indistinguíveis**: senha errada, vínculo inativo e empresa sem vínculo devolvem o **mesmo** 401 (`'Credenciais inválidas.'`).
17. `GET /auth/companies` — lista os **vínculos ativos** da pessoa (com empresa ativa), alimentando o seletor do frontend.
18. `POST /auth/switch-company` — troca de empresa **sem repetir senha**, validando o vínculo na emissão e emitindo **token novo** com o novo `companyId`.
19. **Revalidação por requisição**: o guard revalida o vínculo pessoa+empresa a cada requisição — queda/desativação do vínculo derruba a sessão imediatamente.
20. **Rate limiting do login** (ADR 0003): `POST /auth/login` é limitado em **duas dimensões** — 20 tentativas/min por **IP** e 10/min por **e-mail** (força bruta distribuída); excesso devolve **429 genérico** (não revela a dimensão estourada).
21. **Contexto de sessão** (ADR 0003): o login captura `ipAddress` e `userAgent` (preenchidos pelo controller a partir do request) — base para auditoria e registro de sessão.
22. **`last_login_at`** (ADR 0003, migration `0008`): `user.last_login_at` é atualizado a cada login; **falha da atualização não bloqueia o login**.
23. **`GET /auth/validate`** (ADR 0003): valida a sessão atual (mesma revalidação por requisição) e devolve o ator — usado pelo frontend no boot.
24. **Eventos de sessão** (ADR 0003): o login emite `user.logged_in` e a troca de empresa emite `user.company_switched` (EventEmitter2); a emissão **não bloqueia** a resposta e a **persistência** fica na auditoria (`audit_log`, migration `0007`) — sem tabela `user_session`.

## 4. RBAC — cargos e permissões

25. `permission` é um **catálogo global** do sistema (sem `company_id`); o vínculo com a empresa ocorre via `role_permission`.
26. **Cargos (`role`)** são por empresa; cada cargo pode ser marcado como `is_admin` (acesso total à administração).
27. **Permissões são granulares** (`role_permission`): um cargo possui um conjunto de permissões; um usuário pode ter vários cargos (`user_role`).
28. **Escalabilidade não engessada**: a administração pode **mudar cargos, permissões e a visualização de seus usuários** — o mapeamento inicial é um ponto de partida, não um contrato rígido.
29. **Acesso por papel**: os papéis são **Porteiro**, **Segurança**, **Administração** e **Presidência** — cada um com permissões específicas.
30. No código, permissões são referenciadas pelo enum `PermissionCode` (nunca strings hardcoded), aplicadas via `JwtAuthGuard` + `PermissionsGuard`.
31. **Papéis nunca vazam entre empresas**: `user_role`/`role_permission` já são escopados por `company_id`; a resolução usa sempre `(user_id, companyId)`.

### Cargos seedados (empresa padrão SOMAR)

32. **Administração** (`is_admin = true`): todas as 23 permissões.
33. **Segurança**: tudo do porteiro + `MANAGE_BLOCKS`.
34. **Presidência**: `VIEW_DASHBOARDS`, `GRANT_FREE_PASS`, `MANAGE_BLOCKS`.
35. **Porteiro**: `REGISTER_ENTRY`, `REGISTER_EXIT`, `REGISTER_DENIAL`, `CREATE_ACCESS_REQUEST`, `CANCEL_ACCESS_REQUEST`, `CREATE_BLOCK_REQUEST`, `VIEW_DASHBOARDS`.

## 5. Device (app do porteiro)

36. O tablet da portaria é **compartilhado** (sem dono) — vários porteiros logam no mesmo `device`; quem executa cada ação é registrado em `doorman_id`/`requested_by`.
37. **Registro de device**: na 1ª execução o app se registra (`name`, `token` único, `platform`, `app_version`) — usado no sync e na auditoria.
38. O tablet pode ser vinculado a uma **portaria** (`device.entrance_id`), preenchendo `entrance_id` dos eventos automaticamente.
39. `last_sync_at` é usado no **pull incremental**; device **desativado** (`is_active = false`) limpa o cache do app.
40. **Offline**: cache local com **minimização de dados pessoais (LGPD)** — no dispositivo fica apenas o **nome** do motorista; documento, telefone e foto apenas **online**. Retenção do cache: limpar ao deslogar, ao desativar o device e após **30 dias sem sincronizar**.
41. **Sync**: fila local (outbox) com `idempotency_key`; o servidor **revalida as regras** de negócio de cada item e faz o pull incremental desde `last_sync_at`. O servidor é a **fonte da verdade**.

## 6. Importação de planilhas

42. A importação (Excel/xlsx) ocorre por **jobs** (`import_job`), com fila e status `PENDING`/`PROCESSING`/`DONE`/`FAILED`/`PARTIAL` (erros por linha em `errors`).
43. Tipos de importação: `VEHICLE`, `USER`, `USER_VEHICLE`.
44. **Pós-importação**: a aplicação **web** gera os QR codes dos veículos importados (**em lote**) e disponibiliza a impressão.
45. Importação é uma feature do MVP — cadastros em massa para facilitar a adoção inicial.

## 7. Auditoria (versão completa)

46. **Auditoria** (`audit_log`) é apenas da **versão completa** — sem auditoria mínima no MVP (a migração `0007` fica fora da leva inicial, sem impacto nas anteriores).
47. Registra ações (`CREATE`, `UPDATE`, `DELETE`, `LOGIN`, `EXPORT`, `IMPORT`, `PRINT_QRCODE`, ...) com ator (`USER`/`SYSTEM`/`API`), snapshot do papel, `entity_type`/`entity_id`, `request_id` (correlação), `context` (ip, user_agent, device) e `old_values`/`new_values`.
48. `created_at` é **imutável** (só INSERT; sem `updated_at`).

## 8. Fora do escopo do MVP

49. **Super admin** de múltiplas autarquias (gestão de autarquias) — versão completa.
50. **Integração com Gmail/Google** para avisos à administração e disparo de relatórios — versão completa.
51. **Recuperação de senha** multi-empresa (redefinição que vale para todos os vínculos do mesmo e-mail) — a decidir quando entrar no escopo.

## Referências

- [Modelagem — Usuários, empresas e permissões](../modelagem/modelagem-usuarios-empresas-permissoes.md)
- [Modelagem — Controle de veículos e fluxo de acesso](../modelagem/modelagem-controle-veiculos.md)
- [ADR 0001 — Migrations e seeds iniciais](../adr/0001-migrations-seeds-iniciais.md)
- [ADR 0002 — A pessoa é a identidade e a empresa é um vínculo](../adr/0002-a-pessoa-e-a-identidade-e-a-empresa-e-um-vinculo.md)
- [ADR 0003 — Endurecimento do login: rate limiting, contexto de sessão e eventos](../adr/0003-endurecimento-do-login-rate-limiting-contexto-e-eventos.md)
- [Regras de negócio — Controle de veículos e fluxo de acesso](./regras-negocio-controle-veiculos.md)
- Fonte consolidada: `planejamento/planejamento-geral.md` (Decisões de negócio resolvidas) e `planejamento/pendencias.md` (LGPD em aberto)
