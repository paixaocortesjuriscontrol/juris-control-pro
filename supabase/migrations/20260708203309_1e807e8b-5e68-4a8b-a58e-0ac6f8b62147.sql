
CREATE TABLE public.buscas_publicacao_resultados (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  execucao_id uuid NOT NULL REFERENCES public.execucoes_servidor(id) ON DELETE CASCADE,
  processo_original text NOT NULL,
  processo_digitos text NOT NULL,
  id_djen text,
  tribunal text,
  data_disponibilizacao timestamptz,
  data_publicacao date,
  orgao text,
  tipo_comunicacao text,
  conteudo text,
  raw_json jsonb,
  dedupe_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX buscas_publ_res_dedupe_uk
  ON public.buscas_publicacao_resultados (execucao_id, processo_digitos, dedupe_key);

CREATE INDEX buscas_publ_res_execucao_idx
  ON public.buscas_publicacao_resultados (execucao_id);

CREATE INDEX buscas_publ_res_processo_idx
  ON public.buscas_publicacao_resultados (execucao_id, processo_digitos);

GRANT SELECT ON public.buscas_publicacao_resultados TO authenticated;
GRANT ALL ON public.buscas_publicacao_resultados TO service_role;

ALTER TABLE public.buscas_publicacao_resultados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read own busca resultados"
  ON public.buscas_publicacao_resultados
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "service_role manage busca resultados"
  ON public.buscas_publicacao_resultados
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
