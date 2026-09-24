CREATE TABLE public.teses_juridicas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coordenacao_id UUID REFERENCES public.coordenacoes(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  tipo_peca TEXT NOT NULL DEFAULT 'contestacao',
  area TEXT NOT NULL DEFAULT 'trabalhista',
  materia TEXT,
  assunto_cnj TEXT,
  fundamentos TEXT NOT NULL DEFAULT '',
  tipo_recurso TEXT,
  tags TEXT[] DEFAULT '{}',
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_tese_tipo_peca CHECK (tipo_peca IN ('contestacao', 'recurso_ordinario', 'contrarrazoes', 'peticao_inicial', 'memoriais', 'outros')),
  CONSTRAINT chk_tese_area CHECK (area IN ('trabalhista', 'civil', 'empresarial', 'direito_privado'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teses_juridicas TO authenticated;
GRANT ALL ON public.teses_juridicas TO service_role;

ALTER TABLE public.teses_juridicas ENABLE ROW LEVEL SECURITY;

-- Leitura: todos autenticados podem ler
CREATE POLICY "teses_juridicas_select" ON public.teses_juridicas
  FOR SELECT TO authenticated
  USING (true);

-- Escrita: admin e coordenador da coordenação
CREATE POLICY "teses_juridicas_insert" ON public.teses_juridicas
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador'));

CREATE POLICY "teses_juridicas_update" ON public.teses_juridicas
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador'));

CREATE POLICY "teses_juridicas_delete" ON public.teses_juridicas
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador'));

CREATE TRIGGER update_teses_juridicas_updated_at
  BEFORE UPDATE ON public.teses_juridicas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


CREATE TABLE public.pecas_geradas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  processo_id UUID REFERENCES public.processos(id) ON DELETE CASCADE,
  tese_id UUID REFERENCES public.teses_juridicas(id) ON DELETE SET NULL,
  tipo_peca TEXT NOT NULL DEFAULT 'contestacao',
  conteudo TEXT NOT NULL DEFAULT '',
  modelo_ia TEXT,
  custo_usd NUMERIC(10,6) DEFAULT 0,
  tokens_input INT DEFAULT 0,
  tokens_output INT DEFAULT 0,
  revisado BOOLEAN NOT NULL DEFAULT false,
  observacoes TEXT,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_peca_tipo CHECK (tipo_peca IN ('contestacao', 'recurso_ordinario', 'contrarrazoes', 'peticao_inicial', 'memoriais', 'outros'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pecas_geradas TO authenticated;
GRANT ALL ON public.pecas_geradas TO service_role;

ALTER TABLE public.pecas_geradas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pecas_geradas_select" ON public.pecas_geradas
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "pecas_geradas_insert" ON public.pecas_geradas
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = criado_por OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "pecas_geradas_update" ON public.pecas_geradas
  FOR UPDATE TO authenticated
  USING (auth.uid() = criado_por OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador'))
  WITH CHECK (auth.uid() = criado_por OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'coordenador'));

CREATE POLICY "pecas_geradas_delete" ON public.pecas_geradas
  FOR DELETE TO authenticated
  USING (auth.uid() = criado_por OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_pecas_geradas_updated_at
  BEFORE UPDATE ON public.pecas_geradas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para busca
CREATE INDEX idx_teses_coord ON public.teses_juridicas(coordenacao_id) WHERE ativo = true;
CREATE INDEX idx_teses_tipo_peca ON public.teses_juridicas(tipo_peca) WHERE ativo = true;
CREATE INDEX idx_pecas_processo ON public.pecas_geradas(processo_id);
CREATE INDEX idx_pecas_criado_por ON public.pecas_geradas(criado_por);