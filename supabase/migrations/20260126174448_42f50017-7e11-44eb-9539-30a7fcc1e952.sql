-- =============================================================
-- SISTEMA PARALELO DJE-PDF - Fase 1: Infraestrutura de Dados
-- Tabelas completamente isoladas do sistema DJEN atual
-- =============================================================

-- 1. Tabela de controle dos PDFs baixados
CREATE TABLE public.dje_pdfs_diarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tribunal TEXT NOT NULL,
  data_publicacao DATE NOT NULL,
  caderno TEXT DEFAULT 'judiciario',
  url_origem TEXT,
  tamanho_bytes BIGINT,
  total_paginas INTEGER,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'baixando', 'baixado', 'processando', 'processado', 'erro')),
  erro_mensagem TEXT,
  storage_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processado_em TIMESTAMPTZ,
  UNIQUE(tribunal, data_publicacao, caderno)
);

-- 2. Tabela de conteúdo extraído e indexado (fragmentado por página)
CREATE TABLE public.dje_conteudo_indexado (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pdf_id UUID NOT NULL REFERENCES public.dje_pdfs_diarios(id) ON DELETE CASCADE,
  pagina INTEGER NOT NULL,
  conteudo_texto TEXT NOT NULL,
  processos_detectados TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(pdf_id, pagina)
);

-- 3. Tabela de resultados de busca (para comparação com sistema DJEN)
CREATE TABLE public.dje_resultados_busca (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conteudo_id UUID NOT NULL REFERENCES public.dje_conteudo_indexado(id) ON DELETE CASCADE,
  monitoramento_id UUID REFERENCES public.monitoramentos_djen(id) ON DELETE SET NULL,
  termo_encontrado TEXT NOT NULL,
  contexto TEXT,
  processo_numero TEXT,
  pagina INTEGER,
  origem TEXT NOT NULL DEFAULT 'dje_pdf',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================
-- ÍNDICES PARA PERFORMANCE
-- =============================================================

-- Índice para busca full-text em português
CREATE INDEX idx_dje_conteudo_busca_fts ON public.dje_conteudo_indexado 
USING gin(to_tsvector('portuguese', conteudo_texto));

-- Índice para busca por termo
CREATE INDEX idx_dje_resultados_termo ON public.dje_resultados_busca(termo_encontrado);

-- Índice para busca por data/tribunal
CREATE INDEX idx_dje_pdfs_tribunal_data ON public.dje_pdfs_diarios(tribunal, data_publicacao DESC);

-- Índice para busca por status (processamento em fila)
CREATE INDEX idx_dje_pdfs_status ON public.dje_pdfs_diarios(status) WHERE status IN ('pendente', 'baixado');

-- Índice para processos detectados (GIN para arrays)
CREATE INDEX idx_dje_conteudo_processos ON public.dje_conteudo_indexado USING gin(processos_detectados);

-- Índice para monitoramento_id nos resultados
CREATE INDEX idx_dje_resultados_monitoramento ON public.dje_resultados_busca(monitoramento_id);

-- =============================================================
-- RLS POLICIES (acesso via service role para Edge Functions)
-- =============================================================

ALTER TABLE public.dje_pdfs_diarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dje_conteudo_indexado ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dje_resultados_busca ENABLE ROW LEVEL SECURITY;

-- Políticas de leitura para usuários autenticados
CREATE POLICY "Usuários autenticados podem ver PDFs" 
ON public.dje_pdfs_diarios FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Usuários autenticados podem ver conteúdo indexado" 
ON public.dje_conteudo_indexado FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Usuários autenticados podem ver resultados de busca" 
ON public.dje_resultados_busca FOR SELECT 
TO authenticated 
USING (true);

-- Políticas de escrita apenas para service_role (Edge Functions)
CREATE POLICY "Service role pode inserir PDFs" 
ON public.dje_pdfs_diarios FOR INSERT 
TO service_role 
WITH CHECK (true);

CREATE POLICY "Service role pode atualizar PDFs" 
ON public.dje_pdfs_diarios FOR UPDATE 
TO service_role 
USING (true);

CREATE POLICY "Service role pode deletar PDFs" 
ON public.dje_pdfs_diarios FOR DELETE 
TO service_role 
USING (true);

CREATE POLICY "Service role pode inserir conteúdo" 
ON public.dje_conteudo_indexado FOR INSERT 
TO service_role 
WITH CHECK (true);

CREATE POLICY "Service role pode deletar conteúdo" 
ON public.dje_conteudo_indexado FOR DELETE 
TO service_role 
USING (true);

CREATE POLICY "Service role pode inserir resultados" 
ON public.dje_resultados_busca FOR INSERT 
TO service_role 
WITH CHECK (true);

CREATE POLICY "Service role pode deletar resultados" 
ON public.dje_resultados_busca FOR DELETE 
TO service_role 
USING (true);

-- =============================================================
-- STORAGE BUCKET PARA PDFs
-- =============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('dje-pdfs', 'dje-pdfs', false, 104857600, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Política de storage: apenas service_role pode fazer upload/download
CREATE POLICY "Service role acesso total DJE PDFs"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'dje-pdfs')
WITH CHECK (bucket_id = 'dje-pdfs');

-- Usuários autenticados podem baixar (para visualização na UI de comparação)
CREATE POLICY "Usuários autenticados podem baixar DJE PDFs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'dje-pdfs');