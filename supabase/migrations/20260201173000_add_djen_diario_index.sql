-- Indexação diária do DJEN (Postgres + FTS)
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TABLE IF NOT EXISTS public.djen_diario_index (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diario_ymd date NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_andamento', 'concluido', 'erro')),
  total_publicacoes integer DEFAULT 0,
  atualizado_em timestamptz DEFAULT now(),
  erro_mensagem text
);

CREATE TABLE IF NOT EXISTS public.djen_diario_publicacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  diario_ymd date NOT NULL,
  tribunal text,
  data_disponibilizacao date,
  data_publicacao date,
  processo_numero text,
  conteudo text NOT NULL,
  hash_global text NOT NULL,
  raw_json jsonb,
  created_at timestamptz DEFAULT now(),
  conteudo_tsv tsvector GENERATED ALWAYS AS (
    to_tsvector('portuguese', unaccent(conteudo))
  ) STORED
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_djen_diario_hash_global
  ON public.djen_diario_publicacoes (hash_global);

CREATE INDEX IF NOT EXISTS idx_djen_diario_ymd
  ON public.djen_diario_publicacoes (diario_ymd);

CREATE INDEX IF NOT EXISTS idx_djen_diario_tribunal
  ON public.djen_diario_publicacoes (tribunal);

CREATE INDEX IF NOT EXISTS idx_djen_diario_tsv
  ON public.djen_diario_publicacoes
  USING gin (conteudo_tsv);
