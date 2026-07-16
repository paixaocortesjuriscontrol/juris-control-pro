CREATE OR REPLACE FUNCTION public.compute_dedup_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_base_norm text;
BEGIN
  NEW.dedup_processo_digits := regexp_replace(COALESCE(NEW.processo_numero, ''), '[^0-9]', '', 'g');
  NEW.dedup_data_ref := COALESCE(NEW.data_disponibilizacao::date, NEW.data_publicacao::date, NEW.created_at::date);

  IF COALESCE(NEW.fonte, '') = 'kurier'
     AND COALESCE(NEW.conteudo, '') ~* 'Parte[[:space:]]+intima[çc][ãa]o|Advogados?[[:space:]]+polo' THEN
    v_base_norm := public.kurier_normalize_conteudo_sem_parte_intimacao(NEW.conteudo);
  ELSE
    v_base_norm := COALESCE(public.strip_destinatarios(NEW.conteudo), '');
  END IF;

  NEW.dedup_head_norm := left(lower(regexp_replace(regexp_replace(regexp_replace(
    COALESCE(v_base_norm, ''), '<[^>]*>', ' ', 'g'), '[^\w\s]', ' ', 'g'), '\s+', ' ', 'g')), 300);

  IF TG_TABLE_NAME = 'publicacoes_djen' THEN
    NEW.dedup_key := public.compute_djen_dedup_key(
      NEW.coordenacao_id,
      NEW.processo_numero,
      NEW.data_disponibilizacao,
      NEW.data_publicacao,
      NEW.created_at
    );
    NEW.dedup_conteudo_key := public.compute_djen_conteudo_dedup_key(
      NEW.coordenacao_id,
      NEW.processo_numero,
      NEW.data_disponibilizacao,
      NEW.data_publicacao,
      NEW.created_at,
      NEW.conteudo
    );
  END IF;

  RETURN NEW;
END;
$function$;