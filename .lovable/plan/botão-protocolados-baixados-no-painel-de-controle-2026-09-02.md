# Botão "Protocolados/Baixados" no Painel de Controle

## Objetivo
Novo atalho no Painel de Controle que abre a visão em Lista já filtrada pelas situações **Protocolado** e **Baixado**, com filtro de período (data inicial/final) e de responsáveis (todos, um ou vários).

## Visibilidade
- Aparece somente para usuários vinculados à **Coordenação Dra. Beatriz Costa** (`d997ca10-0012-4a0e-8856-664812366fec`), seja como membro ou como coordenadora titular.
- Administradores também veem (mantém consistência com os demais atalhos do painel).

## Comportamento ao clicar
1. Muda a visão para **Lista**.
2. Aplica nos filtros do painel: `situacoes = ["protocolado", "baixado"]`, `statusGroup = "todas"`, `classificacoes = []` (todos os tipos: prazo, tarefa, evento, audiência, parcelamento), sem restrição de "sou responsável / estou envolvido".
3. Abre um painel compacto de filtros logo acima da lista, com:
   - **Data inicial** e **Data final** (aplicadas em `periodoInicio` / `periodoFim`).
   - **Responsáveis**: seleção múltipla com opção "Todos" (aplica em `responsavelIds`).
   - Botão **Limpar** (volta a "todos os responsáveis" e sem período, mantendo Protocolado/Baixado).
4. O botão fica destacado (estado ativo) enquanto o modo estiver ligado; clicar de novo, ou trocar de visão/limpar filtros, sai do modo.

## Detalhes técnicos
- `src/pages/PainelControle.tsx`:
  - Nova query (ou reuso de `coordenacoesUsuario`) para saber se o usuário pertence à coordenação da Dra. Beatriz Costa; constante com o UUID da coordenação em `src/constants/`.
  - Estado `modoProtocoladosBaixados`; handler que faz `setViewMode("lista")` + `setPainelFiltros({...})` conforme acima e `setSituacaoFilter("todos")`.
  - Botão renderizado junto aos toggles de visão (Agenda/Lista/Kanban, ~linha 2286), condicionado à visibilidade.
- Reaproveita a infraestrutura existente de filtros (`PainelFiltrosState` já tem `situacoes`, `periodoInicio`, `periodoFim`, `responsavelIds`) e o seletor de responsáveis já usado em `PainelFiltros.tsx` — nenhuma mudança de banco, RLS ou lógica de dados.
- As situações `protocolado` e `baixado` já existem em `src/constants/situacoesItem.ts` e no enum `status_tarefa`; serão aplicadas de forma fixa pelo botão, independente da configuração "quem pode mudar cada situação".
