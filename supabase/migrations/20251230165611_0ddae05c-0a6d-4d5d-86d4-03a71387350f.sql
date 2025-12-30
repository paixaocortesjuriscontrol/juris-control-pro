-- Criar tabela para audiências detectadas nas publicações DJEN
CREATE TABLE public.audiencias_detectadas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  publicacao_id UUID REFERENCES public.publicacoes_djen(id) ON DELETE CASCADE,
  monitoramento_id UUID REFERENCES public.monitoramentos_djen(id) ON DELETE CASCADE,
  processo_numero TEXT,
  data_audiencia TIMESTAMP WITH TIME ZONE,
  tipo_audiencia TEXT,
  local_audiencia TEXT,
  contexto TEXT,
  conteudo_publicacao TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  tratado_por UUID REFERENCES public.profiles(id),
  tratado_em TIMESTAMP WITH TIME ZONE,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_audiencias_status ON public.audiencias_detectadas(status);
CREATE INDEX idx_audiencias_data ON public.audiencias_detectadas(data_audiencia);
CREATE INDEX idx_audiencias_created ON public.audiencias_detectadas(created_at DESC);
CREATE INDEX idx_audiencias_monitoramento ON public.audiencias_detectadas(monitoramento_id);

-- Habilitar RLS
ALTER TABLE public.audiencias_detectadas ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Sistema pode inserir audiências" 
ON public.audiencias_detectadas 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Usuários podem ver audiências acessíveis" 
ON public.audiencias_detectadas 
FOR SELECT 
USING (
  monitoramento_id IN (
    SELECT id FROM monitoramentos_djen
    WHERE criado_por = auth.uid() 
    OR is_admin_or_coordenador(auth.uid())
    OR coordenacao_id IN (
      SELECT coordenacao_id FROM membros_coordenacao WHERE usuario_id = auth.uid()
    )
  )
);

CREATE POLICY "Usuários podem atualizar audiências acessíveis" 
ON public.audiencias_detectadas 
FOR UPDATE 
USING (
  monitoramento_id IN (
    SELECT id FROM monitoramentos_djen
    WHERE criado_por = auth.uid() 
    OR is_admin_or_coordenador(auth.uid())
    OR coordenacao_id IN (
      SELECT coordenacao_id FROM membros_coordenacao WHERE usuario_id = auth.uid()
    )
  )
);

-- Trigger para updated_at
CREATE TRIGGER update_audiencias_detectadas_updated_at
BEFORE UPDATE ON public.audiencias_detectadas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Adicionar nova coluna em configuracoes_monitoramento para horários múltiplos
ALTER TABLE public.configuracoes_monitoramento 
ADD COLUMN IF NOT EXISTS horarios_execucao TEXT[] DEFAULT '{}'::text[];