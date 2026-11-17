# Coordenação certa em tarefas de processos com mais de uma coordenação

## Por que troca
O processo 0000748-46.2026.5.05.0102 está em duas coordenações: Santander Trabalhista (a principal) e Dra. Beatriz Costa. Ao editar uma tarefa, a tela pegava sempre a coordenação principal do processo, ignorando a da tarefa e a de quem a editava. A tarefa mudava para a Santander, e a notificação saía com esse nome. As notificações foram só para as 6 pessoas da equipe da Beatriz.

## Regra
Quando o processo estiver em mais de uma coordenação, a tarefa fica na coordenação do usuário:
1. Se a tarefa já tem coordenação, ela é mantida.
2. Se não tiver, usa a coordenação do usuário entre as do processo.
3. Só se o usuário não fizer parte de nenhuma delas, usa a coordenação principal do processo.

A notificação mostra a coordenação da tarefa, então passa a sair com o nome certo.

## Onde
- Janela de tarefa e ata, inclusive aberta pelo Painel: os itens 1 e 2 já estão na versão de testes. Falta o item 3.
- Tela de tarefa em página inteira: mesma regra.
- Prazo, evento e audiência já mantinham a coordenação gravada.

## Fora do escopo
- Tarefas antigas não serão alteradas.

## Detalhes técnicos
- Em `NovaTarefaDialog.tsx`, quando a tarefa vier sem `coordenacao_id`, buscar as coordenações do processo (`processos.coordenacao_id` + `processos_coordenacoes_responsaveis`) e escolher a primeira que esteja em `membros_coordenacao` do usuário. Se nenhuma estiver, usar a principal.
- Aplicar a mesma escolha em `NovaTarefa.tsx`.
