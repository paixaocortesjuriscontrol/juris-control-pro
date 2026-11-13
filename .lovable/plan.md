# Limpeza da Coordenação Santander Cível (antes do novo backup Projuris)

## Situação atual (Coordenação Santander Cível)
- 16.967 processos
- 98.883 tarefas/prazos
- 2.205 audiências
- 485 eventos
- 14.262 execuções de workflow
- 5.847 tarefas e 854 audiências de OUTRAS coordenações estão ligadas a processos do Santander Cível
- 3 tarefas do Santander Cível estão em processos de outras coordenações

## O que será apagado (somente Santander Cível)
1. Todas as tarefas, prazos, audiências e eventos da coordenação, com seus vínculos (responsáveis, envolvidos, comentários, checklists, etiquetas aplicadas, ligações com publicações).
2. Todas as execuções de workflow da coordenação (os modelos de workflow ficam).
3. Os processos da coordenação, EXCETO os que têm algum item de outra coordenação ligado — esses processos ficam, para não afetar as outras equipes. Ao final informo quantos ficaram.

## O que NÃO será tocado
- Nada de outras coordenações.
- Usuários, membros, cargos, permissões, configurações, modelos de tarefas, modelos de workflow, etiquetas cadastradas, clientes, monitoramentos e publicações DJEN.
- Histórico de auditoria de migrações Projuris anteriores fica como está (a nova importação usa o mesmo controle de duplicidade).

## Segurança
- Antes de apagar, cópia completa de tudo que será removido em tabelas de backup próprias (com data 13/11/2026), permitindo restaurar.
- Execução em lotes para não travar o sistema, conferindo as contagens antes e depois.
- Relatório final com números apagados e preservados.

## Detalhes técnicos
- Coordenação: 968631d0-6659-46f1-b45d-899892cb0121.
- Backup via `create table backup_limpeza_santander_<tabela> as select ...` para processos, tarefas, audiencias_detectadas, eventos_agenda, workflow_execucoes e tabelas filhas.
- Ordem: filhos dos itens → itens (filtro `coordenacao_id`) → workflow_execucao_etapas/workflow_execucoes → processos sem itens externos (checar FKs de todas as tabelas que referenciam processos e remover só linhas da coordenação).
- Triggers de auditoria/notificação: desabilitar a fila de notificações durante a operação para não disparar avisos de exclusão aos usuários.
- Projuris: limpar `chave_externa 'projuris:%'` apenas nas linhas apagadas, para a reimportação não pular itens.
