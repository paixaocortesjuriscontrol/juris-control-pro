# Reagendamento de workflows e reagendamento em lote

## 1. Observações perdidas ao reagendar a 2ª etapa
1. Confirmar a causa primeiro: localizar no histórico as tarefas de workflow reagendadas em 27/11/2026 (troca de responsável e data) e comparar as observações antes e depois. Sem achar a causa nos dados reais, nada é alterado.
2. Corrigir o caminho encontrado, para que reagendar (trocar data ou responsável) nunca apague nem substitua as observações da etapa, inclusive o texto do prazo recursal que vem da etapa anterior.
3. Recuperar as observações das tarefas já afetadas a partir do histórico, só depois de você confirmar a lista.
4. Teste pequeno: reagendar mantém as observações.

## 2. Reagendamento em lote por tipo de atividade
Hoje o painel de remanejamento em lote só separa por Tarefa, Prazo, Evento e Audiência.
1. Incluir um filtro "Tipo de atividade" (ex.: RRAP, Contestação, Comprovação de pagamento), com várias escolhas, montado a partir dos tipos dos itens carregados.
2. O filtro só restringe a lista; a seleção e as regras de data continuam iguais.
3. Teste do filtro.

## Detalhes técnicos
- Busca de causa em `auditoria_tarefas` (campos_alterados com observacoes/descricao) para tarefas `origem = workflow`; verificar `TarefaAgendaPanel`, `ReagendarAudienciaDialog` e o executor de workflow (`juntarObservacoesWorkflow`).
- Filtro em `RemanejamentoTarefasSheet.tsx` por `tipo_tarefa`/modelo, sem mudar banco.
- Versão nova no menu ao final.
