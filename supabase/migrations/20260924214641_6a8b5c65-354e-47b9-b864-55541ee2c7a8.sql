DO $$
DECLARE d text;
BEGIN
  SELECT pg_get_functiondef('public.get_inteligencia_judit'::regproc) INTO d;
  d := replace(d, $a$with ult as (
  select distinct on (regexp_replace(processo_numero,'\D','','g'))
    regexp_replace(processo_numero,'\D','','g') num,
    raw_response
  from public.judit_logs
  where status in ('sucesso','success') and raw_response is not null
  order by regexp_replace(processo_numero,'\D','','g'), created_at desc
), inst as (
  select u.num, e->'response_data' d
  from ult u
  cross join lateral jsonb_array_elements(coalesce(u.raw_response->'_judit_raw'->'crawler'->'page_data','[]'::jsonb)) e
), base as (
  select distinct on (regexp_replace(b.processo,'\D','','g'))
    regexp_replace(b.processo,'\D','','g') num,
    coalesce(b.ganhamos,false) g,
    coalesce(b.perdemos,false) p,
    (b.acordo::text ilike 'true' or b.acordo::text ilike 'sim%') a
  from public.dados_benner b
  where (p_coordenacao_id is null or p_coordenacao_id = 'b0f690ad-68da-43d7-af5f-9adafeab3fd5'::uuid)
    and (p_equipe is null or trim(b.equipe) = p_equipe)
), j as (
  select i.*, b.g, b.p, b.a from inst i join base b using(num)
)$a$, $b$with logs as (
  select regexp_replace(processo_numero,'\D','','g') num, raw_response r
  from public.judit_logs
  where status in ('sucesso','success') and raw_response is not null
    and coalesce(processo_numero,'')<>''
), docs as (
  select num, e->'response_data' d from logs
    cross join lateral jsonb_array_elements(case when jsonb_typeof(r->'_judit_raw'->'crawler'->'page_data')='array' then r->'_judit_raw'->'crawler'->'page_data' else '[]'::jsonb end) e
  union all select num, r->'_judit_raw'->'response_data' from logs where jsonb_typeof(r->'_judit_raw'->'response_data')='object'
  union all select num, r->'_judit_raw' from logs where r->'_judit_raw' ? 'parties'
  union all select num, r->'response_data' from logs where jsonb_typeof(r->'response_data')='object'
  union all select num, r from logs where r ? 'parties' or r ? 'subjects'
), inst as (
  select distinct num, d from docs where jsonb_typeof(d)='object'
), base_tst as (
  select distinct on (regexp_replace(b.processo,'\D','','g'))
    regexp_replace(b.processo,'\D','','g') num,
    coalesce(b.ganhamos,false) g,
    coalesce(b.perdemos,false) p,
    (b.acordo::text ilike 'true' or b.acordo::text ilike 'sim%') a
  from public.dados_benner b
  where (p_coordenacao_id is null or p_coordenacao_id = 'b0f690ad-68da-43d7-af5f-9adafeab3fd5'::uuid)
    and (p_equipe is null or trim(b.equipe) = p_equipe)
), base_proc as (
  select distinct on (regexp_replace(p.numero,'\D','','g'))
    regexp_replace(p.numero,'\D','','g') num,
    (p.resultado::text ilike 'êxito%' or p.resultado::text ilike 'exito%') g,
    (p.resultado::text ilike 'sem êxito%' or p.resultado::text ilike 'sem exito%') p,
    (p.resultado::text ilike '%acordo%') a
  from public.processos p
  where p_equipe is null
    and (p_coordenacao_id is null or p.coordenacao_id = p_coordenacao_id
      or exists (select 1 from public.processos_coordenacoes_responsaveis r where r.processo_id=p.id and r.coordenacao_id=p_coordenacao_id))
), base as (
  select * from base_tst
  union all
  select bp.* from base_proc bp where not exists (select 1 from base_tst t where t.num=bp.num)
), j as (
  select i.num, i.d, coalesce(b.g,false) g, coalesce(b.p,false) p, coalesce(b.a,false) a
  from inst i left join base b using(num)
  where b.num is not null or (p_coordenacao_id is null and p_equipe is null)
)$b$);
  EXECUTE d;
END $$;