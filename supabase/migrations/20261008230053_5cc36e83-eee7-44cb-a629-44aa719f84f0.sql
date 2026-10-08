ALTER TABLE public.config_notificacoes_usuario DROP CONSTRAINT IF EXISTS config_notificacoes_usuario_usuario_id_key;
DROP INDEX IF EXISTS public.config_notificacoes_usuario_usuario_id_key;
ALTER TABLE public.config_notificacoes_usuario ADD COLUMN IF NOT EXISTS coordenacao_id uuid NULL REFERENCES public.coordenacoes(id) ON DELETE CASCADE;
ALTER TABLE public.config_notificacoes_usuario ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;
CREATE UNIQUE INDEX IF NOT EXISTS config_notif_usuario_padrao_uq ON public.config_notificacoes_usuario (usuario_id) WHERE coordenacao_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS config_notif_usuario_coord_uq ON public.config_notificacoes_usuario (usuario_id, coordenacao_id) WHERE coordenacao_id IS NOT NULL;