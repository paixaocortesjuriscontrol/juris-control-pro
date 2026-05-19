
-- =====================================================================
-- DJEN Termos Kurier: tabelas, RLS, seeds e configuração
-- =====================================================================

-- 1) Credenciais Kurier
CREATE TABLE IF NOT EXISTS public.kurier_credenciais (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  login text NOT NULL UNIQUE,
  senha_encrypted text,
  ativo boolean NOT NULL DEFAULT false,
  prioridade integer NOT NULL DEFAULT 0,
  ultimo_uso timestamptz,
  ultimo_status text,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kurier_credenciais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/coord podem ver credenciais kurier"
  ON public.kurier_credenciais FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'coordenador')
  );

CREATE POLICY "Admins/coord podem inserir credenciais kurier"
  ON public.kurier_credenciais FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'coordenador')
  );

CREATE POLICY "Admins/coord podem atualizar credenciais kurier"
  ON public.kurier_credenciais FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'coordenador')
  );

CREATE POLICY "Admins/coord podem excluir credenciais kurier"
  ON public.kurier_credenciais FOR DELETE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'coordenador')
  );

CREATE TRIGGER trg_kurier_credenciais_updated_at
  BEFORE UPDATE ON public.kurier_credenciais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed dos 10 logins iniciais (todos inativos, sem senha)
INSERT INTO public.kurier_credenciais (login, ativo, prioridade, observacao) VALUES
  ('paixaoc',           false, 100, 'Login inicial do escritório - aguardando senha'),
  ('paixaocortes.df',   false,  90, 'Login inicial do escritório - aguardando senha'),
  ('paixaoc.02',        false,  80, 'Login inicial do escritório - aguardando senha'),
  ('paixaoc.04',        false,  70, 'Login inicial do escritório - aguardando senha'),
  ('paixaoc.heinz',     false,  60, 'Login inicial do escritório - aguardando senha'),
  ('paixao.adv',        false,  50, 'Login inicial do escritório - aguardando senha'),
  ('paixaoc.07',        false,  40, 'Login inicial do escritório - aguardando senha'),
  ('paixaocortes2',     false,  30, 'Login inicial do escritório - aguardando senha'),
  ('paixaoc.08',        false,  20, 'Login inicial do escritório - aguardando senha'),
  ('paixaoc.09',        false,  10, 'Login inicial do escritório - aguardando senha'),
  ('paixao.cortes.adv', false,   0, 'Login inicial do escritório - aguardando senha')
ON CONFLICT (login) DO NOTHING;


-- 2) Publicações brutas vindas da Kurier (audit + idempotência)
CREATE TABLE IF NOT EXISTS public.kurier_publicacoes_raw (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  id_kurier text NOT NULL UNIQUE,
  credencial_id uuid REFERENCES public.kurier_credenciais(id) ON DELETE SET NULL,
  login_usado text,
  payload jsonb NOT NULL,
  recebida_em timestamptz NOT NULL DEFAULT now(),
  confirmada boolean NOT NULL DEFAULT false,
  confirmada_em timestamptz,
  publicacao_djen_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kurier_raw_recebida_em ON public.kurier_publicacoes_raw (recebida_em DESC);
CREATE INDEX IF NOT EXISTS idx_kurier_raw_confirmada ON public.kurier_publicacoes_raw (confirmada);

ALTER TABLE public.kurier_publicacoes_raw ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/coord podem ver kurier raw"
  ON public.kurier_publicacoes_raw FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'coordenador')
  );

-- INSERT/UPDATE feitos via service_role (edge functions), sem políticas para usuários comuns.


-- 3) Execuções Kurier (histórico de chamadas)
CREATE TABLE IF NOT EXISTS public.kurier_execucoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  credencial_id uuid REFERENCES public.kurier_credenciais(id) ON DELETE SET NULL,
  login_usado text,
  lote text NOT NULL CHECK (lote IN ('consulta','confirmacao','personalizada','quantidade','run')),
  total_recebidas integer NOT NULL DEFAULT 0,
  total_confirmadas integer NOT NULL DEFAULT 0,
  total_novas integer NOT NULL DEFAULT 0,
  total_duplicadas integer NOT NULL DEFAULT 0,
  total_descartadas integer NOT NULL DEFAULT 0,
  erro text,
  metadata jsonb,
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  finalizado_em timestamptz
);

CREATE INDEX IF NOT EXISTS idx_kurier_exec_iniciado_em ON public.kurier_execucoes (iniciado_em DESC);
CREATE INDEX IF NOT EXISTS idx_kurier_exec_lote ON public.kurier_execucoes (lote);

ALTER TABLE public.kurier_execucoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/coord podem ver execucoes kurier"
  ON public.kurier_execucoes FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'coordenador')
  );


-- 4) Singleton em configuracoes_monitoramento
INSERT INTO public.configuracoes_monitoramento (tipo, frequencia, ativo, coordenacao_id, metadata)
VALUES ('kurier', '30min', false, NULL, '{}'::jsonb)
ON CONFLICT DO NOTHING;


-- 5) Atualizar CHECK constraint de execucoes_agendadas para aceitar 'kurier'
DO $$
DECLARE
  con_name text;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'public.execucoes_agendadas'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%tipo%';

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.execucoes_agendadas DROP CONSTRAINT %I', con_name);
  END IF;

  ALTER TABLE public.execucoes_agendadas
    ADD CONSTRAINT execucoes_agendadas_tipo_check
    CHECK (tipo IN (
      'djen','djen_processos','djen_termos','djen_termos_pro','djen_termos_flash',
      'djen_termos_paralela','djet_pautas_paralela','stf_termos',
      'andamentos','redistribuicoes','distribuicoes','termos','kurier'
    ));
EXCEPTION WHEN OTHERS THEN
  -- Se a tabela ou constraint não existir, ignora silenciosamente
  NULL;
END $$;
