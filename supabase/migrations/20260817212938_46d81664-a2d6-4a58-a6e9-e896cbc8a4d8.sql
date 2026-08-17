ALTER TABLE public.djen_proxy_pool
  ADD COLUMN IF NOT EXISTS ultima_checagem_em timestamptz,
  ADD COLUMN IF NOT EXISTS saude_status text,
  ADD COLUMN IF NOT EXISTS saude_motivo text,
  ADD COLUMN IF NOT EXISTS latencia_ms integer,
  ADD COLUMN IF NOT EXISTS cert_expira_em timestamptz,
  ADD COLUMN IF NOT EXISTS cert_dias_restantes integer,
  ADD COLUMN IF NOT EXISTS ultimo_alerta_cert_em timestamptz,
  ADD COLUMN IF NOT EXISTS ultimo_alerta_offline_em timestamptz;