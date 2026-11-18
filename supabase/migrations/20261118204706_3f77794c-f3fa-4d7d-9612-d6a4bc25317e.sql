CREATE OR REPLACE FUNCTION public.normalizar_cargo_perfil(p text)
 RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN b = '' THEN NULL
    WHEN b LIKE '%assistente%' AND b LIKE '%coordenad%' THEN 'assistente_coordenador'
    WHEN b LIKE '%coordenad%' THEN 'coordenador'
    WHEN b LIKE '%controlad%' THEN 'controladoria'
    WHEN b LIKE '%advogad%' AND b LIKE '%temp%' THEN 'advogado_temporario'
    WHEN b LIKE '%advogad%' AND b LIKE '%senior%' THEN 'advogado_senior'
    WHEN b LIKE '%advogad%' THEN 'advogado'
    WHEN b LIKE '%estagiari%' THEN 'estagiario'
    WHEN b LIKE '%secretari%' THEN 'secretaria'
    WHEN b LIKE '%assistente%' AND b LIKE '%geral%' THEN 'assistente_juridico_geral'
    WHEN b LIKE '%assistente%' THEN 'assistente'
    WHEN b LIKE '%admin%' THEN 'admin'
    ELSE replace(b,' ','_') END
  FROM (SELECT lower(translate(trim(coalesce(p,'')),'áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ','aaaaeeiooouc'||'aaaaeeiooouc')) b) s
$function$;