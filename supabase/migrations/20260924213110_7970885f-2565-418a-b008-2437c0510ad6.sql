create or replace function public.get_inteligencia_judit(p_coordenacao_id uuid default null, p_equipe text default null)
returns jsonb
language sql
stable
security definer
set search_path = public
set statement_timeout = '90s'
as $$
with ult as (
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
  where (p_coordenacao_id is null or b.coordenacao_id = p_coordenacao_id)
    and (p_equipe is null or trim(b.equipe) = p_equipe)
), j as (
  select i.*, b.g, b.p, b.a from inst i join base b using(num)
), adv as (
  select l->>'name' nome, max(doc->>'document') oab, count(distinct j.num) qtd,
    count(distinct j.num) filter (where g) ganhos,
    count(distinct j.num) filter (where p) perdidos,
    count(distinct j.num) filter (where a) acordos
  from j
  cross join lateral jsonb_array_elements(coalesce(d->'parties','[]')) pt
  cross join lateral jsonb_array_elements(coalesce(pt->'lawyers','[]')) l
  left join lateral (
    select x doc from jsonb_array_elements(coalesce(l->'documents','[]')) x
    where x->>'document_type'='oab' limit 1
  ) o on true
  where pt->>'side'='Active'
    and coalesce(trim(l->>'name'),'')<>''
    and coalesce(pt->>'name','') not ilike '%SANTANDER%'
  group by 1 order by qtd desc limit 30
), ass as (
  select s->>'name' nome, count(distinct j.num) qtd,
    count(distinct j.num) filter (where g) ganhos,
    count(distinct j.num) filter (where p) perdidos,
    count(distinct j.num) filter (where a) acordos
  from j cross join lateral jsonb_array_elements(coalesce(d->'subjects','[]')) s
  where coalesce(trim(s->>'name'),'')<>''
  group by 1 order by qtd desc limit 30
), vara_dados as (
  select trim(d->>'county') vara, max(nullif(trim(d->>'state'),'')) uf, count(distinct num) qtd,
    count(distinct num) filter (where g) ganhos,
    count(distinct num) filter (where p) perdidos
  from j
  where coalesce(trim(d->>'county'),'')<>''
    and upper(trim(d->>'county')) <> 'NÃO INFORMADO'
  group by 1 order by qtd desc limit 30
), uf_dados as (
  select trim(d->>'state') uf, count(distinct num) qtd,
    count(distinct num) filter (where g) ganhos,
    count(distinct num) filter (where p) perdidos
  from j
  where coalesce(trim(d->>'state'),'')<>''
    and upper(trim(d->>'state')) <> 'NÃO INFORMADO'
  group by 1 order by qtd desc
), juiz_dados as (
  select trim(d->>'judge') juiz, count(distinct num) qtd,
    count(distinct num) filter (where g) ganhos,
    count(distinct num) filter (where p) perdidos
  from j
  where jsonb_typeof(d->'judge') = 'string'
    and coalesce(trim(d->>'judge'),'')<>''
    and upper(trim(d->>'judge')) <> 'NÃO INFORMADO'
  group by 1 order by qtd desc limit 30
), passos as (
  select j.num, min((s->>'step_date')::timestamptz) ini,
    min((s->>'step_date')::timestamptz) filter (where s->>'content' ilike '%TRIBUNAL SUPERIOR DO TRABALHO%') tst
  from j cross join lateral jsonb_array_elements(coalesce(d->'steps','[]')) s
  where s->>'step_date' is not null
  group by 1
), tempo as (
  select count(*) amostra,
    round(avg(extract(epoch from tst-ini)/86400))::int media_dias_ate_tst,
    round((percentile_cont(0.5) within group (order by extract(epoch from tst-ini)/86400))::numeric)::int mediana_dias_ate_tst
  from passos where tst is not null and tst >= ini
)
select jsonb_build_object(
  'processos_com_judit',(select count(distinct num) from j),
  'processos_base',(select count(*) from base),
  'advogados',coalesce((select jsonb_agg(to_jsonb(a) order by a.qtd desc) from adv a),'[]'::jsonb),
  'assuntos',coalesce((select jsonb_agg(to_jsonb(a) order by a.qtd desc) from ass a),'[]'::jsonb),
  'varas',coalesce((select jsonb_agg(to_jsonb(v) order by v.qtd desc) from vara_dados v),'[]'::jsonb),
  'ufs',coalesce((select jsonb_agg(to_jsonb(u) order by u.qtd desc) from uf_dados u),'[]'::jsonb),
  'juizes',coalesce((select jsonb_agg(to_jsonb(z) order by z.qtd desc) from juiz_dados z),'[]'::jsonb),
  'tempo',(select to_jsonb(t) from tempo t)
)
$$;

revoke execute on function public.get_inteligencia_judit(uuid,text) from public, anon;
grant execute on function public.get_inteligencia_judit(uuid,text) to authenticated, service_role;