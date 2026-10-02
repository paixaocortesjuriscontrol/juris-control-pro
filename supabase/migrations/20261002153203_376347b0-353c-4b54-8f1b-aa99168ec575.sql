CREATE TABLE public.migracoes_projuris (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coordenacao_id uuid NOT NULL REFERENCES public.coordenacoes(id),
  nome text NOT NULL,
  status text NOT NULL DEFAULT 'em_andamento',
  mapeamento jsonb,
  contadores jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_por uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.migracoes_projuris TO authenticated;
GRANT ALL ON public.migracoes_projuris TO service_role;
ALTER TABLE public.migracoes_projuris ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Somente admin - migracoes" ON public.migracoes_projuris FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.migracoes_projuris_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  migracao_id uuid NOT NULL REFERENCES public.migracoes_projuris(id) ON DELETE CASCADE,
  tipo text NOT NULL,            -- processo | tarefa | anexo
  chave_externa text,            -- identificador Projuris / caminho no zip
  registro_id uuid,              -- id criado no Juris Control
  status text NOT NULL,          -- criado | existente | pulado | erro | desfeito
  motivo text,
  dados jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.migracoes_projuris_itens(migracao_id);
CREATE INDEX ON public.migracoes_projuris_itens(tipo, chave_externa);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.migracoes_projuris_itens TO authenticated;
GRANT ALL ON public.migracoes_projuris_itens TO service_role;
ALTER TABLE public.migracoes_projuris_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Somente admin - migracoes itens" ON public.migracoes_projuris_itens FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_migracoes_projuris_updated BEFORE UPDATE ON public.migracoes_projuris
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();