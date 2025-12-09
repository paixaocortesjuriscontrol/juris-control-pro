-- Tabela para armazenar configurações de monitoramento
CREATE TABLE public.configuracoes_monitoramento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo VARCHAR(50) NOT NULL UNIQUE,
  frequencia VARCHAR(20) NOT NULL DEFAULT 'diario',
  ativo BOOLEAN NOT NULL DEFAULT true,
  ultima_execucao TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Inserir configuração padrão para redistribuições
INSERT INTO public.configuracoes_monitoramento (tipo, frequencia, ativo)
VALUES ('redistribuicoes', 'diario', true);

-- Habilitar RLS
ALTER TABLE public.configuracoes_monitoramento ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ver e editar configurações
CREATE POLICY "Admins podem ver configurações" 
ON public.configuracoes_monitoramento 
FOR SELECT 
USING (is_admin_or_coordenador(auth.uid()));

CREATE POLICY "Admins podem editar configurações" 
ON public.configuracoes_monitoramento 
FOR UPDATE 
USING (is_admin_or_coordenador(auth.uid()));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_configuracoes_monitoramento_updated_at
BEFORE UPDATE ON public.configuracoes_monitoramento
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();