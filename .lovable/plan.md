# Título das tarefas vindas do Projuris

## Causa (conferida no código da importação)
O problema não aconteceu por falta dos modelos de tarefa. A importação do backup sempre usa a **descrição da tarefa** do Projuris como título, e só recorre ao campo de título quando a descrição está vazia. Por isso, cada tarefa ganhou um título diferente. No Projuris, o "título" é o próprio **tipo de tarefa**, que é parametrizado.

## O que será feito
1. **Título = tipo de tarefa do Projuris.** A tarefa importada passa a ter como título o nome do tipo, por exemplo "Contestação". Se a tarefa não tiver tipo, o sistema usa o título do Projuris e, em último caso, a descrição.
2. **Descrição no lugar certo.** O texto que hoje está no título passa para a descrição da tarefa, sem perder nada.
3. **Corrigir as tarefas já importadas.** Ao rodar de novo a etapa **Tarefas** do Backup completo, as tarefas já migradas recebem o título correto e a descrição. Nada é criado em dobro, e o vínculo com o modelo de tarefa continua sendo gravado.
4. A conferência antes de importar mostra o título novo.

## Detalhes técnicos
- `BackupCompletoProjuris.tsx`: o título vem de `tarefatipo` (nome pelo `cdtarefatipo`, mapa `tipoTarefaNome` já carregado), depois de `detitulo` e por último de `detarefa`. A descrição vem de `detarefa` (confiro o nome da coluna de descrição em `tarefas` antes).
- A classificação de audiência/prazo (`classificarTipo`) continua olhando o texto original, para não mudar a regra de audiência exigir o título.
- O controle de "já cadastrada (mesmo título e data)" passa a considerar o título novo e o antigo, para não duplicar.
- Atualização das já migradas por `identificador_projuris`, em lotes de 100, só nas tarefas `origem = projuris` da coordenação. Função pura com teste do título escolhido.
