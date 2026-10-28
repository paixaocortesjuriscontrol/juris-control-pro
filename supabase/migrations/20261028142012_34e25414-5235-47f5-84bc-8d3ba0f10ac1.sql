-- lovable-cron-fallback-reviewed: one-off bounded backfill (~600 six-hour windows) that unschedules itself when the cursor reaches the start date; per-call timeouts prevent doing it in a single statement.
CREATE TABLE public.manutencao_restauracao_kurier (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  cursor_ate timestamptz NOT NULL,
  limite_inicio timestamptz NOT NULL,
  restauradas int NOT NULL DEFAULT 0,
  conflitos int NOT NULL DEFAULT 0,
  concluida_em timestamptz,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.manutencao_restauracao_kurier TO service_role;
ALTER TABLE public.manutencao_restauracao_kurier ENABLE ROW LEVEL SECURITY;

INSERT INTO public.manutencao_restauracao_kurier (cursor_ate, limite_inicio)
VALUES ('2026-10-28 09:00+00', '2026-05-26 00:00+00');

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
  v_de := greatest(v_estado.cursor_ate - interval '6 hours', v_estado.limite_inicio);
  v_res := public.restaurar_conteudo_kurier_truncado(v_de, v_estado.cursor_ate);
  UPDATE public.manutencao_restauracao_kurier
     SET cursor_ate = v_de,
         restauradas = restauradas + (v_res->>'restauradas')::int,
         conflitos = conflitos + (v_res->>'conflitos')::int,
         atualizado_em = now()
   WHERE id = 1;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.processar_restauracao_kurier_lote() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('restaurar-conteudo-kurier-truncado', '* * * * *', 'SET statement_timeout = ''55s''; SELECT public.processar_restauracao_kurier_lote();');