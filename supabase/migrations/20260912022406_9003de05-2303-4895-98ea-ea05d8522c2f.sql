ALTER TABLE public.dados_benner
  ADD COLUMN IF NOT EXISTS sem_nenhuma_materia_dossie boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_dados_benner_sem_nenhuma_materia_dossie
  ON public.dados_benner (sem_nenhuma_materia_dossie)
  WHERE sem_nenhuma_materia_dossie = true;

UPDATE public.dados_benner AS db
SET sem_nenhuma_materia_dossie =
  db.status IN ('pronto_envio', 'planilhado', 'enviado')
  AND NOT EXISTS (
    SELECT 1
    FROM regexp_split_to_table(
      concat_ws(';',
        db.materias_recurso_reclamante,
        db.materias_recurso_banco,
        db.materias_recurso_terceiro
      ),
      E'[;\\n]+'
    ) AS materia(valor)
    JOIN public.pedidos_por_dossie AS ppd
      ON ppd.dossie = btrim(db.dossie)
     AND ppd.pedido_normalizado = lower(public.unaccent(btrim(materia.valor)))
    WHERE btrim(materia.valor) <> ''
      AND lower(public.unaccent(btrim(materia.valor))) <> 'outra materia'
  );