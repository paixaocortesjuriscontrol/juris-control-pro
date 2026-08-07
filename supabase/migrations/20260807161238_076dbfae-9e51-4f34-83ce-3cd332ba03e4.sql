CREATE OR REPLACE FUNCTION public.get_publicacoes_relacionadas_por_dedup(p_ids_termos uuid[] DEFAULT NULL::uuid[], p_ids_processos uuid[] DEFAULT NULL::uuid[], p_ids_descartadas uuid[] DEFAULT NULL::uuid[])
 RETURNS TABLE(publicacao_id uuid, tabela_origem text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH seed_keys AS (
    SELECT DISTINCT
      COALESCE(
        public.compute_djen_conteudo_dedup_key(
          COALESCE(md.coordenacao_id, pd.coordenacao_id), pd.processo_numero,
          pd.data_disponibilizacao, pd.data_publicacao, pd.created_at, pd.conteudo
        ),
        NULLIF(btrim(pd.id_djen), ''),
        concat_ws('|', 'legacy', pd.dedup_processo_digits, pd.dedup_data_ref::text, pd.dedup_head_norm)
      ) AS dedup_uid,
      COALESCE(pd.coordenacao_id, md.coordenacao_id) AS coordenacao_id
    FROM public.publicacoes_djen pd
    JOIN public.monitoramentos_djen md ON md.id = pd.monitoramento_id
    WHERE COALESCE(array_length(p_ids_termos, 1), 0) > 0
      AND pd.id = ANY(p_ids_termos)

    UNION

    SELECT DISTINCT
      COALESCE(
        public.compute_djen_conteudo_dedup_key(
          pdp.coordenacao_id, pdp.processo_numero,
          pdp.data_disponibilizacao, pdp.data_publicacao, pdp.created_at, pdp.conteudo
        ),
        NULLIF(btrim(pdp.id_djen), ''),
        concat_ws('|', 'legacy', pdp.dedup_processo_digits, pdp.dedup_data_ref::text, pdp.dedup_head_norm)
      ) AS dedup_uid,
      COALESCE(pdp.coordenacao_id, p.coordenacao_id) AS coordenacao_id
    FROM public.publicacoes_djen_processos pdp
    JOIN public.processos p ON p.id = pdp.processo_id
    WHERE COALESCE(array_length(p_ids_processos, 1), 0) > 0
      AND pdp.id = ANY(p_ids_processos)

    UNION

    SELECT DISTINCT
      COALESCE(
        NULLIF(btrim(pdd.id_djen), ''),
        concat_ws('|', 'legacy', pdd.dedup_processo_digits, pdd.dedup_data_ref::text, pdd.dedup_head_norm)
      ) AS dedup_uid,
      COALESCE(pdd.coordenacao_id, md.coordenacao_id) AS coordenacao_id
    FROM public.publicacoes_djen_descartadas pdd
    JOIN public.monitoramentos_djen md ON md.id = pdd.monitoramento_id
    WHERE COALESCE(array_length(p_ids_descartadas, 1), 0) > 0
      AND pdd.id = ANY(p_ids_descartadas)
  )
  SELECT DISTINCT t.id AS publicacao_id, 'termo'::text AS tabela_origem
  FROM public.publicacoes_djen t
  JOIN public.monitoramentos_djen md ON md.id = t.monitoramento_id
  JOIN seed_keys sk
    ON sk.coordenacao_id = COALESCE(t.coordenacao_id, md.coordenacao_id)
   AND sk.dedup_uid IN (
        COALESCE(
          public.compute_djen_conteudo_dedup_key(
            COALESCE(md.coordenacao_id, t.coordenacao_id), t.processo_numero,
            t.data_disponibilizacao, t.data_publicacao, t.created_at, t.conteudo
          ),
          NULLIF(btrim(t.id_djen), ''),
          concat_ws('|', 'legacy', t.dedup_processo_digits, t.dedup_data_ref::text, t.dedup_head_norm)
        ),
        COALESCE(
          NULLIF(btrim(t.id_djen), ''),
          concat_ws('|', 'legacy', t.dedup_processo_digits, t.dedup_data_ref::text, t.dedup_head_norm)
        )
      )

  UNION

  SELECT DISTINCT t.id AS publicacao_id, 'processo'::text AS tabela_origem
  FROM public.publicacoes_djen_processos t
  JOIN public.processos p ON p.id = t.processo_id
  JOIN seed_keys sk
    ON sk.coordenacao_id = COALESCE(t.coordenacao_id, p.coordenacao_id)
   AND sk.dedup_uid IN (
        COALESCE(
          public.compute_djen_conteudo_dedup_key(
            t.coordenacao_id, t.processo_numero,
            t.data_disponibilizacao, t.data_publicacao, t.created_at, t.conteudo
          ),
          NULLIF(btrim(t.id_djen), ''),
          concat_ws('|', 'legacy', t.dedup_processo_digits, t.dedup_data_ref::text, t.dedup_head_norm)
        ),
        COALESCE(
          NULLIF(btrim(t.id_djen), ''),
          concat_ws('|', 'legacy', t.dedup_processo_digits, t.dedup_data_ref::text, t.dedup_head_norm)
        )
      )

  UNION

  SELECT DISTINCT t.id AS publicacao_id, 'descartada'::text AS tabela_origem
  FROM public.publicacoes_djen_descartadas t
  JOIN public.monitoramentos_djen md ON md.id = t.monitoramento_id
  JOIN seed_keys sk
    ON sk.coordenacao_id = COALESCE(t.coordenacao_id, md.coordenacao_id)
   AND sk.dedup_uid = COALESCE(
        NULLIF(btrim(t.id_djen), ''),
        concat_ws('|', 'legacy', t.dedup_processo_digits, t.dedup_data_ref::text, t.dedup_head_norm)
      );
$function$;