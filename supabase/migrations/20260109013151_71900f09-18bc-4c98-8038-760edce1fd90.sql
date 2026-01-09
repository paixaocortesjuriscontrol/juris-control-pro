-- =====================================================
-- MÓDULO COFRE DE SENHAS - Captura de Intimações Eletrônicas
-- =====================================================

-- Tabela principal do cofre de senhas (credenciais criptografadas)
CREATE TABLE public.cofre_senhas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL, -- Nome identificador da credencial
  sistema TEXT NOT NULL, -- PJe, ESAJ, PROJUDI, etc.
  tribunal TEXT NOT NULL, -- Ex: TJDFT, TRT10, TRF1
  login TEXT NOT NULL, -- Login do portal (criptografado seria ideal, mas simplificado aqui)
  senha_hash TEXT NOT NULL, -- Senha (em produção usar pgcrypto)
  certificado_a1_path TEXT, -- Caminho do certificado A1 no storage
  certificado_a1_senha TEXT, -- Senha do certificado
  qrcode_2fa_path TEXT, -- Caminho da imagem QR Code para 2FA
  aceite_termos_em TIMESTAMPTZ, -- Data de aceite dos termos de uso
  ativo BOOLEAN NOT NULL DEFAULT true,
  ultima_validacao TIMESTAMPTZ,
  status_validacao TEXT DEFAULT 'pendente', -- pendente, valido, invalido, erro
  mensagem_erro TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de capturas de intimações eletrônicas (vincula OAB + Tribunal + Credencial)
CREATE TABLE public.capturas_intimacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cofre_senha_id UUID NOT NULL REFERENCES public.cofre_senhas(id) ON DELETE CASCADE,
  oab_numero TEXT NOT NULL, -- Número da OAB
  oab_uf TEXT NOT NULL, -- UF da OAB
  justica TEXT NOT NULL, -- Estadual, Federal, Trabalhista
  orgao TEXT NOT NULL, -- Nome do órgão/tribunal
  instancia TEXT NOT NULL, -- 1º Grau, 2º Grau, Superior
  ativo BOOLEAN NOT NULL DEFAULT true,
  ultima_captura TIMESTAMPTZ,
  proxima_captura TIMESTAMPTZ,
  total_intimacoes_capturadas INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'aguardando_cadastro', 
  -- aguardando_cadastro, ativo, erro_credencial, erro_captura, suspenso
  mensagem_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Cada OAB+Tribunal+Instância só pode ter uma captura ativa
  CONSTRAINT unique_captura_ativa UNIQUE (oab_numero, oab_uf, orgao, instancia)
);

-- Histórico de execuções de captura
CREATE TABLE public.historico_capturas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  captura_id UUID NOT NULL REFERENCES public.capturas_intimacoes(id) ON DELETE CASCADE,
  executado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  sucesso BOOLEAN NOT NULL,
  intimacoes_encontradas INTEGER NOT NULL DEFAULT 0,
  intimacoes_novas INTEGER NOT NULL DEFAULT 0,
  tempo_execucao_ms INTEGER,
  erro TEXT,
  detalhes JSONB
);

-- Índices para performance
CREATE INDEX idx_cofre_senhas_usuario ON public.cofre_senhas(usuario_id);
CREATE INDEX idx_cofre_senhas_tribunal ON public.cofre_senhas(tribunal);
CREATE INDEX idx_capturas_oab ON public.capturas_intimacoes(oab_numero, oab_uf);
CREATE INDEX idx_capturas_status ON public.capturas_intimacoes(status);
CREATE INDEX idx_historico_captura ON public.historico_capturas(captura_id, executado_em DESC);

-- Enable RLS
ALTER TABLE public.cofre_senhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capturas_intimacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historico_capturas ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para cofre_senhas (usuário só vê suas próprias credenciais)
CREATE POLICY "Usuários podem ver suas próprias credenciais"
  ON public.cofre_senhas FOR SELECT
  USING (auth.uid() = usuario_id OR public.is_admin_or_coordenador(auth.uid()));

CREATE POLICY "Usuários podem criar suas próprias credenciais"
  ON public.cofre_senhas FOR INSERT
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Usuários podem atualizar suas próprias credenciais"
  ON public.cofre_senhas FOR UPDATE
  USING (auth.uid() = usuario_id);

CREATE POLICY "Usuários podem deletar suas próprias credenciais"
  ON public.cofre_senhas FOR DELETE
  USING (auth.uid() = usuario_id);

-- Políticas RLS para capturas_intimacoes
CREATE POLICY "Usuários podem ver capturas de suas credenciais"
  ON public.capturas_intimacoes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cofre_senhas cs 
      WHERE cs.id = cofre_senha_id 
      AND (cs.usuario_id = auth.uid() OR public.is_admin_or_coordenador(auth.uid()))
    )
  );

CREATE POLICY "Usuários podem criar capturas com suas credenciais"
  ON public.capturas_intimacoes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cofre_senhas cs 
      WHERE cs.id = cofre_senha_id 
      AND cs.usuario_id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem atualizar suas capturas"
  ON public.capturas_intimacoes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.cofre_senhas cs 
      WHERE cs.id = cofre_senha_id 
      AND cs.usuario_id = auth.uid()
    )
  );

CREATE POLICY "Usuários podem deletar suas capturas"
  ON public.capturas_intimacoes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.cofre_senhas cs 
      WHERE cs.id = cofre_senha_id 
      AND cs.usuario_id = auth.uid()
    )
  );

-- Políticas RLS para historico_capturas
CREATE POLICY "Usuários podem ver histórico de suas capturas"
  ON public.historico_capturas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.capturas_intimacoes ci
      JOIN public.cofre_senhas cs ON cs.id = ci.cofre_senha_id
      WHERE ci.id = captura_id 
      AND (cs.usuario_id = auth.uid() OR public.is_admin_or_coordenador(auth.uid()))
    )
  );

-- Trigger para updated_at
CREATE TRIGGER update_cofre_senhas_updated_at
  BEFORE UPDATE ON public.cofre_senhas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_capturas_intimacoes_updated_at
  BEFORE UPDATE ON public.capturas_intimacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bucket para certificados A1 e QR Codes (privado)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('cofre_certificados', 'cofre_certificados', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para certificados
CREATE POLICY "Usuários podem ver seus certificados"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'cofre_certificados' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Usuários podem fazer upload de seus certificados"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'cofre_certificados' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Usuários podem deletar seus certificados"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'cofre_certificados' AND auth.uid()::text = (storage.foldername(name))[1]);