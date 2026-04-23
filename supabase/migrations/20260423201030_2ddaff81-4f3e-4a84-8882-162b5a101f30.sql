
-- Tabela de publicações capturadas no portal STF Digital via engine "STF Termos"
CREATE TABLE IF NOT EXISTS public.publicacoes_stf (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  monitoramento_id uuid NOT NULL REFERENCES public.monitoramentos_djen(id) ON DELETE CASCADE,
  coordenacao_id uuid REFERENCES public.coordenacoes(id) ON DELETE SET NULL,
  stf_id text,
  processo_numero text,
  tipo text,
  relator text,
  data_divulgacao timestamptz,
  data_publicacao timestamptz,
  texto_html text,
  texto_limpo text,
  hash_conteudo text NOT NULL,
  fonte text NOT NULL DEFAULT 'stf_digital',
  lida boolean NOT NULL DEFAULT false,
  resumo_ia text,
  resumo_gerado_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT publicacoes_stf_unique_hash UNIQUE (monitoramento_id, hash_conteudo)
);

CREATE INDEX IF NOT EXISTS idx_publicacoes_stf_coord_data ON public.publicacoes_stf (coordenacao_id, data_publicacao DESC);
CREATE INDEX IF NOT EXISTS idx_publicacoes_stf_processo ON public.publicacoes_stf (processo_numero);
CREATE INDEX IF NOT EXISTS idx_publicacoes_stf_monitoramento ON public.publicacoes_stf (monitoramento_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_publicacoes_stf_stf_id ON public.publicacoes_stf (stf_id);

-- RLS espelha publicacoes_djen
ALTER TABLE public.publicacoes_stf ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System can insert publicacoes stf"
  ON public.publicacoes_stf FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view accessible publicacoes stf"
  ON public.publicacoes_stf FOR SELECT
  USING (
    monitoramento_id IN (
      SELECT id FROM public.monitoramentos_djen
      WHERE criado_por = auth.uid()
        OR public.is_admin_or_coordenador(auth.uid())
        OR coordenacao_id IN (
          SELECT coordenacao_id FROM public.membros_coordenacao WHERE usuario_id = auth.uid()
        )
    )
  );

CREATE POLICY "Users can update accessible publicacoes stf"
  ON public.publicacoes_stf FOR UPDATE
  USING (
    monitoramento_id IN (
      SELECT id FROM public.monitoramentos_djen
      WHERE criado_por = auth.uid()
        OR public.is_admin_or_coordenador(auth.uid())
        OR coordenacao_id IN (
          SELECT coordenacao_id FROM public.membros_coordenacao WHERE usuario_id = auth.uid()
        )
    )
  );

-- Atualizar CHECK constraint para aceitar 'stf' e 'stf_flash'
ALTER TABLE public.execucoes_agendadas DROP CONSTRAINT IF EXISTS execucoes_agendadas_tipo_check;
ALTER TABLE public.execucoes_agendadas ADD CONSTRAINT execucoes_agendadas_tipo_check
  CHECK (tipo = ANY (ARRAY[
    'redistribuicoes','andamentos','distribuicoes',
    'djen','djen_processos','termos','datajud_termos',
    'djen_pro','djen_flash','stf','stf_flash'
  ]));
