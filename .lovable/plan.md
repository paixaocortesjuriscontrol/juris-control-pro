# Aumentar limite de texto do Título de tarefas e prazos

A mensagem do print ("String must contain at most 200 character(s)") vem do campo **Título**, não da Descrição. Hoje o título aceita no máximo 200 caracteres.

## O que muda
- Limite do Título passa de 200 para **1.000 caracteres** em todas as telas de criação/edição de Tarefa, Prazo, Evento e Audiência (Análise DJEN, ficha do processo, Painel de Controle, delegação individual e em lote, audiências).
- Mensagem de erro em português: "O título pode ter no máximo 1.000 caracteres".
- Descrição continua sem limite curto (já aceita textos longos; onde houver 2.000, sobe para 10.000).

## Detalhes técnicos
- Trocar `.max(200)` do `titulo` nos schemas zod: `NovaTarefa.tsx`, `CriarTarefaAudienciaDialog.tsx`, `DelegarTarefaLoteDialog.tsx`, `DelegarTarefaDialog.tsx`, `delegacao/NovaTarefaDialog.tsx`, `TarefaPublicacaoView.tsx`, `CriarTarefaProcessoDialog.tsx` e demais schemas de título encontrados (NovoItemPanel e afins).
- `maxLength={2000}` de descrição em `TarefaAgendaPanel`, `delegacao/TarefaDetalhesPanel`, `TarefaDetalhesDialog` e `mention-input` sobe para 10000.
- Conferir no banco que as colunas `titulo`/`descricao` são `text` (sem limite); não alterar o banco se forem.
