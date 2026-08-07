ALTER TABLE public.config_notificacoes_usuario
  ADD COLUMN IF NOT EXISTS resumo_diario_ativo BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS resumo_diario_hora INTEGER NOT NULL DEFAULT 7;

ALTER TABLE public.config_notificacoes_usuario
  DROP CONSTRAINT IF EXISTS config_notif_resumo_hora_chk;

ALTER TABLE public.config_notificacoes_usuario
  ADD CONSTRAINT config_notif_resumo_hora_chk CHECK (resumo_diario_hora BETWEEN 0 AND 23);