WITH publicacoes_hoje AS (
  SELECT id, hash_conteudo
  FROM public.publicacoes_djen
  WHERE fonte = 'kurier'
    AND created_at::date = CURRENT_DATE
), limpar_tarefas_publicacoes AS (
  DELETE FROM public.tarefas_publicacoes tp
  USING publicacoes_hoje ph
  WHERE tp.publicacao_id = ph.id
), limpar_alertas AS (
  DELETE FROM public.alertas_processos_nao_cadastrados a
  USING publicacoes_hoje ph
  WHERE a.publicacao_id = ph.id
), limpar_audiencias AS (
  DELETE FROM public.audiencias_detectadas a
  USING publicacoes_hoje ph
  WHERE a.publicacao_id = ph.id
), limpar_comentarios AS (
  DELETE FROM public.comentarios_publicacoes_djen c
  USING publicacoes_hoje ph
  WHERE c.publicacao_id = ph.id
), limpar_leituras AS (
  DELETE FROM public.publicacoes_djen_leituras l
  USING publicacoes_hoje ph
  WHERE l.publicacao_id = ph.id
), limpar_hash_id AS (
  DELETE FROM public.publicacoes_djen_global_hash gh
  USING publicacoes_hoje ph
  WHERE gh.publicacao_id = ph.id
), limpar_hash_valor AS (
  DELETE FROM public.publicacoes_djen_global_hash gh
  USING publicacoes_hoje ph
  WHERE gh.hash_global = ph.hash_conteudo
), desvincular_raw AS (
  UPDATE public.kurier_publicacoes_raw r
  SET publicacao_djen_id = NULL,
      motivo_descarte = COALESCE(motivo_descarte, 'publicacao_kurier_hoje_removida')
  FROM publicacoes_hoje ph
  WHERE r.publicacao_djen_id = ph.id
)
DELETE FROM public.publicacoes_djen p
USING publicacoes_hoje ph
WHERE p.id = ph.id;