ALTER TABLE public.teses_juridicas ADD COLUMN IF NOT EXISTS peca_modelo text, ADD COLUMN IF NOT EXISTS origem_arquivo text;

CREATE OR REPLACE FUNCTION public.buscar_teses_aplicaveis(p_processo_id uuid, p_tipo_peca text DEFAULT NULL::text, p_limite integer DEFAULT 5)
 RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path TO 'public'
AS $function$
DECLARE v_p RECORD; v_result jsonb;
BEGIN
  SELECT classe, assunto INTO v_p FROM public.processos WHERE id = p_processo_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Processo não encontrado'; END IF;
  WITH ranked AS (
    SELECT t.*,
      CASE WHEN p_tipo_peca IS NOT NULL AND t.tipo_peca = p_tipo_peca THEN 100
           WHEN t.tipo_peca = 'outros' THEN 30 WHEN p_tipo_peca IS NULL THEN 50 ELSE 10 END AS s_tipo,
      (CASE WHEN coalesce(v_p.assunto,'')<>'' AND t.assunto_cnj ILIKE '%'||v_p.assunto||'%' THEN 40 ELSE 0 END +
       CASE WHEN coalesce(v_p.assunto,'')<>'' AND t.materia ILIKE '%'||v_p.assunto||'%' THEN 30 ELSE 0 END +
       CASE WHEN coalesce(v_p.assunto,'')<>'' AND (t.fundamentos ILIKE '%'||v_p.assunto||'%' OR t.peca_modelo ILIKE '%'||v_p.assunto||'%') THEN 20 ELSE 0 END +
       CASE WHEN coalesce(v_p.assunto,'')<>'' AND EXISTS (SELECT 1 FROM unnest(coalesce(t.tags,'{}')) tg WHERE length(tg)>2 AND v_p.assunto ILIKE '%'||tg||'%') THEN 25 ELSE 0 END +
       CASE WHEN coalesce(v_p.classe,'')<>'' AND t.fundamentos ILIKE '%'||v_p.classe||'%' THEN 10 ELSE 0 END) AS s_cont
    FROM public.teses_juridicas t WHERE t.ativo = true
  ), top AS (SELECT * FROM ranked ORDER BY (s_tipo+s_cont) DESC, updated_at DESC LIMIT p_limite)
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'titulo',titulo,'tipo_peca',tipo_peca,'area',area,'materia',materia,
    'assunto_cnj',assunto_cnj,'fundamentos',fundamentos,'tipo_recurso',tipo_recurso,'tags',tags,'score',s_tipo+s_cont,
    'motivo', CASE WHEN s_tipo>=100 AND s_cont>0 THEN 'Mesmo tipo de peça e assunto parecido'
                   WHEN s_tipo>=100 THEN 'Mesmo tipo de peça'
                   WHEN s_cont>0 THEN 'Assunto/matéria parecidos (tipo de peça diferente)'
                   ELSE 'Tese mais próxima disponível' END)), '[]'::jsonb)
  INTO v_result FROM top;
  RETURN v_result;
END; $function$;