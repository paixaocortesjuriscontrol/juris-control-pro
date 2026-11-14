# Importar "Tarefas decorrentes de workflows" (Santander Cível)

## O que a planilha traz
- 316 atividades válidas (1 linha vazia): **212 prazos** e **104 tarefas**, todas pendentes.
- 193 processos (coluna "Processo Vinculado" + identificador PRO.).
- 15 responsáveis (JULIA MACRI 102, Raabe Almeida 100, LÍDIA ARAÚJO 33, SANNY ALVES 25...).
- Marcadores em 29 linhas (OUTLIER, URGENTE, PAP...), observação, data de inclusão, data fatal e data prevista.
- **Diferença importante:** esta planilha **não tem o identificador TAR.** da atividade (a coluna veio vazia). Só existe o PRO. do processo.

## O que vou fazer
Nova opção **"Tarefas de workflows"** na tela Migração Projuris, igual às de Agenda Futura e Compromissos:
- Tipo vem da coluna CLASSIFICAÇÃO (PRAZO → prazo, TAREFA → tarefa). Tudo na Coordenação Santander Cível, pendente.
- Vincula ao processo pelo número; se não existir, cria o processo no Santander Cível com partes e cliente da planilha, guardando o PRO.
- Responsáveis reconhecidos pelo nome, inclusive grafia parecida (ex.: "Raabe Almeida").
- Ligado ao modelo de tarefa da coordenação com o mesmo título, quando existir.
- Marcadores viram etiquetas da coordenação.
- Observação vai para a descrição, com "Importado Projuris".
- **Sem duplicar:** como não há TAR., a chave será processo + título + data fatal. Se já existir atividade igual (por exemplo, vinda da Agenda Futura), ela é pulada e aparece no relatório.
- Barra de progresso, botão Cancelar, relatório Excel no final (criados, pulados por já existirem, pessoas não encontradas, processos criados) e "Desfazer lote".

## Detalhes técnicos
- Novo `src/components/migracao/tarefasWorkflowProjuris.ts` (parser + chave) com testes, e `ImportarTarefasWorkflowProjuris.tsx` reaproveitando o padrão de `ImportarCompromissosProjuris.tsx`.
- Itens registrados em `migracoes_projuris_itens` (tipo prazo/tarefa, chave_externa `wf:<PRO>:<titulo>:<data>`), PRO. em `processos` como hoje.
- Regra registrada em `src/components/migracao/AGENTS.md`.
- Você roda a importação pela tela (não tenho acesso de gravação daqui).
