create or replace function public.escopo_acompanhamento_especial(_uid uuid)
returns setof uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  with coord as (
    select coordenacao_id as id from membros_coordenacao where usuario_id = _uid
    union
    select c.id from coordenacoes c where c.coordenador_id = _uid
  )
  select processo_id from processos_responsaveis where usuario_id = _uid and ativo
  union
  select p.id from processos p where p.acompanhamento_especial and p.coordenacao_id in (select id from coord)
  union
  select pcr.processo_id from processos_coordenacoes_responsaveis pcr where pcr.coordenacao_id in (select id from coord)
$$;

grant execute on function public.escopo_acompanhamento_especial(uuid) to authenticated;

create or replace function public.get_acomp_especial_divergencias(
  _somente_pendentes boolean default true,
  _desde timestamptz default null,
  _ate timestamptz default null,
  _limit integer default 2000
)
returns table(
  id uuid,
  processo_id uuid,
  processo_numero text,
  campo text,
  valor_atual text,
  valor_judit text,
  detectado_em timestamptz,
  resolvido_em timestamptz,
  numero text,
  polo_ativo text,
  polo_passivo text,
  coordenacao_id uuid
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_admin boolean;
begin
  if v_uid is null then
    return;
  end if;
  v_admin := public.has_role(v_uid, 'admin');

  return query
  select d.id, d.processo_id, d.processo_numero, d.campo, d.valor_atual, d.valor_judit,
         d.detectado_em, d.resolvido_em,
         p.numero, p.polo_ativo, p.polo_passivo, p.coordenacao_id
  from acompanhamento_especial_divergencias d
  left join processos p on p.id = d.processo_id
  where (not _somente_pendentes or d.resolvido_em is null)
    and (_desde is null or d.detectado_em >= _desde)
    and (_ate is null or d.detectado_em <= _ate)
    and (v_admin or d.processo_id in (select public.escopo_acompanhamento_especial(v_uid)))
  order by d.detectado_em desc
  limit coalesce(_limit, 2000);
end;
$$;

grant execute on function public.get_acomp_especial_divergencias(boolean, timestamptz, timestamptz, integer) to authenticated;

create or replace function public.get_acomp_especial_eventos(
  _somente_nao_lidas boolean default false,
  _desde timestamptz default null,
  _ate timestamptz default null,
  _limit integer default 2000
)
returns table(
  id uuid,
  processo_id uuid,
  step_date timestamptz,
  criado_em timestamptz,
  conteudo text,
  instancia text,
  tribunal text,
  anexos_count integer,
  lido_em timestamptz,
  retroativo boolean,
  numero text,
  polo_ativo text,
  polo_passivo text,
  coordenacao_id uuid
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_admin boolean;
begin
  if v_uid is null then
    return;
  end if;
  v_admin := public.has_role(v_uid, 'admin');

  return query
  select e.id, e.processo_id, e.step_date, e.criado_em, e.conteudo, e.instancia, e.tribunal,
         e.anexos_count, e.lido_em, e.retroativo,
         p.numero, p.polo_ativo, p.polo_passivo, p.coordenacao_id
  from acompanhamento_especial_eventos e
  left join processos p on p.id = e.processo_id
  where (not _somente_nao_lidas or e.lido_em is null)
    and (_desde is null or e.criado_em >= _desde)
    and (_ate is null or e.criado_em <= _ate)
    and (v_admin or e.processo_id in (select public.escopo_acompanhamento_especial(v_uid)))
  order by e.criado_em desc
  limit coalesce(_limit, 2000);
end;
$$;

grant execute on function public.get_acomp_especial_eventos(boolean, timestamptz, timestamptz, integer) to authenticated;