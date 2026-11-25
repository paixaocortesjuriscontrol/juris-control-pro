CREATE TABLE public.backup_status_tarefas_projuris_20261125 AS
SELECT DISTINCT t.id, t.status, t.data_cumprimento, x.chave
FROM public.tmp_status_projuris_20261125 x
JOIN public.migracoes_projuris_itens i ON i.tipo='tarefa' AND i.chave_externa=x.chave
JOIN public.tarefas t ON t.id=i.registro_id AND t.origem='projuris' AND t.created_at>='2026-11-25'
 AND t.status IN ('pendente','revisao','em_execucao','a_confirmar');
GRANT ALL ON public.backup_status_tarefas_projuris_20261125 TO service_role;
ALTER TABLE public.backup_status_tarefas_projuris_20261125 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin le backup status projuris" ON public.backup_status_tarefas_projuris_20261125 FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

SELECT set_config('app.sem_notificacao','1',true);

UPDATE public.tarefas t SET
  status = (CASE x.codigo WHEN 'c' THEN 'cumprido' WHEN 's' THEN 'concluido_sem_sucesso' WHEN 'x' THEN 'cancelado'
            WHEN 'p' THEN 'pendente' WHEN 'e' THEN 'em_execucao' WHEN 'a' THEN 'a_confirmar' WHEN 'r' THEN 'revisao' END)::public.status_tarefa,
  data_cumprimento = CASE WHEN x.codigo IN ('c','s') AND x.conclusao IS NOT NULL
     THEN (to_timestamp(x.conclusao,'YYYYMMDDHH24MI')::timestamp AT TIME ZONE 'America/Sao_Paulo') ELSE t.data_cumprimento END
FROM public.backup_status_tarefas_projuris_20261125 b
JOIN public.tmp_status_projuris_20261125 x ON x.chave=b.chave
WHERE t.id=b.id AND t.status=b.status;