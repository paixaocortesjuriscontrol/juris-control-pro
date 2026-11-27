-- lovable-cron-fallback-reviewed: one-night recovery of 553 processes after the Judit plan limit; self-unschedules after 27/11 BRT
ALTER TABLE public.config_judit_franquia ADD COLUMN IF NOT EXISTS limite_valor_brl numeric NOT NULL DEFAULT 3000;
UPDATE public.config_judit_franquia SET limite_valor_brl = 3000;

UPDATE public.processos p SET acompanhamento_ultima_checagem_em = '2026-11-26T12:00:00-03:00'
WHERE acompanhamento_especial AND NOT EXISTS (
  SELECT 1 FROM public.judit_logs l WHERE l.origem='acompanhamento-especial' AND l.status='sucesso'
  AND l.created_at >= '2026-11-27T00:00:00-03:00'
  AND regexp_replace(l.processo_numero,'\D','','g') = regexp_replace(p.numero,'\D','','g'));

DO $$
DECLARE cmd text;
BEGIN
  SELECT command INTO cmd FROM cron.job WHERE jobname='acomp-especial-repescagem';
  PERFORM cron.schedule('acomp-especial-recuperacao-20261127', '* * * * *',
    'DO $b$ BEGIN IF (now() AT TIME ZONE ''America/Sao_Paulo'')::date > DATE ''2026-11-27'' THEN PERFORM cron.unschedule(''acomp-especial-recuperacao-20261127''); ELSE ' || rtrim(trim(cmd), ';') || '; END IF; END $b$;');
END $$;