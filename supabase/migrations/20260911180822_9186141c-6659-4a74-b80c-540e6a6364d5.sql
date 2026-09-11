
create or replace function public.get_monitoramento_counts()
returns table(movimentacoes bigint, divergencias bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_admin boolean;
begin
  if v_uid is null then
    return query select 0::bigint, 0::bigint;
    return;
  end if;

  v_admin := public.has_role(v_uid, 'admin');

  if v_admin then
    return query
      select (select count(*) from acompanhamento_especial_eventos where lido_em is null),
             (select count(*) from acompanhamento_especial_divergencias where resolvido_em is null);
    return;
  end if;

  return query
  with coord as (
    select coordenacao_id as id from membros_coordenacao where usuario_id = v_uid
    union
    select c.id from coordenacoes c where c.coordenador_id = v_uid
  ),
  scope as (
    select processo_id as pid from processos_responsaveis where usuario_id = v_uid and ativo
    union
    select p.id from processos p where p.acompanhamento_especial and p.coordenacao_id in (select id from coord)
    union
    select pcr.processo_id from processos_coordenacoes_responsaveis pcr where pcr.coordenacao_id in (select id from coord)
  )
  select (select count(*) from acompanhamento_especial_eventos e where e.lido_em is null and e.processo_id in (select pid from scope)),
         (select count(*) from acompanhamento_especial_divergencias d where d.resolvido_em is null and d.processo_id in (select pid from scope));
end;
$$;

grant execute on function public.get_monitoramento_counts() to authenticated;
