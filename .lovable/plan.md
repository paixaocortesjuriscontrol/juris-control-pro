# Data de corte na Migração Projuris

## Regra
- No topo da tela de Migração Projuris entra o campo **Data de corte**, que é opcional.
- Com a data preenchida, nenhuma atividade com data **depois** do corte entra no sistema. Isso vale para tarefas, prazos, atas, audiências, eventos e etapas de workflow.
- A comparação usa a **data da atividade**, nunca a de cadastro no Projuris:
  - **Prazo:** a data fatal.
  - **Tarefa:** a data limite ou a data prevista.
  - **Audiência e evento:** o dia em que acontecem.
- A atividade do próprio dia do corte entra. Com corte em 13/11, entra o que vence até 13/11 às 23h59 (BRT).
- Uma atividade sem nenhuma data entra normalmente. Ela aparece como "sem data" no resumo final.
- Processos, anexos, comentários, andamentos, checklists e marcadores não são cortados, porque não são atividades.
- No resumo de cada importação aparece a contagem **"Ignoradas pela data de corte: N"**, e o Excel de conferência lista essas atividades.
- A data escolhida fica gravada em cada lote importado, para a auditoria.

## Onde vale
Vale em todas as importações de atividades da tela:
- Backup completo, na etapa de tarefas e workflows.
- Importação simples de tarefas.
- Agenda futura.
- Compromissos.
- Tarefas de workflows.
- Execuções de workflow, nas etapas abertas.

## Detalhes técnicos
- Novo helper `src/components/migracao/dataCorteProjuris.ts` com `passaDoCorte(item, corte)`. Ele escolhe a data na ordem: data fatal, limite, prevista, início. O fim do dia é calculado em BRT.
- O estado `dataCorte` fica na página de migração e é passado por prop a cada componente de importação. O filtro roda antes de qualquer gravação.
- Os itens cortados não são registrados em `migracoes_projuris_itens`, para que uma rodada futura com outro corte possa importá-los.
- A data de corte fica no `metadata` de `migracoes_projuris`, sem mudança no banco.
- Testes de `passaDoCorte`: dia do corte entra, dia seguinte sai, atividade sem data entra, e a prioridade da data fatal sobre a prevista.
