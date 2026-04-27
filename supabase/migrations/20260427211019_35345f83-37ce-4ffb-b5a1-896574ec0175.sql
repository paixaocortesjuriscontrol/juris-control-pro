-- Enum de classificação
DO $$ BEGIN
  CREATE TYPE public.classificacao_tst_enum AS ENUM ('POSITIVO', 'NEGATIVO', 'IMPEDIDA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabela de Turmas
CREATE TABLE IF NOT EXISTS public.classificacao_turmas_tst (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  classificacao public.classificacao_tst_enum NOT NULL,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.classificacao_turmas_tst ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view turmas tst"
  ON public.classificacao_turmas_tst FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "Authenticated can insert turmas tst"
  ON public.classificacao_turmas_tst FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update turmas tst"
  ON public.classificacao_turmas_tst FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete turmas tst"
  ON public.classificacao_turmas_tst FOR DELETE
  TO authenticated USING (true);

CREATE TRIGGER trg_classificacao_turmas_tst_updated
  BEFORE UPDATE ON public.classificacao_turmas_tst
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de Relatores
CREATE TABLE IF NOT EXISTS public.classificacao_relatores_tst (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  cargo TEXT,
  classificacao public.classificacao_tst_enum NOT NULL,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.classificacao_relatores_tst ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view relatores tst"
  ON public.classificacao_relatores_tst FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "Authenticated can insert relatores tst"
  ON public.classificacao_relatores_tst FOR INSERT
  TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update relatores tst"
  ON public.classificacao_relatores_tst FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete relatores tst"
  ON public.classificacao_relatores_tst FOR DELETE
  TO authenticated USING (true);

CREATE TRIGGER trg_classificacao_relatores_tst_updated
  BEFORE UPDATE ON public.classificacao_relatores_tst
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SEED Turmas
INSERT INTO public.classificacao_turmas_tst (nome, classificacao) VALUES
  ('1ª Turma', 'POSITIVO'),
  ('2ª Turma', 'NEGATIVO'),
  ('3ª Turma', 'NEGATIVO'),
  ('4ª Turma', 'POSITIVO'),
  ('5ª Turma', 'POSITIVO'),
  ('6ª Turma', 'NEGATIVO'),
  ('7ª Turma', 'NEGATIVO'),
  ('8ª Turma', 'POSITIVO'),
  ('SBDI-1', 'NEGATIVO'),
  ('SBDI-2', 'POSITIVO'),
  ('Pleno', 'NEGATIVO')
ON CONFLICT (nome) DO NOTHING;

-- SEED Relatores
INSERT INTO public.classificacao_relatores_tst (nome, cargo, classificacao, observacao) VALUES
  ('Luiz Philippe Vieira de Mello Filho', 'Presidente do Tribunal', 'NEGATIVO', NULL),
  ('Guilherme Augusto Caputo Bastos', 'Vice-Presidente do Tribunal', 'POSITIVO', NULL),
  ('José Roberto Freire Pimenta', 'Corregedor-Geral da Justiça do Trabalho', 'NEGATIVO', NULL),
  ('Ives Gandra da Silva Martins Filho', NULL, 'POSITIVO', NULL),
  ('Maria Cristina Irigoyen Peduzzi', NULL, 'IMPEDIDA', 'Impedida nos nossos casos. Se necessário marcar polaridade, considerar POSITIVO.'),
  ('Lelio Bentes Corrêa', NULL, 'NEGATIVO', NULL),
  ('Mauricio José Godinho Delgado', NULL, 'NEGATIVO', NULL),
  ('Kátia Magalhães Arruda', NULL, 'NEGATIVO', NULL),
  ('Augusto César Leite de Carvalho', NULL, 'NEGATIVO', NULL),
  ('Delaíde Alves Miranda Arantes', NULL, 'NEGATIVO', NULL),
  ('Hugo Carlos Scheuermann', NULL, 'NEGATIVO', NULL),
  ('Alexandre de Souza Agra Belmonte', NULL, 'POSITIVO', NULL),
  ('Cláudio Mascarenhas Brandão', NULL, 'NEGATIVO', NULL),
  ('Douglas Alencar Rodrigues', NULL, 'POSITIVO', NULL),
  ('Maria Helena Mallmann', NULL, 'NEGATIVO', NULL),
  ('Breno Medeiros', NULL, 'POSITIVO', NULL),
  ('Alexandre Luiz Ramos', NULL, 'POSITIVO', NULL),
  ('Luiz José Dezena da Silva', NULL, 'POSITIVO', NULL),
  ('Evandro Pereira Valadão Lopes', NULL, 'POSITIVO', NULL),
  ('Amaury Rodrigues Pinto Junior', NULL, 'POSITIVO', NULL),
  ('Alberto Bastos Balazeiro', NULL, 'NEGATIVO', NULL),
  ('Morgana de Almeida Richa', NULL, 'POSITIVO', NULL),
  ('Sergio Pinto Martins', NULL, 'POSITIVO', NULL),
  ('Liana Chaib', NULL, 'NEGATIVO', NULL),
  ('Antônio Fabrício de Matos Gonçalves', NULL, 'NEGATIVO', NULL),
  ('José Pedro de Camargo Rodrigues de Souza', 'Desembargador', 'POSITIVO', NULL),
  ('João Pedro Silvestrin', 'Desembargador', 'POSITIVO', NULL)
ON CONFLICT (nome) DO NOTHING;