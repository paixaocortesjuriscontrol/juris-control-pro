-- Criar tabela para associar advogados responsáveis a audiências
CREATE TABLE public.audiencias_advogados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  audiencia_id UUID NOT NULL REFERENCES public.audiencias_detectadas(id) ON DELETE CASCADE,
  advogado_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(audiencia_id, advogado_id)
);

-- Enable RLS
ALTER TABLE public.audiencias_advogados ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuários autenticados podem ver advogados de audiências"
  ON public.audiencias_advogados FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem inserir advogados em audiências"
  ON public.audiencias_advogados FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins e coordenadores podem deletar advogados de audiências"
  ON public.audiencias_advogados FOR DELETE
  USING (is_admin_or_coordenador(auth.uid()));

-- Criar índice para performance
CREATE INDEX idx_audiencias_advogados_audiencia ON public.audiencias_advogados(audiencia_id);
CREATE INDEX idx_audiencias_advogados_advogado ON public.audiencias_advogados(advogado_id);