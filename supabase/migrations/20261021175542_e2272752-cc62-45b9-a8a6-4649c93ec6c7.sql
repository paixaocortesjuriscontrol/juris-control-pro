create or replace function public.relatorio_publicacoes_lidas(p_ini timestamptz, p_fim timestamptz, p_coord uuid default null)
returns table(lida_em timestamptz, usuario text, data_publicacao date, processo text, tribunal text, origem text, coordenacao_id uuid)
language sql stable security definer set search_path = public as $$
  with acesso as (
    select c.id from coordenacoes c
    where exists (select 1 from user_roles r where r.user_id = auth.uid() and r.role = 'admin')
       or exists (select 1 from membros_coordenacao m where m.coordenacao_id = c.id and m.usuario_id = auth.uid())
  ), pubs as (
    select id, data_publicacao::date dp, processo_numero, tribunal, coordenacao_id, 'termo'::text o from publicacoes_djen
    union all select id, data_publicacao::date, processo_numero, tribunal, coordenacao_id, 'processo' from publicacoes_djen_processos
    union all select id, data_publicacao::date, processo_numero, tribunal, coordenacao_id, 'descartada' from publicacoes_djen_descartadas
  )
  select l.lida_em, coalesce(l.usuario_nome,'—'), p.dp, p.processo_numero, p.tribunal, l.tabela_origem, p.coordenacao_id
  from publicacoes_djen_leituras l
  join pubs p on p.id = l.publicacao_id and p.o = l.tabela_origem
  where auth.uid() is not null and l.lida_em >= p_ini and l.lida_em < p_fim
    and p.coordenacao_id in (select id from acesso)
    and (p_coord is null or p.coordenacao_id = p_coord)
  order by l.lida_em;
$$;
revoke all on function public.relatorio_publicacoes_lidas(timestamptz,timestamptz,uuid) from public, anon;
grant execute on function public.relatorio_publicacoes_lidas(timestamptz,timestamptz,uuid) to authenticated;