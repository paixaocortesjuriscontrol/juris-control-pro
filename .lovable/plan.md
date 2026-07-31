# Etiquetas por Coordenação (modelo Astrea)

Sistema de etiquetas coloridas no mesmo esquema do Astrea (criar, editar, excluir, aplicar e filtrar), com um detalhe importante: **cada coordenação tem suas próprias etiquetas**. Uma etiqueta criada na coordenação da Dra. Beatriz não aparece nas demais.

## Como vai funcionar

**Tela de gestão — menu "Etiquetas"**
- Nova opção no menu lateral, visível para admin, coordenador e assistente coordenador.
- Seletor de coordenação no topo, auto-selecionando a coordenação padrão do usuário (igual às outras telas de gestão).
- Lista das etiquetas da coordenação em ordem alfabética, com busca por nome.
- Botão "Adicionar etiqueta" e, em cada linha, menu de três pontinhos com "Editar" e "Excluir" (com confirmação).
- Ao criar/editar: nome, cor (paleta de 16 cores) e **em quais módulos a etiqueta aparece** (Processos e Casos, Itens do botão Adicionar, Clientes, Publicações) — todos ou apenas alguns, como no Astrea.
- Excluir remove a etiqueta de todos os itens onde estava aplicada.

**Aplicar etiquetas (ícone de etiqueta)**
Um único componente reutilizável (popover com ícone de etiqueta, busca, checkboxes e criação rápida) usado em:
- Processos e Casos — na linha do processo e no formulário do processo.
- Tarefas, Prazos, Eventos, Audiências e Parcelamentos — nos formulários do botão Adicionar e nos cards do Kanban/lista.
- Clientes — na lista e no formulário de cliente.
- Publicações / Análise DJEN — no card da publicação.

Em cada módulo aparecem somente as etiquetas da coordenação do item e habilitadas para aquele módulo.

**Filtrar por etiqueta**
- Filtro de etiqueta (ícone + lista alfabética com busca) em Processos e Casos, Painel de Controle (tarefas/prazos/eventos/audiências), Clientes e Análise DJEN.
- Seleção múltipla, com chips do filtro ativo e "x" para remover, como no Astrea.

**Permissões**
- Criar, editar, renomear, mudar cor e excluir: apenas admin, coordenador e assistente coordenador.
- Aplicar, remover de um item e filtrar: qualquer membro da coordenação.

**TAGs da Distribuição TST**
Ficam como estão hoje (catálogo global próprio, sem mudanças). O novo sistema é independente.

## Detalhes técnicos

Banco (migração com GRANTs + RLS):
- `etiquetas`: `id`, `coordenacao_id` (FK), `nome`, `cor`, `modulos text[]` (processos | itens | clientes | publicacoes), `ativo`, `ordem`, `created_by`, timestamps. Unique `(coordenacao_id, lower(nome))`.
- `etiquetas_itens` (vínculo polimórfico): `id`, `etiqueta_id` (FK on delete cascade), `entidade` (processo | tarefa | prazo | evento | audiencia | parcelamento | cliente | publicacao), `entidade_id uuid`, `created_by`, `created_at`. Unique `(etiqueta_id, entidade, entidade_id)` e índice em `(entidade, entidade_id)`.
- RLS: SELECT em `etiquetas` e SELECT/INSERT/DELETE em `etiquetas_itens` para membros da coordenação da etiqueta; INSERT/UPDATE/DELETE em `etiquetas` restrito por papel (admin, coordenador, assistente_coordenador), reaproveitando `has_role` e `get_user_coordenacao`.
- GRANTs: `SELECT, INSERT, UPDATE, DELETE` para `authenticated` e `ALL` para `service_role` (sem acesso `anon`).

Frontend:
- `src/hooks/useEtiquetas.ts` — catálogo por coordenação, CRUD, toggle em item, mapa `entidade_id => etiquetaIds[]` (consulta em chunks de 500, seguindo o padrão atual) e helper de ids por etiqueta para a filtragem.
- `src/components/etiquetas/EtiquetaPicker.tsx` — popover de aplicar/criar, com modo `readOnly` para exibição.
- `src/components/etiquetas/EtiquetaFilter.tsx` — filtro multi-seleção com chips.
- `src/pages/Etiquetas.tsx`, rota `/etiquetas` em `App.tsx` e entrada em `src/config/menuItems.ts` com `adminOrCoordOnly: true`.
- Edição inline no padrão do projeto (sem botão "Editar" solto) e `await invalidateQueries` antes de fechar diálogos ou atualizar listas.
- Filtro em Processos e Casos: resolve os ids dos itens das etiquetas selecionadas antes da consulta paginada, sem alterar a RPC existente nesta etapa.