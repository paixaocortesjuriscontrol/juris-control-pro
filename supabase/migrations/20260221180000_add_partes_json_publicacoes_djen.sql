-- Dados do "lado esquerdo" da publicação (Parte(s), Advogado(s)) gravados na captura; PDF só lê do banco.
ALTER TABLE public.publicacoes_djen
  ADD COLUMN IF NOT EXISTS partes_json jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.publicacoes_djen.partes_json IS 'Lista de nomes de partes extraída na captura (lado esquerdo da publicação).';
