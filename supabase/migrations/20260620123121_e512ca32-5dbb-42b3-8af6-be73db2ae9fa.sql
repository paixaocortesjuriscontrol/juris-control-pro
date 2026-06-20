-- Junction table: which executions saw which server publication
CREATE TABLE public.publicacoes_djen_servidor_execucoes (
  publicacao_id uuid NOT NULL REFERENCES public.publicacoes_djen_servidor(id) ON DELETE CASCADE,
  execucao_id uuid NOT NULL REFERENCES public.execucoes_servidor(id) ON DELETE CASCADE,
  tipo_engine text NOT NULL CHECK (tipo_engine IN ('paralela','pautas')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (publicacao_id, execucao_id)
);

GRANT SELECT ON public.publicacoes_djen_servidor_execucoes TO authenticated;
GRANT ALL ON public.publicacoes_djen_servidor_execucoes TO service_role;

ALTER TABLE public.publicacoes_djen_servidor_execucoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_select_pubdjen_servidor_execucoes"
  ON public.publicacoes_djen_servidor_execucoes
  FOR SELECT TO authenticated
  USING (true);

CREATE INDEX idx_pubdjen_serv_exec_execucao ON public.publicacoes_djen_servidor_execucoes(execucao_id);
CREATE INDEX idx_pubdjen_serv_exec_publicacao ON public.publicacoes_djen_servidor_execucoes(publicacao_id);

-- Backfill: cada publicação já tem execucao_id da primeira execução que a viu
INSERT INTO public.publicacoes_djen_servidor_execucoes (publicacao_id, execucao_id, tipo_engine, created_at)
SELECT p.id, p.execucao_id,
       CASE WHEN p.origem = 'pautas' THEN 'pautas' ELSE 'paralela' END,
       COALESCE(p.created_at, now())
FROM public.publicacoes_djen_servidor p
WHERE p.execucao_id IS NOT NULL
ON CONFLICT DO NOTHING;