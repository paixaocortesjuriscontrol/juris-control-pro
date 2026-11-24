create table if not exists public.backup_responsaveis_admin_pc_20261124 as
select pr.* from public.processos_responsaveis pr join public.profiles p on p.id=pr.usuario_id where p.email='paixaocortesjuriscontrol@gmail.com';
grant all on public.backup_responsaveis_admin_pc_20261124 to service_role;
alter table public.backup_responsaveis_admin_pc_20261124 enable row level security;
create policy "admins leem backup" on public.backup_responsaveis_admin_pc_20261124 for select to authenticated using (public.has_role(auth.uid(),'admin'));
grant select on public.backup_responsaveis_admin_pc_20261124 to authenticated;
delete from public.processos_responsaveis where id in (select id from public.backup_responsaveis_admin_pc_20261124);