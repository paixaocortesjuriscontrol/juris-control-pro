drop policy if exists cae_manage_admin_coord on public.config_acompanhamento_especial;
create policy cae_manage_admin_coord on public.config_acompanhamento_especial for all to authenticated
 using (has_role(auth.uid(),'admin') or has_role(auth.uid(),'coordenador') or has_role(auth.uid(),'assistente_coordenador') or public._pode_gerir_coordenacao(coordenacao_id))
 with check (has_role(auth.uid(),'admin') or has_role(auth.uid(),'coordenador') or has_role(auth.uid(),'assistente_coordenador') or public._pode_gerir_coordenacao(coordenacao_id));