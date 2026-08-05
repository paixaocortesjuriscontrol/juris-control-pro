DROP TRIGGER IF EXISTS trigger_criar_tarefa_audiencia ON public.audiencias_detectadas;

CREATE TRIGGER trigger_criar_tarefa_audiencia
BEFORE INSERT ON public.audiencias_detectadas
FOR EACH ROW
WHEN (COALESCE(NEW.origem, 'manual') NOT IN ('manual','importacao','astrea','projuris','pauta_excel','publicacao'))
EXECUTE FUNCTION public.criar_tarefa_automatica_audiencia();

DO $$
DECLARE
  v_ids UUID[];
BEGIN
  SELECT array_agg(t.id) INTO v_ids
  FROM public.tarefas t
  JOIN public.audiencias_detectadas a ON a.tarefa_id = t.id
  WHERE COALESCE(a.origem, 'manual') IN ('manual','importacao','astrea','projuris','pauta_excel','publicacao')
    AND t.tipo_tarefa = 'audiencia'
    AND t.descricao LIKE '📅 **Audiência**%';

  IF v_ids IS NOT NULL THEN
    UPDATE public.audiencias_detectadas SET tarefa_id = NULL WHERE tarefa_id = ANY(v_ids);
    DELETE FROM public.tarefa_responsaveis WHERE tarefa_id = ANY(v_ids);
    DELETE FROM public.tarefa_envolvidos WHERE tarefa_id = ANY(v_ids);
    DELETE FROM public.comentarios_tarefas WHERE tarefa_id = ANY(v_ids);
    DELETE FROM public.tarefas_publicacoes WHERE tarefa_id = ANY(v_ids);
    DELETE FROM public.tarefas_publicacoes_processos WHERE tarefa_id = ANY(v_ids);
    DELETE FROM public.tarefas WHERE id = ANY(v_ids);
  END IF;
END $$;