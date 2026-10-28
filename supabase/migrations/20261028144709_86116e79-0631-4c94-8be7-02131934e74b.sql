-- lovable-cron-fallback-reviewed: same one-off self-unscheduling backfill; smaller windows and longer per-run timeout so busy hours cannot stall it.
CREATE OR REPLACE FUNCTION public.processar_restauracao_kurier_lote()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_estado public.manutencao_restauracao_kurier%ROWTYPE;
  v_de timestamptz;
  v_res jsonb;
BEGIN
  SELECT * INTO v_estado FROM public.manutencao_restauracao_kurier WHERE id = 1 FOR UPDATE SKIP LOCKED;
  IF NOT FOUND OR v_estado.concluida_em IS NOT NULL THEN
    RETURN;
  END IF;
  IF v_estado.cursor_ate <= v_estado.limite_inicio THEN
    UPDATE public.manutencao_restauracao_kurier SET concluida_em = now(), atualizado_em = now() WHERE id = 1;
    PERFORM cron.unschedule('restaurar-conteudo-kurier-truncado');
    RETURN;
  END IF;
  v_de := greatest(v_estado.cursor_ate - interval '2 hours', v_estado.limite_inicio);
  v_res := public.restaurar_conteudo_kurier_truncado(v_de, v_estado.cursor_ate);
  UPDATE public.manutencao_restauracao_kurier
     SET cursor_ate = v_de,
         restauradas = restauradas + (v_res->>'restauradas')::int,
         conflitos = conflitos + (v_res->>'conflitos')::int,
         atualizado_em = now()
   WHERE id = 1;
END;
$function$;

SELECT cron.schedule('restaurar-conteudo-kurier-truncado', '* * * * *', 'SET statement_timeout = ''240s''; SELECT public.processar_restauracao_kurier_lote();');