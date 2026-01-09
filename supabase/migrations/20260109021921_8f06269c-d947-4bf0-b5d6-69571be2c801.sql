-- Tabela para armazenar dados completos de processos capturados
CREATE TABLE public.processos_capturados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cofre_senha_id UUID REFERENCES public.cofre_senhas(id) ON DELETE SET NULL,
  captura_id UUID REFERENCES public.capturas_intimacoes(id) ON DELETE SET NULL,
  processo_numero TEXT NOT NULL,
  sistema TEXT NOT NULL, -- 'pje', 'esaj', 'projudi'
  tribunal TEXT,
  vara TEXT,
  classe TEXT,
  assunto TEXT,
  data_distribuicao DATE,
  valor_causa NUMERIC(15,2),
  situacao TEXT,
  partes JSONB DEFAULT '[]'::jsonb, -- [{tipo, nome, cpf_cnpj, advogados: [{nome, oab}]}]
  movimentacoes JSONB DEFAULT '[]'::jsonb, -- [{data, descricao, tipo}]
  documentos JSONB DEFAULT '[]'::jsonb, -- [{nome, tipo, data, url_storage}]
  dados_completos JSONB, -- dados brutos capturados
  ultima_atualizacao TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(processo_numero, sistema)
);

-- Índices
CREATE INDEX idx_processos_capturados_numero ON public.processos_capturados(processo_numero);
CREATE INDEX idx_processos_capturados_cofre ON public.processos_capturados(cofre_senha_id);
CREATE INDEX idx_processos_capturados_sistema ON public.processos_capturados(sistema);

-- RLS
ALTER TABLE public.processos_capturados ENABLE ROW LEVEL SECURITY;

-- Políticas: usuário vê processos capturados com suas credenciais ou se for admin/coordenador
CREATE POLICY "Usuários veem processos capturados com suas credenciais"
ON public.processos_capturados FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.cofre_senhas cs
    WHERE cs.id = processos_capturados.cofre_senha_id
    AND cs.usuario_id = auth.uid()
  )
  OR public.is_admin_or_coordenador(auth.uid())
);

CREATE POLICY "Sistema pode inserir processos capturados"
ON public.processos_capturados FOR INSERT
WITH CHECK (true);

CREATE POLICY "Sistema pode atualizar processos capturados"
ON public.processos_capturados FOR UPDATE
USING (true);

-- Trigger updated_at
CREATE TRIGGER update_processos_capturados_updated_at
BEFORE UPDATE ON public.processos_capturados
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela para logs de captura detalhados
CREATE TABLE public.logs_captura_tribunal (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  captura_id UUID REFERENCES public.capturas_intimacoes(id) ON DELETE CASCADE,
  cofre_senha_id UUID REFERENCES public.cofre_senhas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL, -- 'info', 'warning', 'error', 'success'
  mensagem TEXT NOT NULL,
  detalhes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_logs_captura_tribunal_captura ON public.logs_captura_tribunal(captura_id);
CREATE INDEX idx_logs_captura_tribunal_created ON public.logs_captura_tribunal(created_at DESC);

ALTER TABLE public.logs_captura_tribunal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem logs de suas capturas"
ON public.logs_captura_tribunal FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.cofre_senhas cs
    WHERE cs.id = logs_captura_tribunal.cofre_senha_id
    AND cs.usuario_id = auth.uid()
  )
  OR public.is_admin_or_coordenador(auth.uid())
);

CREATE POLICY "Sistema pode inserir logs"
ON public.logs_captura_tribunal FOR INSERT
WITH CHECK (true);