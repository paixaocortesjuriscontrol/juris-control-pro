-- Tabela para monitoramentos de distribuição
CREATE TABLE public.monitoramentos_distribuicao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('nome', 'cpf_cnpj', 'oab', 'termo_chave')),
  termo_busca TEXT NOT NULL,
  uf TEXT NULL,
  tribunal TEXT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_por UUID NOT NULL REFERENCES public.profiles(id),
  ultima_execucao TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para resultados encontrados
CREATE TABLE public.distribuicoes_encontradas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  monitoramento_id UUID NOT NULL REFERENCES public.monitoramentos_distribuicao(id) ON DELETE CASCADE,
  numero_processo TEXT NOT NULL,
  tribunal TEXT NULL,
  vara TEXT NULL,
  classe TEXT NULL,
  assunto TEXT NULL,
  polo_ativo TEXT NULL,
  polo_passivo TEXT NULL,
  data_distribuicao TIMESTAMP WITH TIME ZONE NULL,
  dados_completos JSONB NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'importado', 'ignorado')),
  processo_id UUID NULL REFERENCES public.processos(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_monitoramentos_distribuicao_criado_por ON public.monitoramentos_distribuicao(criado_por);
CREATE INDEX idx_monitoramentos_distribuicao_ativo ON public.monitoramentos_distribuicao(ativo);
CREATE INDEX idx_distribuicoes_encontradas_monitoramento ON public.distribuicoes_encontradas(monitoramento_id);
CREATE INDEX idx_distribuicoes_encontradas_status ON public.distribuicoes_encontradas(status);
CREATE UNIQUE INDEX idx_distribuicoes_encontradas_numero ON public.distribuicoes_encontradas(numero_processo, monitoramento_id);

-- Enable RLS
ALTER TABLE public.monitoramentos_distribuicao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distribuicoes_encontradas ENABLE ROW LEVEL SECURITY;

-- Políticas para monitoramentos_distribuicao (apenas admins e coordenadores)
CREATE POLICY "Admins e coordenadores podem gerenciar monitoramentos"
ON public.monitoramentos_distribuicao
FOR ALL
USING (is_admin_or_coordenador(auth.uid()));

-- Políticas para distribuicoes_encontradas
CREATE POLICY "Admins e coordenadores podem ver distribuições"
ON public.distribuicoes_encontradas
FOR SELECT
USING (is_admin_or_coordenador(auth.uid()));

CREATE POLICY "Admins e coordenadores podem atualizar distribuições"
ON public.distribuicoes_encontradas
FOR UPDATE
USING (is_admin_or_coordenador(auth.uid()));

CREATE POLICY "Sistema pode inserir distribuições"
ON public.distribuicoes_encontradas
FOR INSERT
WITH CHECK (true);

-- Trigger para updated_at
CREATE TRIGGER update_monitoramentos_distribuicao_updated_at
BEFORE UPDATE ON public.monitoramentos_distribuicao
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Configuração de monitoramento para distribuições
INSERT INTO public.configuracoes_monitoramento (tipo, frequencia, ativo)
VALUES ('distribuicoes', 'diario', true)
ON CONFLICT DO NOTHING;