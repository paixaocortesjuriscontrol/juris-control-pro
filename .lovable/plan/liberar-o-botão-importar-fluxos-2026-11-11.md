# Liberar o botão "Importar fluxos"

O botão só liga quando os 4 arquivos são reconhecidos. Hoje falta o etapaworkflow.csv. Os arquivos escolhidos vão se somando, então dá para escolher só esse arquivo depois dos outros três.

## O que muda
1. Aceitar o arquivo de etapas mesmo com o nome escrito diferente (ex.: "etapaworflow", "etapa_workflow", "etapaworkflow (1)"). O etapaworkflowtarefa.csv não deve ser confundido com ele.
2. Mostrar abaixo do campo os arquivos escolhidos que não foram usados (ex.: "ignorado: workflowgatilhoautomatico.csv"), para ficar claro o que falta.
3. Explicar no texto do cartão que o etapaworkflowtarefa.csv e o workflowgatilhoautomatico.csv não são necessários.

## Detalhes técnicos
- Em `ImportarExecucoesWorkflowProjuris.tsx`, `escolher`: normalizar o nome removendo separadores e mapear aliases (`etapaworflow`, `etapasworkflow`) para `etapaworkflow`; guardar a lista de nomes não reconhecidos num estado e exibi-la.
- A importação continua igual.
