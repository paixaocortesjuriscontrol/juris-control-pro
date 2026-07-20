CREATE OR REPLACE FUNCTION public._tmp_rel_recurso_fora()
RETURNS TABLE(processo text, dossie text, campo text, valor text)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH allowed AS (SELECT unnest(ARRAY['Ação Rescisória','Agravo de Instrumento','Agravo em Recurso Extraordinário','Agravo Interno','Embargos de Declaração','Embargos de Divergência','Embargos SDI','Incidente de arguição de inconstitucionalidade','Incidente de assunção de competência','Incidente de recurso repetitivo','Incidente de resolução de demanda repetitiva','Incidente de superação e revisão de precedentes','Mandado de Segurança','Medida Cautelar','Reclamação','Recurso de Revista','Recurso Especial','Recurso Extraordinário','Recurso Ordinário']) AS opt),
  s AS (
    SELECT processo, dossie, 'reclamante'::text AS campo, trim(unnest(string_to_array(tipo_recurso_reclamante,'+'))) AS valor FROM dados_benner WHERE coalesce(tipo_recurso_reclamante,'')<>''
    UNION ALL SELECT processo, dossie, 'banco', trim(unnest(string_to_array(tipo_recurso_banco,'+'))) FROM dados_benner WHERE coalesce(tipo_recurso_banco,'')<>''
    UNION ALL SELECT processo, dossie, 'terceiro', trim(unnest(string_to_array(tipo_recurso_terceiro,'+'))) FROM dados_benner WHERE coalesce(tipo_recurso_terceiro,'')<>''
  )
  SELECT processo, dossie, campo, valor FROM s WHERE valor<>'' AND valor NOT IN (SELECT opt FROM allowed) ORDER BY campo, valor, processo;
$$;
GRANT EXECUTE ON FUNCTION public._tmp_rel_recurso_fora() TO anon, authenticated;