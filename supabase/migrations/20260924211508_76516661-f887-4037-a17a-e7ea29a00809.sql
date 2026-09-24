create or replace function public.get_inteligencia_judit(p_coordenacao_id uuid default null, p_equipe text default null)
returns jsonb language sql stable security definer set search_path=public as $$
with ult as (
  select distinct on (regexp_replace(processo_numero,'\D','','g')) regexp_replace(processo_numero,'\D','','g') num, raw_response
  from judit_logs where status in ('sucesso','success') and raw_response is not null
  order by regexp_replace(processo_numero,'\D','','g'), created_at desc
), inst as (
  select u.num, e->'response_data' d from ult u,
  jsonb_array_elements(coalesce(u.raw_response->'_judit_raw'->'crawler'->'page_data','[]'::jsonb)) e
), base as (
  select distinct on (regexp_replace(b.processo,'\D','','g')) regexp_replace(b.processo,'\D','','g') num,
    coalesce(b.ganhamos,false) g, coalesce(b.perdemos,false) p,
    (b.acordo::text ilike 'true' or b.acordo::text ilike 'sim%') a
  from dados_benner b
  where (p_coordenacao_id is null or b.coordenacao_id=p_coordenacao_id)
    and (p_equipe is null or trim(b.equipe)=p_equipe)
), j as (select i.*, b.g, b.p, b.a from inst i join base b using(num)),
adv as (
  select l->>'name' nome, max(doc->>'document') oab, count(distinct j.num) qtd,
    count(distinct j.num) filter (where g) ganhos, count(distinct j.num) filter (where p) perdidos, count(distinct j.num) filter (where a) acordos
  from j, jsonb_array_elements(coalesce(d->'parties','[]')) pt, jsonb_array_elements(coalesce(pt->'lawyers','[]')) l
  left join lateral (select x doc from jsonb_array_elements(coalesce(l->'documents','[]')) x where x->>'document_type'='oab' limit 1) o on true
  where pt->>'side'='Active' and coalesce(l->>'name','')<>'' and pt->>'name' not ilike '%SANTANDER%'
  group by 1 order by qtd desc limit 30
), ass as (
  select s->>'name' nome, count(distinct j.num) qtd,
    count(distinct j.num) filter (where g) ganhos, count(distinct j.num) filter (where p) perdidos, count(distinct j.num) filter (where a) acordos
  from j, jsonb_array_elements(coalesce(d->'subjects','[]')) s where coalesce(s->>'name','')<>''
  group by 1 order by qtd desc limit 30
), vara as (
  select coalesce(nullif(d->>'county',''),'?') vara, max(d->>'state') uf, count(distinct num) qtd,
    count(distinct num) filter (where g) ganhos, count(distinct num) filter (where p) perdidos
  from j where coalesce(d->>'county','') not in ('','NÃO INFORMADO') group by 1 order by qtd desc limit 30
), uf as (
  select d->>'state' uf, count(distinct num) qtd, count(distinct num) filter (where g) ganhos, count(distinct num) filter (where p) perdidos
  from j where coalesce(d->>'state','')<>'' group by 1 order by qtd desc
), juiz as (
  select d->>'judge' juiz, count(distinct num) qtd, count(distinct num) filter (where g) ganhos, count(distinct num) filter (where p) perdidos
  from j where coalesce(d->>'judge','') not in ('','NÃO INFORMADO') group by 1 order by qtd desc limit 30
), passos as (
  select j.num, min((s->>'step_date')::timestamptz) ini,
    min((s->>'step_date')::timestamptz) filter (where s->>'content' ilike '%TRIBUNAL SUPERIOR DO TRABALHO%') tst
  from j, jsonb_array_elements(coalesce(d->'steps','[]')) s where s->>'step_date' is not null group by 1
), tempo as (
  select count(*) amostra,
    round(avg(extract(epoch from tst-ini)/86400))::int media_dias_ate_tst,
    round((percentile_cont(0.5) within group (order by extract(epoch from tst-ini)/86400))::numeric)::int mediana_dias_ate_tst
  from passos where tst is not null
)
select jsonb_build_object(
  'processos_com_judit',(select count(distinct num) from j),
  'processos_base',(select count(*) from base),
  'advogados',coalesce((select jsonb_agg(to_jsonb(adv)) from adv),'[]'),
  'assuntos',coalesce((select jsonb_agg(to_jsonb(ass)) from ass),'[]'),
  'varas',coalesce((select jsonb_agg(to_jsonb(vara)) from vara),'[]'),
  'ufs',coalesce((select jsonb_agg(to_jsonb(uf)) from uf),'[]'),
  'juizes',coalesce((select jsonb_agg(to_jsonb(juiz)) from juiz),'[]'),
  'tempo',(select to_jsonb(tempo) from tempo))
$$;
revoke execute on function public.get_inteligencia_judit(uuid,text) from public, anon;
grant execute on function public.get_inteligencia_judit(uuid,text) to authenticated, service_role;