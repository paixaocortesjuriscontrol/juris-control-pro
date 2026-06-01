
-- Sequence for remessa numbering per year (we'll format REM-YYYY-NNNN at app level)
CREATE SEQUENCE IF NOT EXISTS public.remessas_benner_seq START 1;

-- Header table
CREATE TABLE public.remessas_benner (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_sequencial text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'gerada',
  data_geracao timestamptz NOT NULL DEFAULT now(),
  data_envio timestamptz,
  data_conciliacao timestamptz,
  quantidade_itens integer NOT NULL DEFAULT 0,
  quantidade_aceitos integer NOT NULL DEFAULT 0,
  quantidade_rejeitados integer NOT NULL DEFAULT 0,
  quantidade_pendentes integer NOT NULL DEFAULT 0,
  filtros_aplicados jsonb,
  arquivo_path text,
  arquivo_nome text,
  email_destinatarios text[],
  email_cc text[],
  email_assunto text,
  email_corpo text,
  observacoes text,
  created_by uuid,
  enviado_por uuid,
  coordenacao_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT remessas_benner_status_chk CHECK (status IN ('gerada','enviada','retornada','conciliada','cancelada'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.remessas_benner TO authenticated;
GRANT ALL ON public.remessas_benner TO service_role;
GRANT USAGE ON SEQUENCE public.remessas_benner_seq TO authenticated, service_role;

ALTER TABLE public.remessas_benner ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view remessas" ON public.remessas_benner
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert remessas" ON public.remessas_benner
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Authenticated can update remessas" ON public.remessas_benner
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete remessas" ON public.remessas_benner
  FOR DELETE TO authenticated USING (auth.uid() = created_by);

CREATE INDEX idx_remessas_benner_coord ON public.remessas_benner(coordenacao_id);
CREATE INDEX idx_remessas_benner_status ON public.remessas_benner(status);
CREATE INDEX idx_remessas_benner_data_envio ON public.remessas_benner(data_envio DESC);

-- Items snapshot
CREATE TABLE public.remessas_benner_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  remessa_id uuid NOT NULL REFERENCES public.remessas_benner(id) ON DELETE CASCADE,
  dado_benner_id uuid,
  dossie text,
  processo text,
  turma text,
  relator text,
  tribunal text,
  status_retorno text NOT NULL DEFAULT 'pendente',
  motivo_retorno text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT remessas_benner_itens_status_chk CHECK (status_retorno IN ('pendente','aceito','rejeitado'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.remessas_benner_itens TO authenticated;
GRANT ALL ON public.remessas_benner_itens TO service_role;

ALTER TABLE public.remessas_benner_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view itens" ON public.remessas_benner_itens
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert itens" ON public.remessas_benner_itens
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update itens" ON public.remessas_benner_itens
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete itens" ON public.remessas_benner_itens
  FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_remessas_itens_remessa ON public.remessas_benner_itens(remessa_id);
CREATE INDEX idx_remessas_itens_dossie ON public.remessas_benner_itens(dossie);

-- Config table (default e-mail recipients)
CREATE TABLE public.configuracoes_carga_benner (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coordenacao_id uuid UNIQUE,
  email_padrao_para text[] DEFAULT '{}',
  email_padrao_cc text[] DEFAULT '{}',
  email_assunto_padrao text DEFAULT 'Carga Benner - Remessa {numero}',
  email_corpo_padrao text DEFAULT 'Segue em anexo a remessa {numero} com {quantidade} dossiê(s).',
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.configuracoes_carga_benner TO authenticated;
GRANT ALL ON public.configuracoes_carga_benner TO service_role;

ALTER TABLE public.configuracoes_carga_benner ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated full access config" ON public.configuracoes_carga_benner
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_remessas_benner_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_remessas_benner_updated_at
BEFORE UPDATE ON public.remessas_benner
FOR EACH ROW EXECUTE FUNCTION public.update_remessas_benner_updated_at();

-- Numbering helper: REM-YYYY-NNNNNN
CREATE OR REPLACE FUNCTION public.gerar_numero_remessa_benner()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_next bigint;
BEGIN
  v_next := nextval('public.remessas_benner_seq');
  RETURN 'REM-' || to_char(now(), 'YYYY') || '-' || lpad(v_next::text, 6, '0');
END; $$;

GRANT EXECUTE ON FUNCTION public.gerar_numero_remessa_benner() TO authenticated, service_role;

-- Storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('cargas-benner-remessas', 'cargas-benner-remessas', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated read remessas storage" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'cargas-benner-remessas');
CREATE POLICY "Authenticated insert remessas storage" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'cargas-benner-remessas');
CREATE POLICY "Authenticated update remessas storage" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'cargas-benner-remessas');
CREATE POLICY "Authenticated delete remessas storage" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'cargas-benner-remessas');
