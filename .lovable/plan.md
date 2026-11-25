# Corrigir conferência da Migração Projuris (tarefas)

## O que foi confirmado
- Há **102.005** registros de "tarefa migrada" no histórico da migração, mas só **3.330** dessas tarefas ainda existem. As outras ~98 mil foram apagadas, mas o histórico continuou lá. Por isso a tela diz "Já migrada antes: 97.330".
- A data de corte só é aplicada na hora de gravar. A conferência não separa o que passa da data, então "Será importado: 6.146" inclui atividades posteriores ao corte. Ao gravar, essas ficam de fora, mas os números da tela confundem.

## O que vou fazer
1. **"Já migrada antes" só conta se a tarefa ainda existe.** Se ela foi apagada, a tarefa volta para "Será importado".
2. **Limpar o histórico órfão:** apagar só os registros de tarefas migradas que não existem mais (cerca de 98 mil). Antes, guardo uma cópia de segurança. As 3.330 tarefas que existem não são tocadas.
3. **Data de corte na conferência:** uma nova linha "Ignoradas pela data de corte" (mostrada quando houver corte), e esses itens saem de "Será importado" e do botão Importar. Vale também para processos sem atividade e andamentos, se tiverem data.
4. O botão deixa de dizer "corrigir títulos de N já migradas" quando há data de corte, porque nesse caso as existentes não são alteradas.

## Detalhes técnicos
- `BackupCompletoProjuris.tsx`: na busca em `migracoes_projuris_itens` (tipo tarefa, status criado), trazer também `registro_id` e confirmar a existência em `tarefas` em lotes. Calcular o motivo "Ignorada pela data de corte" com `passaDoCorte` já na montagem de `tarefasRows`, antes de "Será importado".
- Faço a limpeza com `run_sql` e um backup em uma tabela `backup_migracoes_projuris_itens_orfaos_20261125`, sem alterar a estrutura das tabelas.
- Teste: uma tarefa auditada que foi apagada não conta como migrada; uma atividade depois do corte sai da contagem.
