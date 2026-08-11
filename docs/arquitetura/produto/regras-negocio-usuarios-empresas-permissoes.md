# Regras de negócio — Usuários, empresas e permissões

> Regras de negócio do **escopo de tenant, usuários e RBAC** do SOMAR, incluindo o **suporte operacional** (device, importação) e a **auditoria** (versão completa).
> Modelagem do banco deste escopo: [modelagem-usuarios-empresas-permissoes.md](../modelagem/modelagem-usuarios-empresas-permissoes.md).
> Decisão arquitetural de referência: [ADR 0001 — Migrations e seeds iniciais](../adr/0001-migrations-seeds-iniciais.md).
> Fonte consolidada: `planejamento/planejamento-geral.md` → "Decisões de negócio (resolvidas)".

## 1. Multi-tenant

1. O sistema é **multi-tenant**: pode ser usado pela SOMAR, mas já escalável para outro órgão da prefeitura.
2. Toda tabela tem `company_id` (exceto `permission` — catálogo global — e `audit_log`, que pode ter `company_id` NULL para ações globais).
3. Toda referência (`user_id`, `vehicle_id`, `role_id`, `department_id` etc.) deve pertencer ao **mesmo `company_id`** da linha — garantia em nível de **aplicação** (não expressável em SQL puro).
4. **Fuso horário**: padrão **brasileiro**, definido por empresa (`company.timezone`, default `America/Sao_Paulo`). Os cortes de "dia x" no dashboard e relatórios usam o fuso da empresa.

## 2. Usuários

5. **Login** por **e-mail e senha** (usuário da empresa). A senha é armazenada como **hash (bcrypt)**, nunca texto puro.
6. `email` e `document` são únicos **por empresa** (unique composto com `company_id`) — o mesmo email pode existir em empresas diferentes (base para identidade entre tenants no futuro).
7. Tipos de usuário: `EMPLOYEE` (funcionário) e `VISITOR` (visitante). Usuários criados via solicitação de acesso são do tipo **`VISITOR`**.
8. `is_active`: usuário desativado deixa de operar no sistema.
9. **LGPD** (decisões em aberto em `planejamento/pendencias.md`): política de **retenção** e **acesso** de foto/documento/telefone, consentimento de visitantes, quem visualiza a foto do condutor, descarte de solicitações `REJECTED` com dados pessoais e direito de exclusão/atualização.

## 3. RBAC — cargos e permissões

10. `permission` é um **catálogo global** do sistema (sem `company_id`); o vínculo com a empresa ocorre via `role_permission`.
11. **Cargos (`role`)** são por empresa; cada cargo pode ser marcado como `is_admin` (acesso total à administração).
12. **Permissões são granulares** (`role_permission`): um cargo possui um conjunto de permissões; um usuário pode ter vários cargos (`user_role`).
13. **Escalabilidade não engessada**: a administração pode **mudar cargos, permissões e a visualização de seus usuários** — o mapeamento inicial é um ponto de partida, não um contrato rígido.
14. **Acesso por papel**: os papéis são **Porteiro**, **Segurança**, **Administração** e **Presidência** — cada um com permissões específicas.
15. No código, permissões são referenciadas pelo enum `PermissionCode` (nunca strings hardcoded), aplicadas via `JwtAuthGuard` + `PermissionsGuard`.

### Cargos seedados (empresa padrão SOMAR)

16. **Administração** (`is_admin = true`): todas as 23 permissões.
17. **Segurança**: tudo do porteiro + `MANAGE_BLOCKS`.
18. **Presidência**: `VIEW_DASHBOARDS`, `GRANT_FREE_PASS`, `MANAGE_BLOCKS`.
19. **Porteiro**: `REGISTER_ENTRY`, `REGISTER_EXIT`, `REGISTER_DENIAL`, `CREATE_ACCESS_REQUEST`, `CANCEL_ACCESS_REQUEST`, `CREATE_BLOCK_REQUEST`, `VIEW_DASHBOARDS`.

## 4. Device (app do porteiro)

20. O tablet da portaria é **compartilhado** (sem dono) — vários porteiros logam no mesmo `device`; quem executa cada ação é registrado em `doorman_id`/`requested_by`.
21. **Registro de device**: na 1ª execução o app se registra (`name`, `token` único, `platform`, `app_version`) — usado no sync e na auditoria.
22. O tablet pode ser vinculado a uma **portaria** (`device.entrance_id`), preenchendo `entrance_id` dos eventos automaticamente.
23. `last_sync_at` é usado no **pull incremental**; device **desativado** (`is_active = false`) limpa o cache do app.
24. **Offline**: cache local com **minimização de dados pessoais (LGPD)** — no dispositivo fica apenas o **nome** do motorista; documento, telefone e foto apenas **online**. Retenção do cache: limpar ao deslogar, ao desativar o device e após **30 dias sem sincronizar**.
25. **Sync**: fila local (outbox) com `idempotency_key`; o servidor **revalida as regras** de negócio de cada item e faz o pull incremental desde `last_sync_at`. O servidor é a **fonte da verdade**.

## 5. Importação de planilhas

26. A importação (Excel/xlsx) ocorre por **jobs** (`import_job`), com fila e status `PENDING`/`PROCESSING`/`DONE`/`FAILED`/`PARTIAL` (erros por linha em `errors`).
27. Tipos de importação: `VEHICLE`, `USER`, `USER_VEHICLE`.
28. **Pós-importação**: a aplicação **web** gera os QR codes dos veículos importados (**em lote**) e disponibiliza a impressão.
29. Importação é uma feature do MVP — cadastros em massa para facilitar a adoção inicial.

## 6. Auditoria (versão completa)

30. **Auditoria** (`audit_log`) é apenas da **versão completa** — sem auditoria mínima no MVP (a migração `0006` fica fora da leva inicial, sem impacto nas anteriores).
31. Registra ações (`CREATE`, `UPDATE`, `DELETE`, `LOGIN`, `EXPORT`, `IMPORT`, `PRINT_QRCODE`, ...) com ator (`USER`/`SYSTEM`/`API`), snapshot do papel, `entity_type`/`entity_id`, `request_id` (correlação), `context` (ip, user_agent, device) e `old_values`/`new_values`.
32. `created_at` é **imutável** (só INSERT; sem `updated_at`).

## 7. Fora do escopo do MVP

33. **Identidade entre tenants** (melhoria futura): tratar o mesmo usuário em empresas diferentes, detectado pelo **email** — vínculo de pessoa global, reaproveitamento de cadastro e evitar duplicidade de dados pessoais entre tenants.
34. **Super admin** de múltiplas autarquias (gestão de autarquias) — versão completa.
35. **Integração com Gmail/Google** para avisos à administração e disparo de relatórios — versão completa.

## Referências

- [Modelagem — Usuários, empresas e permissões](../modelagem/modelagem-usuarios-empresas-permissoes.md)
- [Modelagem — Controle de veículos e fluxo de acesso](../modelagem/modelagem-controle-veiculos.md)
- [ADR 0001 — Migrations e seeds iniciais](../adr/0001-migrations-seeds-iniciais.md)
- [Regras de negócio — Controle de veículos e fluxo de acesso](./regra-negocio-controle-veiculos.md)
- Fonte consolidada: `planejamento/planejamento-geral.md` (Decisões de negócio resolvidas) e `planejamento/pendencias.md` (LGPD em aberto)
