CREATE TABLE public.pautas_tst (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id uuid REFERENCES public.processos(id) ON DELETE SET NULL,
  processo_numero text,
  aba_origem text,
  equipe text,
  advogado_interno text,
  dossie text,
  reclamante text,
  reclamada text,
  parte_recorrente text,
  tipo_recurso text,
  data_julgamento date,
  horario text,
  modalidade text,
  link_acesso text,
  orgao text,
  relator text,
  materia_recurso_reclamante text,
  aparelhamento_reclamante text,
  chance_exito_reclamante text,
  materia_recurso_banco text,
  aparelhamento_banco text,
  chance_exito_banco text,
  honra text,
  decisao text,
  sustentacao_oral text,
  desistencia_recurso text,
  midia_negativa text,
  entrega_memoriais text,
  solicitacao_providencias_banco text,
  solicitacao_rosa_oliveira text,
  comentarios_advogado text,
  retorno_esclarecimentos text,
  resultado_proxima_sessao text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.pautas_tst ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage pautas_tst"
ON public.pautas_tst FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION update_pautas_tst_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pautas_tst_updated_at
BEFORE UPDATE ON public.pautas_tst
FOR EACH ROW EXECUTE FUNCTION update_pautas_tst_updated_at();