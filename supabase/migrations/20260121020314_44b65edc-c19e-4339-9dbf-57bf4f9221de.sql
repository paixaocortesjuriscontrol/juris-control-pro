-- Remove duplicatas de tarefas DJEN com segurança (reaponta FKs antes de excluir)
-- Critério de duplicidade (somente DJEN): titulo normalizado + data(chave) + processo_id + responsavel_id

begin;

-- 1) Reapontar audiencias_detectadas
with base as (
  select
    t.id,
    t.created_at,
    lower(regexp_replace(trim(t.titulo), '\s+', ' ', 'g')) as titulo_norm,
    coalesce(t.data_vencimento::text, t.data_fatal::text, to_char(t.created_at::date, 'YYYY-MM-DD')) as data_key,
    coalesce(t.processo_id::text, '') as processo_key,
    coalesce(t.responsavel_id::text, '') as responsavel_key
  from public.tarefas t
  where t.titulo like '[DJEN]%' 
), ranked as (
  select
    id,
    first_value(id) over (partition by titulo_norm, data_key, processo_key, responsavel_key order by created_at desc) as keep_id,
    row_number() over (partition by titulo_norm, data_key, processo_key, responsavel_key order by created_at desc) as rn
  from base
), dupes as (
  select id, keep_id
  from ranked
  where rn > 1
)
update public.audiencias_detectadas a
set tarefa_id = d.keep_id
from dupes d
where a.tarefa_id = d.id;

-- 2) Reapontar intimacoes_detectadas
with base as (
  select
    t.id,
    t.created_at,
    lower(regexp_replace(trim(t.titulo), '\s+', ' ', 'g')) as titulo_norm,
    coalesce(t.data_vencimento::text, t.data_fatal::text, to_char(t.created_at::date, 'YYYY-MM-DD')) as data_key,
    coalesce(t.processo_id::text, '') as processo_key,
    coalesce(t.responsavel_id::text, '') as responsavel_key
  from public.tarefas t
  where t.titulo like '[DJEN]%' 
), ranked as (
  select
    id,
    first_value(id) over (partition by titulo_norm, data_key, processo_key, responsavel_key order by created_at desc) as keep_id,
    row_number() over (partition by titulo_norm, data_key, processo_key, responsavel_key order by created_at desc) as rn
  from base
), dupes as (
  select id, keep_id
  from ranked
  where rn > 1
)
update public.intimacoes_detectadas i
set tarefa_id = d.keep_id
from dupes d
where i.tarefa_id = d.id;

-- 3) Reapontar documentos
with base as (
  select
    t.id,
    t.created_at,
    lower(regexp_replace(trim(t.titulo), '\s+', ' ', 'g')) as titulo_norm,
    coalesce(t.data_vencimento::text, t.data_fatal::text, to_char(t.created_at::date, 'YYYY-MM-DD')) as data_key,
    coalesce(t.processo_id::text, '') as processo_key,
    coalesce(t.responsavel_id::text, '') as responsavel_key
  from public.tarefas t
  where t.titulo like '[DJEN]%' 
), ranked as (
  select
    id,
    first_value(id) over (partition by titulo_norm, data_key, processo_key, responsavel_key order by created_at desc) as keep_id,
    row_number() over (partition by titulo_norm, data_key, processo_key, responsavel_key order by created_at desc) as rn
  from base
), dupes as (
  select id, keep_id
  from ranked
  where rn > 1
)
update public.documentos doc
set tarefa_id = d.keep_id
from dupes d
where doc.tarefa_id = d.id;

-- 4) Reapontar comentarios_tarefas
with base as (
  select
    t.id,
    t.created_at,
    lower(regexp_replace(trim(t.titulo), '\s+', ' ', 'g')) as titulo_norm,
    coalesce(t.data_vencimento::text, t.data_fatal::text, to_char(t.created_at::date, 'YYYY-MM-DD')) as data_key,
    coalesce(t.processo_id::text, '') as processo_key,
    coalesce(t.responsavel_id::text, '') as responsavel_key
  from public.tarefas t
  where t.titulo like '[DJEN]%' 
), ranked as (
  select
    id,
    first_value(id) over (partition by titulo_norm, data_key, processo_key, responsavel_key order by created_at desc) as keep_id,
    row_number() over (partition by titulo_norm, data_key, processo_key, responsavel_key order by created_at desc) as rn
  from base
), dupes as (
  select id, keep_id
  from ranked
  where rn > 1
)
update public.comentarios_tarefas c
set tarefa_id = d.keep_id
from dupes d
where c.tarefa_id = d.id;

-- 5) Excluir duplicatas (mantém o mais recente)
with base as (
  select
    t.id,
    t.created_at,
    lower(regexp_replace(trim(t.titulo), '\s+', ' ', 'g')) as titulo_norm,
    coalesce(t.data_vencimento::text, t.data_fatal::text, to_char(t.created_at::date, 'YYYY-MM-DD')) as data_key,
    coalesce(t.processo_id::text, '') as processo_key,
    coalesce(t.responsavel_id::text, '') as responsavel_key
  from public.tarefas t
  where t.titulo like '[DJEN]%' 
), ranked as (
  select
    id,
    row_number() over (partition by titulo_norm, data_key, processo_key, responsavel_key order by created_at desc) as rn
  from base
)
delete from public.tarefas t
using ranked r
where t.id = r.id
  and r.rn > 1;

commit;