# Workflow no botão Adicionar do Painel de Controle

## O que muda

No botão **Adicionar** do Painel de Controle, ao lado de Tarefa, Evento, Prazo, Audiência e Parcelamento recorrente, entra a opção **Workflow**.

Ao escolher Workflow, abre o mesmo formulário de início de workflow já usado nas telas de processo e da Análise DJEN, permitindo:

- escolher a coordenação e o workflow ativo;
- vincular um processo (opcional, com busca);
- definir data de início, responsável inicial e observações.

Ao confirmar, a primeira demanda do fluxo é criada e o Painel de Controle é atualizado para exibi-la imediatamente. Fechar ou cancelar não cria nada.

## Detalhes técnicos

- `src/pages/PainelControle.tsx`: novo `DropdownMenuItem` "Workflow" (ícone `GitBranch`/`Workflow`) que liga um estado `workflowOpen`.
- Renderizar `IniciarWorkflowDialog` em modo `inline` dentro de um `Dialog` controlado por `workflowOpen`, usando `onDone` para fechar — o componente não expõe `open` controlado, então o wrapper cuida da abertura.
- Após iniciar, `await invalidateQueries` das chaves da agenda/tarefas já usadas na tela (`AGENDA_INFINITE_QUERY_KEY` e afins) antes de fechar, seguindo o padrão do projeto.
- Nenhuma alteração de banco ou de regra de negócio do workflow.
