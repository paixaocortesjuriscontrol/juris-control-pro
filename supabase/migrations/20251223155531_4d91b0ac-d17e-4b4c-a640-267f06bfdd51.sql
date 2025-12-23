-- =====================================================
-- MONITORAMENTO DJEN AVANÇADO
-- Adiciona suporte a: exclusões, condições concomitantes, tribunais específicos, descartados
-- =====================================================

-- 1. Adicionar novos campos na tabela monitoramentos_djen
ALTER TABLE public.monitoramentos_djen 
ADD COLUMN IF NOT EXISTS exclusoes TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS condicao_concomitante TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS tribunais TEXT[] DEFAULT NULL,
ADD COLUMN IF NOT EXISTS descricao TEXT DEFAULT NULL;

-- Comentários explicativos
COMMENT ON COLUMN public.monitoramentos_djen.exclusoes IS 'Array de termos para excluir das publicações (ex: SANTANDER, BRADESCO)';
COMMENT ON COLUMN public.monitoramentos_djen.condicao_concomitante IS 'Termo adicional que DEVE aparecer junto com o termo_busca (condição AND)';
COMMENT ON COLUMN public.monitoramentos_djen.tribunais IS 'Array de tribunais específicos para buscar (ex: TJDFT, TRF1, STJ). Se NULL, busca em todos os disponíveis.';
COMMENT ON COLUMN public.monitoramentos_djen.descricao IS 'Descrição detalhada do monitoramento';

-- 2. Criar tabela para publicações descartadas (pelos critérios de exclusão)
CREATE TABLE IF NOT EXISTS public.publicacoes_djen_descartadas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  monitoramento_id UUID NOT NULL REFERENCES public.monitoramentos_djen(id) ON DELETE CASCADE,
  hash_conteudo TEXT NOT NULL,
  data_publicacao TIMESTAMP WITH TIME ZONE,
  processo_numero TEXT,
  conteudo TEXT,
  fonte TEXT,
  motivo_descarte TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índice para evitar duplicatas em descartadas também
CREATE UNIQUE INDEX IF NOT EXISTS idx_publicacoes_djen_descartadas_hash 
ON public.publicacoes_djen_descartadas(monitoramento_id, hash_conteudo);

-- 3. Criar tabela para deduplicação global (evitar mesma publicação em múltiplos monitoramentos)
CREATE TABLE IF NOT EXISTS public.publicacoes_djen_global_hash (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hash_global TEXT NOT NULL UNIQUE,
  primeiro_monitoramento_id UUID NOT NULL REFERENCES public.monitoramentos_djen(id) ON DELETE SET NULL,
  publicacao_id UUID REFERENCES public.publicacoes_djen(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índice para busca rápida por hash
CREATE INDEX IF NOT EXISTS idx_publicacoes_djen_global_hash_lookup 
ON public.publicacoes_djen_global_hash(hash_global);

-- 4. RLS para publicacoes_djen_descartadas
ALTER TABLE public.publicacoes_djen_descartadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System can insert descartadas" 
ON public.publicacoes_djen_descartadas 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can view accessible descartadas" 
ON public.publicacoes_djen_descartadas 
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

CREATE POLICY "Users can delete accessible descartadas" 
ON public.publicacoes_djen_descartadas 
FOR DELETE 
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

-- 5. RLS para publicacoes_djen_global_hash
ALTER TABLE public.publicacoes_djen_global_hash ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System can manage global hash" 
ON public.publicacoes_djen_global_hash 
FOR ALL 
USING (true)
WITH CHECK (true);

-- 6. Adicionar campo para marcar publicação como importada de descartadas
ALTER TABLE public.publicacoes_djen 
ADD COLUMN IF NOT EXISTS importada_de_descartada BOOLEAN DEFAULT false;