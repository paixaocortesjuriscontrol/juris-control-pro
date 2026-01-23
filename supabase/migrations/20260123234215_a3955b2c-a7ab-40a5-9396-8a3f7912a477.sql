-- ================================================================
-- TABELA DE CONFIGURAÇÃO DE ALERTAS POR COORDENAÇÃO
-- Permite configurar WhatsApp, E-mail e tipos de alertas por coordenação
-- ================================================================

CREATE TABLE public.config_alertas_coordenacao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coordenacao_id UUID NOT NULL REFERENCES public.coordenacoes(id) ON DELETE CASCADE,
  
  -- Canais habilitados
  email_habilitado BOOLEAN NOT NULL DEFAULT false,
  whatsapp_habilitado BOOLEAN NOT NULL DEFAULT false,
  
  -- Destinatários
  emails_destinatarios TEXT[] DEFAULT '{}',
  telefones_whatsapp TEXT[] DEFAULT '{}',
  
  -- Tipos de alertas habilitados (array de tipos)
  tipos_alerta TEXT[] DEFAULT ARRAY['djen', 'distribuicoes', 'alertas360', 'redistribuicoes', 'prazos', 'andamentos'],
  
  -- Configurações adicionais
  apenas_urgentes BOOLEAN NOT NULL DEFAULT false,
  horario_inicio TIME DEFAULT '08:00',
  horario_fim TIME DEFAULT '18:00',
  dias_semana INTEGER[] DEFAULT ARRAY[1, 2, 3, 4, 5], -- 0=domingo, 1=segunda... 6=sábado
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  
  CONSTRAINT config_alertas_coordenacao_unique UNIQUE (coordenacao_id)
);

-- Índice para busca rápida por coordenação
CREATE INDEX idx_config_alertas_coordenacao_id ON public.config_alertas_coordenacao(coordenacao_id);

-- Enable RLS
ALTER TABLE public.config_alertas_coordenacao ENABLE ROW LEVEL SECURITY;

-- Policies: coordenadores e admins podem ver e editar
CREATE POLICY "Coordenadores e admins podem visualizar configs de alertas"
ON public.config_alertas_coordenacao
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'coordenador')
  )
  OR
  EXISTS (
    SELECT 1 FROM public.membros_coordenacao 
    WHERE usuario_id = auth.uid() 
    AND coordenacao_id = config_alertas_coordenacao.coordenacao_id
  )
);

CREATE POLICY "Coordenadores e admins podem criar configs de alertas"
ON public.config_alertas_coordenacao
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'coordenador')
  )
);

CREATE POLICY "Coordenadores e admins podem atualizar configs de alertas"
ON public.config_alertas_coordenacao
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'coordenador')
  )
);

CREATE POLICY "Admins podem deletar configs de alertas"
ON public.config_alertas_coordenacao
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Trigger para updated_at
CREATE TRIGGER update_config_alertas_coordenacao_updated_at
BEFORE UPDATE ON public.config_alertas_coordenacao
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ================================================================
-- TABELA DE HISTÓRICO DE ALERTAS ENVIADOS
-- Para tracking de envios e evitar duplicatas
-- ================================================================

CREATE TABLE public.historico_alertas_enviados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coordenacao_id UUID NOT NULL REFERENCES public.coordenacoes(id) ON DELETE CASCADE,
  tipo_alerta TEXT NOT NULL,
  canal TEXT NOT NULL CHECK (canal IN ('email', 'whatsapp')),
  destinatario TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  referencia_id UUID, -- ID do alerta/notificação/publicação original
  enviado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'enviado' CHECK (status IN ('enviado', 'falha', 'pendente')),
  erro TEXT
);

-- Índices para consultas
CREATE INDEX idx_historico_alertas_coordenacao ON public.historico_alertas_enviados(coordenacao_id);
CREATE INDEX idx_historico_alertas_tipo ON public.historico_alertas_enviados(tipo_alerta);
CREATE INDEX idx_historico_alertas_data ON public.historico_alertas_enviados(enviado_em DESC);

-- Enable RLS
ALTER TABLE public.historico_alertas_enviados ENABLE ROW LEVEL SECURITY;

-- Policy: coordenadores e admins podem ver histórico
CREATE POLICY "Coordenadores e admins podem ver histórico de alertas"
ON public.historico_alertas_enviados
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'coordenador')
  )
  OR
  EXISTS (
    SELECT 1 FROM public.membros_coordenacao 
    WHERE usuario_id = auth.uid() 
    AND coordenacao_id = historico_alertas_enviados.coordenacao_id
  )
);

-- Policy: sistema pode inserir (via service role)
CREATE POLICY "Service role pode inserir histórico"
ON public.historico_alertas_enviados
FOR INSERT
WITH CHECK (true);