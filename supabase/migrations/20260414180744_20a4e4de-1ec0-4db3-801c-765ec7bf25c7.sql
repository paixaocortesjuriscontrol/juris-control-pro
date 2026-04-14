
-- 1. Adicionar campos em processos
ALTER TABLE public.processos
  ADD COLUMN IF NOT EXISTS status_transito text DEFAULT 'nao_consultado'
    CHECK (status_transito IN ('transitado_confirmado', 'transitado_provavel', 'em_curso', 'nao_consultado')),
  ADD COLUMN IF NOT EXISTS data_transito_estimada date,
  ADD COLUMN IF NOT EXISTS ultima_consulta_judit timestamptz;

-- 2. Adicionar campos em movimentacoes
ALTER TABLE public.movimentacoes
  ADD COLUMN IF NOT EXISTS codigo text,
  ADD COLUMN IF NOT EXISTS eh_decisao_recorrivel boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS eh_recurso_interposto boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS eh_certidao_transito boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS raw jsonb;

-- 3. Índices em movimentacoes
CREATE INDEX IF NOT EXISTS idx_movimentacoes_processo_data
  ON public.movimentacoes (processo_id, data_movimentacao DESC);

-- 4. Tabela consultas_judit
CREATE TABLE IF NOT EXISTS public.consultas_judit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  requisitada_em timestamptz NOT NULL DEFAULT now(),
  status_http int,
  payload_resposta jsonb,
  erro text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consultas_judit_processo
  ON public.consultas_judit (processo_id, requisitada_em DESC);

-- 5. RLS em consultas_judit
ALTER TABLE public.consultas_judit ENABLE ROW LEVEL SECURITY;

-- Política: usuários autenticados podem ver consultas de processos que podem acessar
CREATE POLICY "Authenticated users can view consultas of accessible processos"
  ON public.consultas_judit
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.processos p
      WHERE p.id = consultas_judit.processo_id
    )
  );

-- Política: apenas service_role pode inserir (edge functions)
CREATE POLICY "Service role can insert consultas"
  ON public.consultas_judit
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Política: apenas service_role pode atualizar
CREATE POLICY "Service role can update consultas"
  ON public.consultas_judit
  FOR UPDATE
  TO service_role
  USING (true);
