-- lovable-cron-fallback-reviewed: geração TST pesada estourava timeout no trigger de conclusão; check leve a cada 15 min
CREATE OR REPLACE FUNCTION public.trg_pautas_apos_djen_servidor()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.pos_djen_servidor_gerar_tst()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM public.execucoes_servidor
             WHERE tipo='djen_paralela_servidor' AND status IN ('concluido','concluido_parcial')
               AND finalizado_em > now() - interval '16 minutes') THEN
    BEGIN PERFORM public.gerar_pautas_tst_auto(2);
    EXCEPTION WHEN others THEN RAISE WARNING 'gerar_pautas_tst_auto: %', SQLERRM; END;
    BEGIN PERFORM public.gerar_distribuicoes_tst_auto(7);
    EXCEPTION WHEN others THEN RAISE WARNING 'gerar_distribuicoes_tst_auto: %', SQLERRM; END;
  END IF;
END $function$;
REVOKE EXECUTE ON FUNCTION public.pos_djen_servidor_gerar_tst() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('pos-djen-servidor-gerar-tst', '*/15 * * * *', 'SELECT public.pos_djen_servidor_gerar_tst()');

UPDATE public.execucoes_servidor SET status='concluido', finalizado_em=now(),
  erro='Finalização manual: etapa de pós-processamento estourava o tempo limite.'
 WHERE id='4c568f2c-910d-4856-8f6b-e62f2218ff61' AND status='executando';