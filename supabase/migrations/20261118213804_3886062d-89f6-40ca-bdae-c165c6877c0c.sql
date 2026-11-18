CREATE TABLE public.backup_responsaveis_devolvidos_20261118 AS SELECT 'responsavel'::text papel, tr.id, tr.tarefa_id, tr.usuario_id, tr.created_at FROM public.tarefa_responsaveis tr WHERE false;
GRANT SELECT ON public.backup_responsaveis_devolvidos_20261118 TO authenticated;
GRANT ALL ON public.backup_responsaveis_devolvidos_20261118 TO service_role;
ALTER TABLE public.backup_responsaveis_devolvidos_20261118 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins leem backup devolvidos" ON public.backup_responsaveis_devolvidos_20261118 FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

INSERT INTO public.backup_responsaveis_devolvidos_20261118
SELECT 'responsavel', tr.id, tr.tarefa_id, tr.usuario_id, tr.created_at FROM public.tarefa_responsaveis tr JOIN public.tarefas t ON t.id=tr.tarefa_id
WHERE tr.created_at BETWEEN '2026-11-18 18:19' AND '2026-11-18 18:20'
  AND t.coordenacao_id IS DISTINCT FROM '968631d0-6659-46f1-b45d-899892cb0121'
  AND tr.usuario_id IS DISTINCT FROM t.responsavel_id;
INSERT INTO public.backup_responsaveis_devolvidos_20261118
SELECT 'envolvido', te.id, te.tarefa_id, te.usuario_id, te.created_at FROM public.tarefa_envolvidos te JOIN public.tarefas t ON t.id=te.tarefa_id
WHERE te.created_at BETWEEN '2026-11-18 18:19' AND '2026-11-18 18:20'
  AND t.coordenacao_id IS DISTINCT FROM '968631d0-6659-46f1-b45d-899892cb0121';

DELETE FROM public.tarefa_responsaveis WHERE id IN (SELECT id FROM public.backup_responsaveis_devolvidos_20261118 WHERE papel='responsavel');
DELETE FROM public.tarefa_envolvidos WHERE id IN (SELECT id FROM public.backup_responsaveis_devolvidos_20261118 WHERE papel='envolvido');