# Painel lateral em Minhas responsabilidades

Em todas as listas da página, clicar num item passa a abrir um painel lateral à direita, por cima da tela, em vez de ir direto para outra página. Cada painel tem um botão para abrir a tela original.

## Atividades (tarefas, prazos, eventos, audiências)
- Abre o mesmo painel de detalhes do Painel de Controle, com edição direta, situação, comentários e checklist.
- No topo: botão **"Abrir processo"**, quando a atividade tiver processo.
- Ao salvar uma alteração, a lista e os contadores são atualizados.

## Processos
- Abre um painel com o resumo do processo: número, cliente, assunto, situação, coordenação e responsáveis, usando a mesma visão geral da ficha de Processos e Casos.
- Botão **"Abrir processo"** leva à ficha completa.

## Workflows
- Abre um painel com o nome do workflow, a coordenação, a etapa da pessoa (responsável ou envolvido) e a lista de etapas.
- Botão **"Abrir workflow"** leva à tela de workflows.

## Detalhes técnicos
- Reaproveitar `ItemDrawer` + `EdicaoItemPanel` (como em `PainelControle.tsx`). As linhas de `get_agenda_pessoal` recebem o mesmo campo `tipo` que a agenda unificada usa (tarefa/evento/audiência), para o painel reconhecer o item. Ao atualizar, invalidar `["minhas-responsabilidades"]` e a agenda.
- Processos: `ItemDrawer` com a visão geral já usada na ficha (`ProcessoVisaoGeralForm`, carregada pelo ID só quando o painel abre).
- Workflows: `ItemDrawer` com as etapas lidas de `workflow_etapas` pelo `workflow_id`.
- Sem mudanças no banco nem nas permissões.
