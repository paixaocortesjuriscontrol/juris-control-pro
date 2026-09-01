# Remover os gatilhos residuais de criação automática de tarefas

## Contexto verificado

- O card `[PRAZO FATAL] 0011096-36.2021.5.15.0033` é virtual: vem do campo Data Fatal do processo, não há registro em tarefas nem em eventos.
- No banco ainda existem gatilhos que podem criar tarefa sozinhos a partir de intimações e audiências detectadas: `trigger_criar_tarefa_intimacao` (tabela `intimacoes_detectadas`) e `trigger_criar_tarefa_audiencia` (tabela `audiencias_detectadas`), ambos habilitados.
- Nos últimos 45 dias eles praticamente não atuaram: 0 intimações com tarefa vinculada e 1 audiência com tarefa (05/08). Nenhuma tarefa criada sem autor fora de importação (Astrea/Projuris).

## O que muda

- Os dois gatilhos de criação automática de tarefa são removidos do banco. Nenhuma tarefa passa a ser criada sozinha a partir de intimações ou audiências detectadas.
- As funções correspondentes também são removidas, para não sobrar caminho de reativação por engano.
- Nada é apagado: intimações, audiências e as tarefas já existentes permanecem intactas, inclusive a única audiência que tinha tarefa vinculada.
- A detecção de intimações e audiências continua funcionando normalmente (os registros continuam sendo gravados); apenas deixa de gerar tarefa automática.
- A Data Fatal do processo continua aparecendo no calendário como hoje (item virtual, sem gravar nada).

## Detalhes técnicos

Migração única:

- `DROP TRIGGER IF EXISTS trigger_criar_tarefa_intimacao ON public.intimacoes_detectadas;`
- `DROP TRIGGER IF EXISTS trigger_criar_tarefa_audiencia ON public.audiencias_detectadas;`
- `DROP FUNCTION IF EXISTS public.criar_tarefa_automatica_intimacao();`
- `DROP FUNCTION IF EXISTS public.criar_tarefa_automatica_audiencia();`

Os gatilhos `trg_bloquear_intimacao_automatica`, `trg_bloquear_audiencia_automatica` e `trigger_prevent_duplicate_tarefas` são mantidos (são travas de proteção, não criam nada).

Após a migração, registrar em memória do projeto que a criação automática de tarefas por intimação/audiência está removida no banco e não deve ser reintroduzida.
