-- Criar tabela de parcelas vinculadas a um evento de parcelamento
CREATE TABLE public.parcelas_evento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  evento_id UUID NOT NULL REFERENCES public.eventos_agenda(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  data_vencimento DATE NOT NULL,
  valor NUMERIC(15,2),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'atrasado')),
  pago_em TIMESTAMP WITH TIME ZONE,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(evento_id, numero)
);

-- Índices
CREATE INDEX idx_parcelas_evento_evento_id ON public.parcelas_evento(evento_id);
CREATE INDEX idx_parcelas_evento_data_vencimento ON public.parcelas_evento(data_vencimento);
CREATE INDEX idx_parcelas_evento_status ON public.parcelas_evento(status);

-- Trigger para updated_at
CREATE TRIGGER update_parcelas_evento_updated_at
  BEFORE UPDATE ON public.parcelas_evento
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.parcelas_evento ENABLE ROW LEVEL SECURITY;

-- Políticas: mesmas permissões do evento pai
CREATE POLICY "Parcelas seguem acesso do evento pai" ON public.parcelas_evento
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.eventos_agenda e
      WHERE e.id = parcelas_evento.evento_id
      AND public.can_access_evento(auth.uid(), e.id)
    )
  );

-- Adicionar tipo 'parcelamento' como opção clara (comentário semântico)
COMMENT ON TABLE public.parcelas_evento IS 'Parcelas individuais vinculadas a eventos do tipo parcelamento';