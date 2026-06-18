
ALTER TABLE public.publicacoes_djen DISABLE TRIGGER trg_rejeitar_kurier_sem_vinculo_coordenacao;

INSERT INTO public.publicacoes_djen
  (id, monitoramento_id, hash_conteudo, data_publicacao, data_disponibilizacao,
   processo_numero, conteudo, fonte, tribunal, polo_ativo, polo_passivo,
   orgao, tipo_comunicacao, meio, advogados_json, partes_json,
   dedup_processo_digits, dedup_data_ref, dedup_head_norm, dedup_key,
   dedup_conteudo_key, coordenacao_id, tipo_publicacao, id_djen, kurier_login,
   status, lida, created_at)
SELECT gen_random_uuid(), monitoramento_id, hash_conteudo, data_publicacao, data_disponibilizacao,
   processo_numero, conteudo, 'kurier', tribunal, polo_ativo, polo_passivo,
   orgao, tipo_comunicacao, meio, advogados_json, partes_json,
   dedup_processo_digits, dedup_data_ref, dedup_head_norm, dedup_key,
   dedup_conteudo_key, coordenacao_id, tipo_publicacao, NULL, kurier_login,
   'encontrada', false, created_at
FROM public.publicacoes_djen_servidor
WHERE created_at::date = CURRENT_DATE
ON CONFLICT DO NOTHING;

ALTER TABLE public.publicacoes_djen ENABLE TRIGGER trg_rejeitar_kurier_sem_vinculo_coordenacao;

DELETE FROM public.publicacoes_djen_servidor
WHERE created_at::date = CURRENT_DATE;
