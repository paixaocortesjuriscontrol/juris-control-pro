-- Tabela para termos estratégicos de monitoramento
CREATE TABLE public.termos_monitoramento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  termo TEXT NOT NULL,
  descricao TEXT,
  categoria TEXT NOT NULL DEFAULT 'geral', -- bloqueio, liminar, sentenca, decisao, citacao, geral
  prioridade TEXT NOT NULL DEFAULT 'media', -- baixa, media, alta, urgente
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_por UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para alertas gerados pelo monitoramento
CREATE TABLE public.alertas_monitoramento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  termo_id UUID NOT NULL REFERENCES public.termos_monitoramento(id) ON DELETE CASCADE,
  processo_id UUID NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  movimentacao_id UUID REFERENCES public.movimentacoes(id) ON DELETE CASCADE,
  termo_encontrado TEXT NOT NULL,
  contexto TEXT, -- trecho do texto onde o termo foi encontrado
  prioridade TEXT NOT NULL DEFAULT 'media',
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente, visualizado, tratado, ignorado
  tratado_por UUID REFERENCES public.profiles(id),
  tratado_em TIMESTAMP WITH TIME ZONE,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para carteiras de processos por critérios
CREATE TABLE public.carteiras_processos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL DEFAULT 'manual', -- manual, automatica
  criterios JSONB DEFAULT '{}', -- critérios para carteiras automáticas
  cor TEXT DEFAULT '#3B82F6',
  criado_por UUID NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_termos_monitoramento_ativo ON public.termos_monitoramento(ativo);
CREATE INDEX idx_termos_monitoramento_categoria ON public.termos_monitoramento(categoria);
CREATE INDEX idx_alertas_monitoramento_status ON public.alertas_monitoramento(status);
CREATE INDEX idx_alertas_monitoramento_processo ON public.alertas_monitoramento(processo_id);
CREATE INDEX idx_alertas_monitoramento_termo ON public.alertas_monitoramento(termo_id);
CREATE INDEX idx_carteiras_processos_ativo ON public.carteiras_processos(ativo);

-- RLS para termos_monitoramento
ALTER TABLE public.termos_monitoramento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins e coordenadores podem gerenciar termos"
ON public.termos_monitoramento FOR ALL
USING (is_admin_or_coordenador(auth.uid()));

CREATE POLICY "Usuários podem visualizar termos ativos"
ON public.termos_monitoramento FOR SELECT
USING (ativo = true);

-- RLS para alertas_monitoramento
ALTER TABLE public.alertas_monitoramento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver alertas de processos acessíveis"
ON public.alertas_monitoramento FOR SELECT
USING (can_access_processo(auth.uid(), processo_id));

CREATE POLICY "Usuários podem atualizar alertas de processos acessíveis"
ON public.alertas_monitoramento FOR UPDATE
USING (can_access_processo(auth.uid(), processo_id));

CREATE POLICY "Sistema pode inserir alertas"
ON public.alertas_monitoramento FOR INSERT
WITH CHECK (true);

-- RLS para carteiras_processos
ALTER TABLE public.carteiras_processos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins e coordenadores podem gerenciar carteiras"
ON public.carteiras_processos FOR ALL
USING (is_admin_or_coordenador(auth.uid()));

CREATE POLICY "Usuários podem visualizar carteiras ativas"
ON public.carteiras_processos FOR SELECT
USING (ativo = true);

-- Trigger para updated_at
CREATE TRIGGER update_termos_monitoramento_updated_at
  BEFORE UPDATE ON public.termos_monitoramento
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_carteiras_processos_updated_at
  BEFORE UPDATE ON public.carteiras_processos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();