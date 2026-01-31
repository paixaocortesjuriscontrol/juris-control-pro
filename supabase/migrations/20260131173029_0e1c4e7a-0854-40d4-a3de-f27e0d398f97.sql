-- Tabela para gerenciar workers de VPS distribuídas
CREATE TABLE public.workers_djen_vps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coordenacao_id UUID NOT NULL REFERENCES public.coordenacoes(id) ON DELETE CASCADE,
  nome_worker TEXT NOT NULL DEFAULT 'VPS Worker',
  ip_address TEXT,
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('offline', 'online', 'executando', 'pausado', 'erro')),
  ultimo_heartbeat TIMESTAMPTZ,
  progresso JSONB DEFAULT '{}',
  publicacoes_encontradas INTEGER DEFAULT 0,
  publicacoes_novas INTEGER DEFAULT 0,
  ultimo_erro TEXT,
  sessao_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_workers_djen_vps_coordenacao ON public.workers_djen_vps(coordenacao_id);
CREATE INDEX idx_workers_djen_vps_status ON public.workers_djen_vps(status);
CREATE INDEX idx_workers_djen_vps_heartbeat ON public.workers_djen_vps(ultimo_heartbeat);

-- RLS
ALTER TABLE public.workers_djen_vps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ver workers" 
ON public.workers_djen_vps FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem criar workers" 
ON public.workers_djen_vps FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem atualizar workers" 
ON public.workers_djen_vps FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem deletar workers" 
ON public.workers_djen_vps FOR DELETE 
USING (auth.uid() IS NOT NULL);

-- Trigger para updated_at
CREATE TRIGGER update_workers_djen_vps_updated_at
BEFORE UPDATE ON public.workers_djen_vps
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();