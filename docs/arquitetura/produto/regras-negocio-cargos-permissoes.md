# Regras de negócio — Cargos e permissões

> Regras de negócio do **sistema de cargos e permissões** (RBAC operacional) do SOMAR.
> Modelagem do banco: [modelagem-usuarios-empresas-permissoes.md](../modelagem/modelagem-usuarios-empresas-permissoes.md) (seção RBAC).
> Decisão arquitetural: [ADR 0004 — Sistema de cargos e permissões](../adr/0004-sistema-de-cargos-e-permissoes.md).
> Complementa as regras gerais de RBAC de [regras-negocio-usuarios-empresas-permissoes.md](./regras-negocio-usuarios-empresas-permissoes.md) (seção 4).

## 1. Catálogo de permissões (`permission`)

1. `permission` é um **catálogo global** do sistema (sem `company_id`); é populado por seed e **não é criado nem alterado pela aplicação** — apenas lido.
2. A rota de recuperação do catálogo (`GET /permissions`) só é acessível se o ator, na empresa da sessão, for **administrador (`is_admin`) ou possuir a permissão `MANAGE_ROLES`** — caso contrário, 403.
3. No código, as permissões são referenciadas pelo enum `PermissionCode` (nunca strings hardcoded).

## 2. Cargos (`role`)

4. **Cargos são por empresa** (`role.company_id`). Toda operação usa o `company_id` da sessão (nunca do body).
5. O CRUD de cargos (criar, listar com paginação/filtro, detalhar, atualizar, desativar) exige `MANAGE_ROLES`.
6. **`is_admin` = acesso total**: um cargo marcado como `is_admin` concede acesso à administração independentemente das permissões listadas em `role_permission` (bypass no guard).
7. **Cargos `is_admin` são protegidos — não é possível criar, editar ou excluir**:
   - criar rejeita `is_admin: true`;
   - editar rejeita alterar `is_admin` (em qualquer direção) e rejeita qualquer edição de um cargo que já é `is_admin`;
   - desativar um cargo `is_admin` é rejeitado.
8. Cargos de administração são **responsabilidade do sistema**: criados por seed hoje; no futuro, criados **automaticamente ao criar uma empresa** (quando o painel administrativo com `super_admin` for implementado — fora do escopo atual).
9. **Desativar um cargo não remove vínculos existentes** (`role_permission`, `user_role`): apenas impede novos usos — o cargo deixa de valer na resolução de permissões, mas o histórico permanece.
10. Listagem de cargos no formato padrão `{ limit, offset, data, count, parameters? }`, com `is_admin` no retorno.

## 3. Permissões por cargo (`role_permission`)

11. Um cargo possui um conjunto de permissões por meio de `role_permission` (unique `(company_id, role_id, permission_id)` — sem duplicidade).
12. Só são aceitas permissões do **catálogo global** (`permission`); permissão inexistente → erro 4xx.
13. Associar/remover permissão e listar as permissões do cargo (com o catálogo disponível) exigem `MANAGE_ROLES`.
14. O vínculo é sempre da **empresa da sessão**; um `role_id` de outra empresa é inacessível e vínculo cross-tenant é rejeitado.

## 4. Multi-tenant

15. Cargos e vínculos **nunca vazam entre empresas**: todas as consultas e validações são escopadas pelo `company_id` da sessão (nível de aplicação).
16. O catálogo `permission` é global, mas o **vínculo** `role_permission` carrega o `company_id` da empresa da sessão.

## Referências

- [ADR 0004 — Sistema de cargos e permissões](../adr/0004-sistema-de-cargos-e-permissoes.md)
- [Modelagem — Usuários, empresas e permissões](../modelagem/modelagem-usuarios-empresas-permissoes.md)
- [Regras de negócio — Usuários, empresas e permissões](./regras-negocio-usuarios-empresas-permissoes.md)
- Seeds: `src/shared/database/typeorm/seeds/0001-seed-initial-permissions.ts` e `0002-seed-default-company-roles-admin-vehicle-types.ts`
