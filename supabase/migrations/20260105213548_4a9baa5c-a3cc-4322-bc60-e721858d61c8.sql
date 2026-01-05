-- Renomear a constraint da FK para o novo nome
ALTER TABLE public.tarefas 
RENAME CONSTRAINT prazos_processo_id_fkey TO tarefas_processo_id_fkey;

-- Também renomear as constraints de FK para criado_por e responsavel_id se existirem
ALTER TABLE public.tarefas 
RENAME CONSTRAINT prazos_criado_por_fkey TO tarefas_criado_por_fkey;

ALTER TABLE public.tarefas 
RENAME CONSTRAINT prazos_responsavel_id_fkey TO tarefas_responsavel_id_fkey;