
CREATE TABLE public.alertas_processos_nao_cadastrados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  termo_id uuid NOT NULL REFERENCES public.termos_monitoramento(id) ON DELETE CASCADE,
  processo_numero text NOT NULL,
  termo_encontrado text NOT NULL,
  contexto text,
  conteudo_publicacao text,
  prioridade text NOT NULL DEFAULT 'media',
  status text NOT NULL DEFAULT 'pendente',
  coordenacao_id uuid REFERENCES public.coordenacoes(id),
  publicacao_id uuid,
  tribunal text,
  tratado_por uuid REFERENCES auth.users(id),
  tratado_em timestamptz,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_alertas_proc_nao_cad_status ON public.alertas_processos_nao_cadastrados(status);
CREATE INDEX idx_alertas_proc_nao_cad_created ON public.alertas_processos_nao_cadastrados(created_at);
CREATE INDEX idx_alertas_proc_nao_cad_coord ON public.alertas_processos_nao_cadastrados(coordenacao_id);
CREATE INDEX idx_alertas_proc_nao_cad_processo ON public.alertas_processos_nao_cadastrados(processo_numero);

CREATE TRIGGER update_alertas_proc_nao_cad_updated_at
  BEFORE UPDATE ON public.alertas_processos_nao_cadastrados
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.alertas_processos_nao_cadastrados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read alertas_processos_nao_cadastrados"
  ON public.alertas_processos_nao_cadastrados
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert alertas_processos_nao_cadastrados"
  ON public.alertas_processos_nao_cadastrados
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update alertas_processos_nao_cadastrados"
  ON public.alertas_processos_nao_cadastrados
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Service role full access alertas_processos_nao_cadastrados"
  ON public.alertas_processos_nao_cadastrados
  FOR ALL TO service_role USING (true) WITH CHECK (true);
