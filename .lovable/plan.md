# Iniciar Workflow pela publicação da Análise DJEN

A necessidade da Jéssica é usar o Workflow como um **modelo reutilizável para qualquer processo**: ao analisar uma publicação, a usuária escolhe um fluxo, confirma os dados e o sistema inicia aquela sequência para o processo da publicação. Não será uma configuração presa a um processo específico.

## Como vai funcionar

1. No botão **Adicionar** de cada publicação da tela **Análise DJEN**, incluir a opção **Workflow** junto de Tarefa, Evento, Prazo e Audiência.
2. Ao escolher **Workflow**:
   - localizar ou criar o cadastro do processo usando o mesmo comportamento já usado pelos demais itens da publicação;
   - abrir o formulário dentro da própria tela de análise;
   - listar somente os workflows ativos da coordenação daquela publicação/processo;
   - mostrar o processo já preenchido e vinculado, sem exigir nova busca manual;
   - permitir escolher o workflow, a data de início, o responsável inicial e as observações antes de executar.
3. Ao confirmar, iniciar uma nova execução independente daquele workflow para o processo da publicação. Exemplo:
   - na publicação do processo A, escolher o fluxo “Acórdão ED → Acórdão RR”;
   - criar a primeira demanda “ACÓRDÃO - ED” vinculada ao processo A;
   - quando essa etapa for concluída com sucesso, o mecanismo atual cria “ACÓRDÃO - RR” para o mesmo processo A;
   - o mesmo fluxo poderá ser usado novamente em publicações dos processos B, C etc.
4. Manter o início manual de workflow nas outras telas com processo opcional; a obrigatoriedade ocorrerá somente nesse caminho da publicação, porque ali o processo já é conhecido.
5. Após iniciar, mostrar o primeiro item no quadro **Itens criados a partir desta publicação**, atualizar o Painel de Controle e oferecer o mesmo retorno visual dos demais itens criados nessa tela.

## Regras e proteções

- A publicação selecionada será preservada como origem da execução e do primeiro item criado, permitindo rastrear de onde a demanda nasceu.
- Se a publicação não tiver número de processo válido ou o processo não puder ser localizado/criado, o workflow não será iniciado e a tela mostrará o motivo.
- A coordenação da execução será a da publicação/processo, preservando o isolamento entre equipes.
- Cada clique confirmado cria apenas uma execução; o envio ficará bloqueado enquanto estiver processando para evitar duplicidade.
- As etapas seguintes continuarão obedecendo às condições, prazos e responsáveis configurados no workflow.

## Detalhes técnicos

- Reutilizar o fluxo de `handleAdicionarClick` da Análise DJEN para resolver o processo e abrir `IniciarWorkflowDialog` em modo inline.
- Estender o menu e o formulário inline de `AnaliseDjen.tsx` para tratar `workflow` como mais um tipo de adição.
- Adaptar `IniciarWorkflowDialog` para receber a publicação de origem e bloquear a alteração do processo nesse contexto.
- Fazer `useIniciarWorkflow` retornar também os dados do primeiro item materializado, possibilitando atualizar imediatamente o quadro de itens e os caches após `await invalidateQueries`.
- Registrar o vínculo entre a publicação e o primeiro item nas tabelas de relacionamento já usadas pela Análise DJEN quando o tipo permitir; manter também a referência da publicação na execução para rastreabilidade genérica entre tipos.
- Migração em `workflow_execucoes` para guardar a publicação de origem de forma compatível com as origens “termo” e “processo”, com índices, GRANTs existentes preservados e RLS já aplicada por coordenação.
- Validar o cenário completo: publicação → escolha do workflow → primeira etapa com processo → conclusão da primeira etapa → próxima etapa com o mesmo processo.
