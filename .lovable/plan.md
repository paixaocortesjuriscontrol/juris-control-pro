# Cor das etapas do workflow na agenda

## O que era a marquinha colorida
A faixinha na lateral esquerda das tarefas é a cor do modelo de tarefa. Hoje ela tem só 3 pixels, por isso quase não se vê.

## O que vou fazer
1. **Faixinha mais grossa:** passa de 3 para 6 pixels em todas as visões da agenda que a mostram. O resto do quadrinho continua como está. Cancelado/protocolado/baixado e concluído seguem a regra atual.
2. **Cor em cada etapa do workflow:** na tela de editar etapa, um campo "Cor" com paleta de cores e opção "Sem cor".
   - Ao escolher um modelo na etapa, a cor do modelo já vem preenchida, e dá para trocar.
   - A tarefa criada por essa etapa mostra a faixinha com essa cor.
   - Na lista de etapas do workflow aparece uma bolinha com a cor de cada etapa.
3. **Ordem da cor na faixinha:** primeiro a cor da etapa. Se a etapa não tiver cor, vale a cor do modelo de mesmo nome, como funciona hoje.
4. As tarefas que já foram criadas por workflows também passam a mostrar a cor da etapa que as criou.

## Detalhes técnicos
- Cor gravada em `workflow_etapas.campos_item.cor` (sem mudar o banco); campo de cor e preenchimento automático no `onSelect` do `ModeloTituloPicker` em `WorkflowEditor.tsx`.
- A tarefa guarda a cor: `workflowExecutor.ts` grava a cor em um campo existente da tarefa ligado à etapa (a confirmar entre `campos_item`/metadados da tarefa ou leitura pela execução da etapa), sem novas colunas, se possível.
- `useModeloTarefaItens`: devolver também a cor da etapa para tarefas de workflow (via `workflow_execucao_etapas` → `workflow_etapas`), com prioridade sobre a cor do modelo.
- `PainelControle.tsx` e demais pontos: `borderLeft` de 3px para 6px.
