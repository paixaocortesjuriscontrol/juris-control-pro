# Aba Workflows de Minhas Responsabilidades: mais detalhes e Gerar Excel

## O que muda na lista
Cada linha continua sendo uma etapa em que a pessoa é responsável ou envolvida. Em vez de uma linha simples, cada uma passa a ser um cartão compacto com:

- **Fluxo e etapa:** nome do workflow, "Etapa N de T", título da etapa e tipo da atividade (Prazo, Tarefa, Evento ou Audiência) com a cor do tipo.
- **Prazo da etapa:** os dias previstos e os dias fatais configurados.
- **Regra de responsável:** Fixo, Etapa anterior ou Quem iniciou.
- **Coordenação e papel:** a pessoa aparece como Responsável ou Envolvido. Se o fluxo estiver desabilitado, a linha também mostra isso.
- **Andamento:** quantos fluxos desse workflow estão em andamento agora e quantos estão parados nesta etapa.
- **Última vez usado:** a data em que o fluxo foi iniciado pela última vez, em horário de Brasília (BRT).

Acima da lista ficam uma busca por nome e um filtro de papel (Todos, Responsável ou Envolvido). Os dois respeitam o filtro de Coordenação e o "Ver como" que já existem na tela.

Clicar na linha continua abrindo o painel lateral da etapa.

## Gerar Excel
O botão **Gerar Excel (N)** fica no topo da aba e gera a mesma planilha do menu Workflows, com as abas "Workflows" e "Resumo", o número do processo e as datas em BRT.

A planilha inclui os fluxos dos workflows que aparecem na lista filtrada e também os fluxos que a pessoa iniciou. Sem nenhum filtro, ela sai completa para essa pessoa. A busca, o papel e a coordenação escolhidos são respeitados.

## Fora do escopo
- O menu Workflows e o Painel de Controle não mudam.
- Nenhuma mudança no banco de dados e nenhuma alteração de permissões.

## Detalhes técnicos
- `src/pages/MinhasResponsabilidades.tsx`:
  - O select da query `workflows` é ampliado para trazer `tipo_item`, `dias_previsto`, `dias_fatal`, `regra_responsavel` e a contagem de etapas do workflow.
  - Uma nova query busca `workflow_execucoes` pelos `workflow_id` listados (em lotes de 100) e também pelas execuções com `iniciado_por = uid`, junto com `workflow_execucao_etapas` para contar quem está na etapa.
  - Para os rótulos do tipo, reutilizar `corKeyItem`.
- O Excel reutiliza `exportarWorkflowsExcel(execucoes, nomesCoord, {})` de `src/lib/exportWorkflowsExcel.ts`, sem duplicar código.
- Um teste novo cobre a seleção de execuções para o Excel: workflows da lista mais as iniciadas pela pessoa, sem repetir nenhuma, e respeitando a coordenação.
