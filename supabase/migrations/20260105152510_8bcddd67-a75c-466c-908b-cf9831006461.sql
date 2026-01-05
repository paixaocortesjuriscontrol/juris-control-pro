-- Criar tabela de intimações detectadas
CREATE TABLE public.intimacoes_detectadas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  processo_numero TEXT,
  processo_id UUID REFERENCES public.processos(id),
  movimentacao_id UUID REFERENCES public.movimentacoes(id),
  data_intimacao TIMESTAMP WITH TIME ZONE,
  data_limite TIMESTAMP WITH TIME ZONE,
  tipo_intimacao TEXT,
  orgao_intimante TEXT,
  descricao TEXT,
  contexto TEXT,
  conteudo_publicacao TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  prazo_dias INTEGER,
  prioridade TEXT DEFAULT 'normal',
  observacoes TEXT,
  providencias_tomadas TEXT,
  tratado_por UUID REFERENCES auth.users(id),
  tratado_em TIMESTAMP WITH TIME ZONE,
  origem TEXT DEFAULT 'detectado',
  criado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.intimacoes_detectadas ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Intimações visíveis para usuários autenticados"
ON public.intimacoes_detectadas FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem criar intimações"
ON public.intimacoes_detectadas FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Usuários autenticados podem atualizar intimações"
ON public.intimacoes_detectadas FOR UPDATE
USING (auth.role() = 'authenticated');

-- Trigger para updated_at
CREATE TRIGGER update_intimacoes_detectadas_updated_at
BEFORE UPDATE ON public.intimacoes_detectadas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_intimacoes_detectadas_status ON public.intimacoes_detectadas(status);
CREATE INDEX idx_intimacoes_detectadas_data_limite ON public.intimacoes_detectadas(data_limite);
CREATE INDEX idx_intimacoes_detectadas_processo_numero ON public.intimacoes_detectadas(processo_numero);
CREATE INDEX idx_intimacoes_detectadas_processo_id ON public.intimacoes_detectadas(processo_id);