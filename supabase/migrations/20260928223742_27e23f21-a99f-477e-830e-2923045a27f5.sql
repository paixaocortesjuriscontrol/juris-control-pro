CREATE TABLE public.backup_merge_coord_renata (id bigserial primary key, tabela text not null, acao text not null, registro jsonb not null, created_at timestamptz not null default now());
GRANT ALL ON public.backup_merge_coord_renata TO service_role;
ALTER TABLE public.backup_merge_coord_renata ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins leem backup merge" ON public.backup_merge_coord_renata FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
GRANT SELECT ON public.backup_merge_coord_renata TO authenticated;