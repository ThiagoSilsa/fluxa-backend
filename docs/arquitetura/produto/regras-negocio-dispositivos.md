# Regras de negócio — Gerenciamento de dispositivos (device)

> Regras de negócio do **gerenciamento de dispositivos do app do porteiro** no SOMAR: a administração cria, lista, vincula a portaria, desativa, exclui e rotaciona o token dos aparelhos (tablet/celular) por empresa.
> Decisão arquitetural: [ADR 0008 — Gerenciamento de dispositivos](../adr/0008-sistema-de-gerenciamento-de-dispositivos.md).
> Modelagem da tabela `device`: [modelagem-usuarios-empresas-permissoes.md](../modelagem/modelagem-usuarios-empresas-permissoes.md).
> Regras do dispositivo no fluxo de acesso (tablet compartilhado, vínculo com portaria, cache offline): [planejamento-geral](../../../../../../planejamento/planejamento-geral.md) e [planejamento-aplicativo-celular](../../../../../../planejamento/planejamento-frontend/planejamento-aplicativo-celular.md).

## 1. Acesso e escopo

1. Todos os endpoints de dispositivos exigem **`MANAGE_DEVICES`** (ou `is_admin`, bypass do ADR 0004) → **403** sem ela.
2. Tudo é escopado pela **empresa da sessão**: criar, listar, consultar, editar, excluir e rotacionar atuam sobre a empresa da sessão; device de outro tenant → **404** (não revela existência).

## 2. Criação e token

3. `POST /devices` cria o dispositivo com `name*` (2–100), `platform*` (`ANDROID`/`IOS`) e `entranceId?` opcional → **201**.
4. O **token é gerado pelo backend** (`crypto.randomBytes(16)` → 32 caracteres hex) no momento da criação e **exibido apenas na resposta desta criação** (write-only). Não é listado, detalhado nem editável em nenhum outro endpoint.
5. O token é **único por empresa** (unique `(company_id, token)` na tabela `device`) → conflito cai no banco e é traduzido (nunca 500 cru).
6. **Plataforma é imutável** após a criação — é propriedade física do aparelho; `PATCH` não a altera.
7. `app_version` e `last_sync_at` são **somente leitura** na web — serão preenchidos pelo app no registro/sync (fase do app, semana 3+); `PATCH` não os altera.

## 3. Listagem e consulta

8. `GET /devices` lista no formato padrão `{ limit, offset, count, data, parameters }`: busca por **nome** (`search`, case-insensitive), filtro **`isActive`**, ordenação por `name`/`createdAt`/`lastSyncAt` (`sortOrder` `asc`/`desc`) e paginação `limit`/`offset`.
9. O `parameters` traz **`allowed_values` das portarias ativas** da empresa (chave `entrance_id`, `[{ id, name }]`) para o seletor do formulário — sem que o front importe a feature entrances.
10. `GET /devices/:id` devolve o dispositivo ou **404** se não existir/for de outro tenant.
11. `DeviceResponse`: `{ id, name, platform, appVersion, entranceId, entrance, lastSyncAt, isActive, createdAt, updatedAt }` — **sem o token**.

## 4. Edição e vínculo com portaria

12. `PATCH /devices/:id` aceita `name?`, `entranceId?` e `isActive?` → 200 com o device atualizado; **404** se não existir/for de outro tenant.
13. **Vincular portaria** (`entranceId`): a portaria deve **existir e estar ativa** na mesma empresa → senão **400**; portaria de outro tenant → **404**. Desvincular = `entranceId: null`.
14. Se a portaria vinculada for **desativada**, o vínculo **permanece** — a portaria inativa apenas deixa de ser selecionável para novos vínculos; o device só volta a operar quando a portaria for reativada ou o vínculo trocado.
15. A exclusão física de uma portaria continua **bloqueada com 409** enquanto houver dispositivos vinculados (mecanismo existente em entrances — ADR 0006 §5), independente do device estar ativo ou não.

## 5. Desativação e exclusão

16. **Desativar** (`PATCH` com `isActive = false`) é a operação de **suspensão**: o device permanece no histórico, deixa de operar e o **token deixa de valer** para sync (na fase do app). **Não** remove o vínculo com a portaria nem o histórico. Reativação: `PATCH` com `isActive = true`.
17. **Excluir fisicamente** (`DELETE /devices/:id`, **204**) é **permitido** — o `device` não tem FK de referência (eventos usam `entrance_id`; auditoria futura guardaria `device_id` apenas em jsonb). A exclusão remove o token e o aparelho deixa de ser reconhecido. **404** se não existir/for de outro tenant.
18. A UI enfatiza a **desativação** (ação de segurança) e disponibiliza a exclusão para aparelhos devolvidos/danificados.

## 6. Rotação de token

19. `POST /devices/:id/rotate-token` gera um **novo token** (mesmo mecanismo da criação) e o devolve **uma única vez** nesta resposta → 200; **404** se não existir/for de outro tenant.
20. Rotacionar **invalida o token anterior** (o aparelho antigo para de sincronizar). O device mantém `id`, nome, plataforma, vínculo e status.
21. Uso típico: tablet perdido, roubado, substituído ou token suspeito de vazamento. Não há limite de rotações.

## 7. Integração com o app (fase futura — semana 3+)

22. **Fora do escopo desta leva**: registro do app na 1ª execução (reivindicação de device pré-criado por token ou criação automática), endpoints de sync (push/pull incremental usando `token` e `last_sync_at`, revalidação de regras), cache offline e limpeza por desativação, retenção de 30 dias e auditoria.
23. Quando o sync existir, um device **desativado** ou com **token rotacionado** tem a sincronização **rejeitada** pelo servidor.

## Referências

- [ADR 0008 — Gerenciamento de dispositivos](../adr/0008-sistema-de-gerenciamento-de-dispositivos.md)
- [Modelagem — usuários, empresas e permissões](../modelagem/modelagem-usuarios-empresas-permissoes.md)
- [ADR 0006 — Cadastros base](../adr/0006-sistema-de-cadastros-base.md)
- [Planejamento geral (Device compartilhado / Offline)](../../../../../../planejamento/planejamento-geral.md)
