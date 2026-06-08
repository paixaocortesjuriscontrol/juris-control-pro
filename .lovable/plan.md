## Objetivo

Que "Em Agenda" e "Em Lista" sejam **a mesma coisa**, mudando apenas o modo de visualização (calendário vs tabela). Hoje há dois painéis de detalhes diferentes, um deles ainda abre popup para editar, e os campos divergem. Vou eliminar essa divergência criando **um único painel compartilhado**.

## O que vou fazer

1. **Criar um painel único** `TarefaItemPanel` (em `src/components/painel-controle/`) que substitui:
   - `TarefaAgendaPanel` (usado em "Em Agenda")
   - `TarefaDetalhesPanel` + `PrazoDialog` em modo edição (usados em "Em Lista")

2. **Formulário de edição único e completo** (inline, sem popup), com os mesmos campos para tarefa/prazo/evento nos dois modos:
   - Título
   - Tipo de Tarefa / Tipo de Evento (conforme origem)
   - Prioridade
   - Data Prevista / Data Fatal (ou Início/Fim para evento)
   - **Responsáveis** (multi, via `PeoplePicker`, gravando em `tarefa_responsaveis`)
   - **Envolvidos** (multi, via `PeoplePicker`, gravando em `tarefa_envolvidos`) — atualmente faltando no modo Agenda
   - Local (para eventos)
   - Observações / Descrição

3. **Mesmas ações** em ambos os modos: Concluir / Reabrir, Cancelar, Processo, Editar, Descartar, Excluir.

4. **Mesmo layout visual**: o painel ocupa ~60% da largura (hoje está em 45%) e o formulário usa grid de 2 colunas aproveitando a largura — não fica mais "comprimido à esquerda".

5. **"Em Lista"** (`ListaAtividadesView.tsx`):
   - Remover `PrazoDialog` para edição.
   - Botão "Editar" da linha passa a abrir o painel lateral e ativar modo de edição inline.
   - Painel lateral renderiza `TarefaItemPanel` (o mesmo da Agenda).

6. **"Em Agenda"** (`PainelControle.tsx`):
   - Substitui `TarefaAgendaPanel` por `TarefaItemPanel` (mesmo componente).

7. `PrazoDialog` continua existindo apenas para **criação** de novo prazo (botão "+ Adicionar > Prazo"), porque ali ainda faz sentido um modal rápido. Edição em qualquer modo nunca mais abre popup.

## Detalhes técnicos

- `TarefaItemPanel` aceita um item normalizado (`PainelItem`) que cobre tarefa e evento, com adaptadores para mapear `Prazo` (lista) e `ItemAgendaUnificado` (agenda) → `PainelItem`.
- Persistência de `tarefa_responsaveis` e `tarefa_envolvidos` é feita no `handleSaveEdit` (delete + insert), igual ao `PrazoDialog` hoje.
- `evento_participantes` continua sendo gravado para eventos (mesmo padrão atual).
- Invalidação de cache: `["lista-atividades"]`, `[AGENDA_INFINITE_QUERY_KEY]`, `["tarefas"]`, `["tarefas-paginated"]`, `["tarefas-stats"]`.
- Os arquivos antigos `TarefaAgendaPanel.tsx` e `TarefaDetalhesPanel.tsx` (em `prazos/`) ficam só como re-export do novo, para não quebrar outros consumidores (MinhaCarteira, PainelEquipe, Prazos, AnaliseDjen, CentralDelegacao etc.), que continuarão funcionando exatamente igual.

## Fora do escopo

- Mudanças no que aparece dentro do calendário/tabela em si (cores, colunas, ordenação).
- Mudanças nos demais painéis (Prazos Fatais, Audiências, Notificações).
- Mudanças nas telas que apenas reutilizam `TarefaDetalhesPanel` em outros contextos (MinhaCarteira, PainelEquipe etc.) — elas seguem iguais via re-export.
