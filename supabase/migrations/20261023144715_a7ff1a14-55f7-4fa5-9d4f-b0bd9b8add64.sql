CREATE OR REPLACE FUNCTION public.get_acomp_especial_eventos(_somente_nao_lidas boolean DEFAULT false, _desde timestamp with time zone DEFAULT NULL, _ate timestamp with time zone DEFAULT NULL, _limit integer DEFAULT 2000)
 RETURNS TABLE(id uuid, processo_id uuid, step_date timestamp with time zone, criado_em timestamp with time zone, conteudo text, instancia text, tribunal text, anexos_count integer, lido_em timestamp with time zone, retroativo boolean, numero text, polo_ativo text, polo_passivo text, coordenacao_id uuid)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_uid uuid := auth.uid(); v_admin boolean;
begin
  if v_uid is null then return; end if;
  v_admin := public.has_role(v_uid, 'admin');
  return query
  select e.id, e.processo_id, e.step_date, e.criado_em, e.conteudo, e.instancia, e.tribunal,
         e.anexos_count, coalesce(e.lido_em, l.lido_em), e.retroativo,
         p.numero, p.polo_ativo, p.polo_passivo, p.coordenacao_id
  from acompanhamento_especial_eventos e
  left join processos p on p.id = e.processo_id
  left join acompanhamento_especial_leituras l on l.evento_id = e.id and l.user_id = v_uid
  where (not _somente_nao_lidas or (e.lido_em is null and l.id is null))
    and (_desde is null or e.criado_em >= _desde)
    and (_ate is null or e.criado_em <= _ate)
    and (v_admin or e.processo_id in (select public.escopo_acompanhamento_especial(v_uid)))
  order by e.criado_em desc
  limit coalesce(_limit, 2000);
end; $function$;

CREATE OR REPLACE FUNCTION public.get_monitoramento_counts()
 RETURNS TABLE(movimentacoes bigint, divergencias bigint)
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_uid uuid := auth.uid(); v_admin boolean;
begin
  if v_uid is null then return query select 0::bigint, 0::bigint; return; end if;
  v_admin := public.has_role(v_uid, 'admin');
  if v_admin then
    return query
      select (select count(*) from acompanhamento_especial_eventos e where e.lido_em is null
               and not exists (select 1 from acompanhamento_especial_leituras l where l.evento_id=e.id and l.user_id=v_uid)),
             (select count(*) from acompanhamento_especial_divergencias where resolvido_em is null);
    return;
  end if;
  return query
  with coord as (
    select coordenacao_id as id from membros_coordenacao where usuario_id = v_uid
    union select c.id from coordenacoes c where c.coordenador_id = v_uid
  ), scope as (
    select processo_id as pid from processos_responsaveis where usuario_id = v_uid and ativo
    union select p.id from processos p where p.acompanhamento_especial and p.coordenacao_id in (select id from coord)
    union select pcr.processo_id from processos_coordenacoes_responsaveis pcr where pcr.coordenacao_id in (select id from coord)
  )
  select (select count(*) from acompanhamento_especial_eventos e where e.lido_em is null and e.processo_id in (select pid from scope)
           and not exists (select 1 from acompanhamento_especial_leituras l where l.evento_id=e.id and l.user_id=v_uid)),
         (select count(*) from acompanhamento_especial_divergencias d where d.resolvido_em is null and d.processo_id in (select pid from scope));
end; $function$;

CREATE OR REPLACE FUNCTION public.marcar_acomp_especial_lidas(_ids uuid[] DEFAULT NULL)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare v_uid uuid := auth.uid(); v_admin boolean; n integer;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  v_admin := public.has_role(v_uid, 'admin');
  insert into acompanhamento_especial_leituras(evento_id, user_id)
  select e.id, v_uid from acompanhamento_especial_eventos e
  where e.lido_em is null
    and (_ids is null or e.id = any(_ids))
    and (v_admin or e.processo_id in (select public.escopo_acompanhamento_especial(v_uid)))
  on conflict (evento_id, user_id) do nothing;
  get diagnostics n = row_count;
  return n;
end; $function$;
GRANT EXECUTE ON FUNCTION public.marcar_acomp_especial_lidas(uuid[]) TO authenticated;