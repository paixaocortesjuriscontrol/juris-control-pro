SELECT set_config('app.sem_notificacao','1', true);
CREATE TABLE public.bkp_tarefas_pos_corte_20261125 AS
SELECT t.* FROM public.tarefas t
JOIN public.coordenacoes c ON c.id=t.coordenacao_id
WHERE c.nome ILIKE '%santander c%vel%'
AND EXISTS (SELECT 1 FROM public.migracoes_projuris_itens m WHERE m.registro_id=t.id AND m.tipo='tarefa')
AND greatest(t.data_vencimento,t.data_fatal,t.data_prevista,t.data_base) > '2026-11-13 23:59:59-03';
CREATE TABLE public.bkp_tarefas_pos_corte_resp_20261125 AS SELECT r.* FROM public.tarefa_responsaveis r WHERE r.tarefa_id IN (SELECT id FROM public.bkp_tarefas_pos_corte_20261125);
CREATE TABLE public.bkp_tarefas_pos_corte_env_20261125 AS SELECT r.* FROM public.tarefa_envolvidos r WHERE r.tarefa_id IN (SELECT id FROM public.bkp_tarefas_pos_corte_20261125);
CREATE TABLE public.bkp_tarefas_pos_corte_com_20261125 AS SELECT r.* FROM public.comentarios_tarefas r WHERE r.tarefa_id IN (SELECT id FROM public.bkp_tarefas_pos_corte_20261125);
CREATE TABLE public.bkp_tarefas_pos_corte_doc_20261125 AS SELECT r.id, r.tarefa_id FROM public.documentos r WHERE r.tarefa_id IN (SELECT id FROM public.bkp_tarefas_pos_corte_20261125);
DO $$ DECLARE n text; BEGIN FOREACH n IN ARRAY ARRAY['bkp_tarefas_pos_corte_20261125','bkp_tarefas_pos_corte_resp_20261125','bkp_tarefas_pos_corte_env_20261125','bkp_tarefas_pos_corte_com_20261125','bkp_tarefas_pos_corte_doc_20261125'] LOOP
EXECUTE format('GRANT ALL ON public.%I TO service_role', n);
EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', n);
EXECUTE format('CREATE POLICY "admin le" ON public.%I FOR SELECT TO authenticated USING (public.has_role(auth.uid(),''admin''))', n);
END LOOP; END $$;
UPDATE public.documentos SET tarefa_id=NULL WHERE id IN (SELECT id FROM public.bkp_tarefas_pos_corte_doc_20261125);
UPDATE public.migracoes_projuris_itens SET status='pulado', motivo='Removida em 25/11/2026: data depois do corte 13/11/2026' WHERE tipo='tarefa' AND registro_id IN (SELECT id FROM public.bkp_tarefas_pos_corte_20261125);
DELETE FROM public.tarefas WHERE id IN (SELECT id FROM public.bkp_tarefas_pos_corte_20261125);