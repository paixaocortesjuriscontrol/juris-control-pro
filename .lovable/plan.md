## Objetivo

Permitir que **admins e coordenadores** distribuam processos da tela **Distribuição TST** entre advogados, registrando data de distribuição, prazo de entrega e status, com **Kanban híbrido** de acompanhamento.

---

## 1. Banco de dados (migration)

Adicionar à tabela `dados_benner`:

- `distribuido_em` (timestamptz)
- `distribuido_por` (uuid)
- `prazo_entrega` (date)
- `status_distribuicao` (text, default `pendente`) — valores: `pendente | em_andamento | entregue`
- `entregue_em` (timestamptz, nullable)
- `entregue_por` (uuid, nullable)
- `observacao_distribuicao` (text, nullable)

Índices: `status_distribuicao`, `prazo_entrega`, `distribuido_em`.

Vínculos com advogados continuam em `dados_benner_responsaveis` (já existe). RLS herda das políticas atuais.

---

## 2. Delegação em lote (tela Distribuição TST)

A tela `src/pages/DistribuicaoTst.tsx` já tem `selectedIds`. Adicionar:

- Botão **"Delegar selecionados (N)"** na barra de ações, visível apenas se `isAdminOrCoordinator` (via `useUserRole`).
- Abre `DelegarProcessosDialog`:
  - **Multi-select de advogados** (reaproveita `useProfilesBasic`, filtrado pela coordenação quando aplicável).
  - **Prazo de entrega** (DatePicker shadcn, único para o batch).
  - **Observação** (opcional).
  - Confirmar → para cada `id` selecionado:
    - `UPDATE dados_benner SET distribuido_em=now(), distribuido_por=auth.uid(), prazo_entrega=$prazo, status_distribuicao='pendente', observacao_distribuicao=$obs WHERE id=ANY($ids)`.
    - `INSERT INTO dados_benner_responsaveis` para cada par (id × advogado), **sem apagar vínculos existentes** (`ON CONFLICT DO NOTHING`).
  - `await queryClient.invalidateQueries` antes de fechar e exibir toast.

Adicionar à tabela duas colunas: **Prazo entrega** e **Status** (badge colorido).

---

## 3. Kanban híbrido `/distribuicao-tst/kanban`

Nova página `src/pages/DistribuicaoTstKanban.tsx`, link a partir do header da Distribuição TST.

Colunas (baseadas em `prazo_entrega` + `status_distribuicao`):

```text
[ Sem prazo ] [ >5 dias ] [ 4 dias ] [ 3 dias ] [ 2 dias ] [ Prazo Fatal/Atrasado ] [ Entregue ]
```

- Processos com `status_distribuicao='entregue'` vão direto para a coluna **Entregue** (independente do prazo).
- Demais são distribuídos pelas colunas de prazo (igual lógica de `TstKanbanBoard.tsx`).
- Atrasados (prazo < hoje, status ≠ entregue) caem em **Prazo Fatal/Atrasado**.

Cards exibem: nº processo, dossiê, advogado(s) responsável(eis), prazo, dias restantes, coordenador, badge de status.

Filtros no topo: por **advogado**, **coordenação**, **aba_origem**, **status**. Padrão para advogado comum = "meus processos".

Ações no card:
- **Marcar como entregue** → `status_distribuicao='entregue'`, `entregue_em=now()`, `entregue_por=auth.uid()`.
- **Marcar em andamento** → `status_distribuicao='em_andamento'`.
- Clique no card abre o detail sheet existente (`DistribuicaoTstDetail`).

Reaproveitar visual de `src/components/tst-prazos/TstKanbanBoard.tsx` (mesmas cores por urgência).

---

## 4. Hooks

- `src/hooks/useDelegacaoTst.ts` — mutations: `delegarProcessos({ ids, advogadoIds, prazo, observacao })`, `marcarStatus({ id, status })`.
- Estender `useDistribuicoesTst.ts` para retornar os novos campos.
- `src/hooks/useDistribuicaoTstKanban.ts` — query agrupada com filtros + map de responsáveis (reaproveita `loadResponsaveisMap`).

---

## 5. Permissões

- Botão **Delegar** e ações de status: somente `isAdminOrCoordinator`.
- Advogados comuns: visualizam o Kanban, veem por padrão só seus processos, podem marcar entrega dos próprios.
