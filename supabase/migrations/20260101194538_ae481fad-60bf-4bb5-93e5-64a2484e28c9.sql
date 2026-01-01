-- Tabela para armazenar publicações DJEN encontradas por processo cadastrado
CREATE TABLE public.publicacoes_djen_processos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  processo_id UUID NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  processo_numero TEXT NOT NULL,
  conteudo TEXT,
  data_publicacao TIMESTAMP WITH TIME ZONE,
  data_encontrado TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  fonte TEXT,
  hash_conteudo TEXT NOT NULL,
  lida BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_publicacoes_djen_processos_processo_id ON public.publicacoes_djen_processos(processo_id);
CREATE INDEX idx_publicacoes_djen_processos_hash ON public.publicacoes_djen_processos(hash_conteudo);
CREATE INDEX idx_publicacoes_djen_processos_data ON public.publicacoes_djen_processos(data_encontrado DESC);

-- Índice único para evitar duplicatas
CREATE UNIQUE INDEX idx_publicacoes_djen_processos_unique ON public.publicacoes_djen_processos(processo_id, hash_conteudo);

-- Enable RLS
ALTER TABLE public.publicacoes_djen_processos ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Sistema pode inserir publicações" 
ON public.publicacoes_djen_processos 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Usuários podem ver publicações de processos acessíveis" 
ON public.publicacoes_djen_processos 
FOR SELECT 
USING (can_access_processo(auth.uid(), processo_id));

CREATE POLICY "Usuários podem atualizar publicações de processos acessíveis" 
ON public.publicacoes_djen_processos 
FOR UPDATE 
USING (can_access_processo(auth.uid(), processo_id));

-- Adicionar configuração de monitoramento DJEN por processo
INSERT INTO public.configuracoes_monitoramento (tipo, frequencia, ativo)
VALUES ('djen_processos', 'diario', true)
ON CONFLICT DO NOTHING;