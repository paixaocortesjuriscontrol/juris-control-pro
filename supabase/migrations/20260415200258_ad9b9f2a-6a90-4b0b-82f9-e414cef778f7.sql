
-- 1. Create per-user read tracking table for DJEN publications
CREATE TABLE IF NOT EXISTS public.publicacoes_djen_leituras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publicacao_id uuid NOT NULL,
  tabela_origem text NOT NULL CHECK (tabela_origem IN ('termo', 'processo', 'descartada')),
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usuario_nome text,
  lida_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE(publicacao_id, tabela_origem, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_djen_leituras_usuario ON public.publicacoes_djen_leituras(usuario_id);
CREATE INDEX IF NOT EXISTS idx_djen_leituras_pub ON public.publicacoes_djen_leituras(publicacao_id, tabela_origem);

ALTER TABLE public.publicacoes_djen_leituras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sel_leituras" ON public.publicacoes_djen_leituras FOR SELECT TO authenticated USING (true);
CREATE POLICY "ins_leituras" ON public.publicacoes_djen_leituras FOR INSERT TO authenticated WITH CHECK (usuario_id = auth.uid());
CREATE POLICY "del_leituras" ON public.publicacoes_djen_leituras FOR DELETE TO authenticated USING (usuario_id = auth.uid());

-- 2. RPC to fetch leituras for an array of publication IDs (avoids URL length limits)
CREATE OR REPLACE FUNCTION public.get_leituras_publicacoes(p_ids uuid[])
RETURNS TABLE(publicacao_id uuid, tabela_origem text, usuario_id uuid, usuario_nome text, lida_em timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT l.publicacao_id, l.tabela_origem, l.usuario_id, l.usuario_nome, l.lida_em
  FROM publicacoes_djen_leituras l
  WHERE l.publicacao_id = ANY(p_ids);
$$;
