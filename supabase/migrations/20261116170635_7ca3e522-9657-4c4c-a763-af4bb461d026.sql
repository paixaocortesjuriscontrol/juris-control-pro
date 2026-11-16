drop policy if exists config_alertas_insert on public.config_alertas_coordenacao;
drop policy if exists config_alertas_update on public.config_alertas_coordenacao;
create policy config_alertas_insert on public.config_alertas_coordenacao for insert to authenticated
 with check (has_role(auth.uid(),'admin') or has_role(auth.uid(),'coordenador') or has_role(auth.uid(),'assistente_coordenador') or public._pode_gerir_coordenacao(coordenacao_id));
create policy config_alertas_update on public.config_alertas_coordenacao for update to authenticated
 using (has_role(auth.uid(),'admin') or has_role(auth.uid(),'coordenador') or has_role(auth.uid(),'assistente_coordenador') or public._pode_gerir_coordenacao(coordenacao_id))
 with check (has_role(auth.uid(),'admin') or has_role(auth.uid(),'coordenador') or has_role(auth.uid(),'assistente_coordenador') or public._pode_gerir_coordenacao(coordenacao_id));