-- Tabela de Situações de Envio de Carga (Santander)
CREATE TABLE IF NOT EXISTS public.situacoes_envio_carga (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.situacoes_envio_carga ENABLE ROW LEVEL SECURITY;

-- Leitura para todos os autenticados
CREATE POLICY "Autenticados podem ler situacoes_envio_carga"
ON public.situacoes_envio_carga FOR SELECT TO authenticated USING (true);

-- Apenas admins podem alterar
CREATE POLICY "Admins gerenciam situacoes_envio_carga"
ON public.situacoes_envio_carga FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed das 7 situações
INSERT INTO public.situacoes_envio_carga (codigo, nome, ordem) VALUES
  ('CARGA_I',   'Carga I - Completa PCA',            1),
  ('CARGA_II',  'Carga II - Módulo Cinza Completo',  2),
  ('CARGA_III', 'Carga III - Módulo Cinza Incompleto', 3),
  ('CARGA_IV',  'Carga IV - Completa SANTANDER',     4),
  ('CARGA_V',   'Carga V - Complementada Escritório', 5),
  ('CARGA_VI',  'Carga VI - Pronta para envio',      6),
  ('CARGA_VII', 'Carga VII - Pendente de envio',     7)
ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome, ordem = EXCLUDED.ordem;

-- Coluna na dados_benner para registrar a situação de cada processo
ALTER TABLE public.dados_benner
  ADD COLUMN IF NOT EXISTS situacao_envio_carga_id UUID REFERENCES public.situacoes_envio_carga(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dados_benner_situacao_envio_carga
  ON public.dados_benner(situacao_envio_carga_id);

-- Trigger updated_at
CREATE TRIGGER trg_situacoes_envio_carga_updated
BEFORE UPDATE ON public.situacoes_envio_carga
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();