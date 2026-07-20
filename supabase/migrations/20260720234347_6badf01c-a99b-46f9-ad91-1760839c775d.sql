
-- 1) Alertas pós-vencimento
ALTER TABLE public.config_envio_alertas_tarefas
  ADD COLUMN IF NOT EXISTS pos_vencimento_habilitado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pos_vencimento_horario time NOT NULL DEFAULT '09:00';

-- 2) Novas fontes de detecção/monitoramento (DJEN Servidor unificado)
ALTER TABLE public.config_deteccao_coordenacao
  ADD COLUMN IF NOT EXISTS monitorar_djen_termos_servidor boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS horarios_djen_termos_servidor time[] NOT NULL DEFAULT ARRAY[]::time[],
  ADD COLUMN IF NOT EXISTS monitorar_djen_pautas_servidor boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS horarios_djen_pautas_servidor time[] NOT NULL DEFAULT ARRAY[]::time[],
  ADD COLUMN IF NOT EXISTS monitorar_djen_kurier boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS horarios_djen_kurier time[] NOT NULL DEFAULT ARRAY[]::time[],
  ADD COLUMN IF NOT EXISTS monitorar_djen_stf_servidor boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS horarios_djen_stf_servidor time[] NOT NULL DEFAULT ARRAY[]::time[];

-- 3) Remover crons legados
DO $$
DECLARE j RECORD;
BEGIN
  FOR j IN SELECT jobname FROM cron.job WHERE jobname IN (
    'exec-andamentos-manha','exec-distribuicoes-manha','exec-redistribuicoes-manha'
  ) LOOP
    PERFORM cron.unschedule(j.jobname);
  END LOOP;
END $$;

-- 4) Limpeza de dados históricos
TRUNCATE TABLE public.alertas_monitoramento RESTART IDENTITY;
TRUNCATE TABLE public.distribuicoes_encontradas RESTART IDENTITY;
TRUNCATE TABLE public.movimentacoes_datajud RESTART IDENTITY;
