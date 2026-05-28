WITH publicacoes_invalidas AS (
  SELECT id, hash_conteudo
  FROM public.publicacoes_djen
  WHERE fonte = 'kurier'
    AND created_at >= ((now() AT TIME ZONE 'America/Sao_Paulo')::date AT TIME ZONE 'America/Sao_Paulo')
    AND COALESCE(data_disponibilizacao::date, DATE '1900-01-01') <> DATE '2026-05-27'
), limpar_tarefas_publicacoes AS (
  DELETE FROM public.tarefas_publicacoes tp
  USING publicacoes_invalidas pi
  WHERE tp.publicacao_id = pi.id
), limpar_alertas AS (
  DELETE FROM public.alertas_processos_nao_cadastrados a
  USING publicacoes_invalidas pi
  WHERE a.publicacao_id = pi.id
), limpar_audiencias AS (
  DELETE FROM public.audiencias_detectadas a
  USING publicacoes_invalidas pi
  WHERE a.publicacao_id = pi.id
), limpar_comentarios AS (
  DELETE FROM public.comentarios_publicacoes_djen c
  USING publicacoes_invalidas pi
  WHERE c.publicacao_id = pi.id
), limpar_leituras AS (
  DELETE FROM public.publicacoes_djen_leituras l
  USING publicacoes_invalidas pi
  WHERE l.publicacao_id = pi.id
), limpar_hash_id AS (
  DELETE FROM public.publicacoes_djen_global_hash gh
  USING publicacoes_invalidas pi
  WHERE gh.publicacao_id = pi.id
), limpar_hash_valor AS (
  DELETE FROM public.publicacoes_djen_global_hash gh
  USING publicacoes_invalidas pi
  WHERE gh.hash_global = pi.hash_conteudo
), desvincular_raw AS (
  UPDATE public.kurier_publicacoes_raw r
  SET publicacao_djen_id = NULL,
      motivo_descarte = COALESCE(motivo_descarte, 'publicacao_kurier_removida_data_disp_fora_2026_05_27')
  FROM publicacoes_invalidas pi
  WHERE r.publicacao_djen_id = pi.id
)
DELETE FROM public.publicacoes_djen p
USING publicacoes_invalidas pi
WHERE p.id = pi.id;