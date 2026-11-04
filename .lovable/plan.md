# Cores dos workflows iguais às cores dos modelos

## O que ela está pedindo
Não é colocar cor na etapa. Ela quer que a tarefa criada pelo workflow apareça no calendário **com a cor do modelo de tarefa** (Encerramento marrom, Comprovação verde), igual às tarefas criadas direto pelo modelo.

## O que era a marquinha colorida
A faixinha fina na lateral esquerda de algumas tarefas **é a cor do modelo**. Hoje o calendário mostra a cor do modelo só nessa faixa de 3 pixels; o resto do quadrinho fica na cor do tipo (tarefa/prazo). Por isso ela acha que "não pegou a cor".

## Por que o workflow novo dela não pegou
Na etapa do workflow, o botão "Modelos" só copia o título e o prazo do modelo — **não guarda qual modelo foi escolhido**. Hoje a cor só vem se o título da etapa for exatamente igual ao nome do modelo. Se ela editou o título, a tarefa sai sem cor.

## O que vou fazer
1. **Etapa lembra o modelo:** ao escolher um modelo na etapa, ele fica gravado na etapa e aparece um aviso "Modelo: ENCERRAMENTO ... (cor)" com opção de tirar. As tarefas criadas por essa etapa sempre levam a cor desse modelo, mesmo com título diferente. Continua valendo o "mesmo nome" para etapas antigas.
2. **Cor inteira no calendário:** tarefas com modelo passam a aparecer com o quadrinho todo na cor do modelo (fundo claro na cor + borda na cor), não só a faixinha. Cancelado/protocolado/baixado mantêm o risquinho e concluído continua verde-escuro, conforme a regra atual.
3. Mesma aparência nas outras visões da agenda que já mostram a faixinha.

## Detalhes técnicos
- Gravar `modelo_tarefa_id` em `workflow_etapas.campos_item` (sem mudar o banco) no `onSelect` do `ModeloTituloPicker` em `WorkflowEditor.tsx`; exibir chip com nome/cor e botão remover.
- `workflowExecutor.ts`: usar `campos_item.modelo_tarefa_id` primeiro; fallback para a busca por nome já existente.
- `PainelControle.tsx` (e demais pontos que usam `useModeloTarefaItens`): trocar `borderLeft 3px` por `backgroundColor` com transparência + `borderColor` da cor do modelo, mantendo prioridade de cancelado/concluído.
- Pergunta em aberto: preciso da "próxima foto" que ela citou para confirmar se faltava outra opção além do modelo.
