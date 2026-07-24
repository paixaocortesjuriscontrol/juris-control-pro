## Problema

Ao clicar em um resultado da busca global no Painel de Controle (tarefa, prazo, evento, audiência criada via "+ Adicionar"), o `BuscaGlobalPainel` navega para `/minha-agenda?selectedId=...`. Isso tira o usuário do Painel de Controle, esconde a barra superior (Pessoal/Escritório/Em Agenda/Kanban/Prazos/Audiências/…) e ainda cai em uma agenda cujos filtros padrão excluem o item, mostrando "Nenhuma atividade encontrada".

## Solução

Manter o usuário no Painel de Controle quando o item vier do botão "+ Adicionar" e abrir direto o painel de detalhes lá, sem mexer nos filtros da tela.

### Passos

1. **`src/components/painel/BuscaGlobalPainel.tsx`**
   - Trocar as rotas dos resultados que representam itens do "+ Adicionar":
     - `tarefa`, `prazo`, `evento`, `parcelamento` → `/painel-controle?selectedId=<id>&tipo=<tipo>`
     - `audiencia` (tarefa do tipo audiência): idem `/painel-controle?...`
   - Manter demais tipos (`processo`, `cliente`, `publicacao`) inalterados.
   - `audiencias_detectadas` continua indo para `/painel-audiencias` (é outro fluxo).

2. **`src/pages/PainelControle.tsx`**
   - Adicionar `useSearchParams`. Em um `useEffect` de mount (guardado por `useRef` para rodar uma única vez):
     - Ler `selectedId` e `tipo`.
     - Buscar o item pelo id na fonte correspondente (`tarefas` para tarefa/prazo/audiência; `eventos_agenda` para evento/parcelamento).
     - Montar o objeto no shape de `ItemAgendaUnificado` (mesmo shape já usado por `setSelectedItem`) e chamar `setSelectedItem(item)`.
     - Limpar os `searchParams` com `{ replace: true }`.
   - **Não alterar** `viewMode`, filtros Pessoal/Escritório, período, tipo, coordenação nem o `+ Adicionar`. A barra superior permanece igual.
   - Se o item não for encontrado, mostrar toast "Item não encontrado ou sem permissão" e não abrir nada.

3. **Verificação**
   - Buscar por processo com audiência no campo do topo → clicar no resultado → confirmar:
     - URL continua em `/painel-controle` (sem `selectedId` após consumo).
     - Barra superior (Pessoal/Escritório/Em Agenda/…/+ Adicionar) segue visível.
     - Painel lateral de detalhes do item abre com os dados corretos.

## Detalhes técnicos

- Para não duplicar a lógica de mapear "linha do banco → ItemAgendaUnificado", reaproveitar o `mapper` já existente em `useAgendaUnificada` (ou o mesmo shape mínimo que outros pontos de `setSelectedItem` já usam). Se não houver um mapper exportável, criar um `mapRowToItemAgenda(row, tipo)` local em `PainelControle.tsx` com apenas os campos que `TarefaDetalhesPanel`/`EventoDetalhesPanel` consomem (id, tipo, título, status, data_vencimento/data_fatal/data_inicio, responsável, coordenacao_id, processo_id, etc.).
- Nenhum ajuste em RLS, hooks globais ou `MinhaAgenda` — o fluxo antigo continua funcionando para quem chegar em `/minha-agenda?selectedId=...` diretamente.
