
-- Tabela para armazenar movimentações encontradas via API DataJud (CNJ)
CREATE TABLE public.movimentacoes_datajud (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  monitoramento_id UUID NOT NULL REFERENCES public.monitoramentos_djen(id) ON DELETE CASCADE,
  coordenacao_id UUID NOT NULL REFERENCES public.coordenacoes(id) ON DELETE CASCADE,
  numero_processo TEXT NOT NULL,
  tribunal TEXT NOT NULL,
  orgao_julgador TEXT,
  tipo_movimentacao TEXT,
  data_movimentacao DATE,
  complemento TEXT,
  classe_processual TEXT,
  assuntos TEXT,
  lida BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(monitoramento_id, numero_processo, data_movimentacao, tipo_movimentacao)
);

-- RLS
ALTER TABLE public.movimentacoes_datajud ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their coordination DataJud records"
  ON public.movimentacoes_datajud FOR SELECT
  USING (
    public.is_admin_or_coordenador(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.membros_coordenacao mc
      WHERE mc.coordenacao_id = movimentacoes_datajud.coordenacao_id
      AND mc.usuario_id = auth.uid()
    )
  );

-- Trigger updated_at
CREATE TRIGGER update_movimentacoes_datajud_timestamp
  BEFORE UPDATE ON public.movimentacoes_datajud
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_movimentacoes_datajud_coordenacao ON public.movimentacoes_datajud(coordenacao_id);
CREATE INDEX idx_movimentacoes_datajud_monitoramento ON public.movimentacoes_datajud(monitoramento_id);
CREATE INDEX idx_movimentacoes_datajud_created ON public.movimentacoes_datajud(created_at DESC);

-- Inserir configuração global para datajud_termos
INSERT INTO public.configuracoes_monitoramento (tipo, frequencia, ativo, coordenacao_id, metadata)
VALUES ('datajud_termos', 'manual', true, null, '{"status": "idle", "novas": 0, "duplicadas": 0, "tribunaisProcessados": 0}')
ON CONFLICT DO NOTHING;
