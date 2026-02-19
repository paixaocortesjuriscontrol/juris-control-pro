
-- Fix search_path mutable warning: calcular_primeiro_dia_util
CREATE OR REPLACE FUNCTION public.calcular_primeiro_dia_util(data_base date, dias_uteis_adicionar integer DEFAULT 0)
 RETURNS date
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  data_resultado DATE;
  contador INTEGER := 0;
  ano_atual INTEGER;
BEGIN
  data_resultado := data_base;
  ano_atual := EXTRACT(YEAR FROM data_resultado);
  
  -- Se data_base for sábado ou domingo, avançar para segunda
  WHILE EXTRACT(DOW FROM data_resultado) IN (0, 6) LOOP
    data_resultado := data_resultado + 1;
  END LOOP;
  
  -- Verificar recesso forense (20 de dezembro a 6 de janeiro)
  IF (EXTRACT(MONTH FROM data_resultado) = 12 AND EXTRACT(DAY FROM data_resultado) >= 20) THEN
    data_resultado := (ano_atual + 1 || '-01-07')::DATE;
    WHILE EXTRACT(DOW FROM data_resultado) IN (0, 6) LOOP
      data_resultado := data_resultado + 1;
    END LOOP;
  ELSIF (EXTRACT(MONTH FROM data_resultado) = 1 AND EXTRACT(DAY FROM data_resultado) <= 6) THEN
    data_resultado := (ano_atual || '-01-07')::DATE;
    WHILE EXTRACT(DOW FROM data_resultado) IN (0, 6) LOOP
      data_resultado := data_resultado + 1;
    END LOOP;
  END IF;
  
  -- Adicionar dias úteis se solicitado
  WHILE contador < dias_uteis_adicionar LOOP
    data_resultado := data_resultado + 1;
    
    WHILE EXTRACT(DOW FROM data_resultado) IN (0, 6) LOOP
      data_resultado := data_resultado + 1;
    END LOOP;
    
    ano_atual := EXTRACT(YEAR FROM data_resultado);
    IF (EXTRACT(MONTH FROM data_resultado) = 12 AND EXTRACT(DAY FROM data_resultado) >= 20) THEN
      data_resultado := (ano_atual + 1 || '-01-07')::DATE;
      WHILE EXTRACT(DOW FROM data_resultado) IN (0, 6) LOOP
        data_resultado := data_resultado + 1;
      END LOOP;
    ELSIF (EXTRACT(MONTH FROM data_resultado) = 1 AND EXTRACT(DAY FROM data_resultado) <= 6) THEN
      data_resultado := (ano_atual || '-01-07')::DATE;
      WHILE EXTRACT(DOW FROM data_resultado) IN (0, 6) LOOP
        data_resultado := data_resultado + 1;
      END LOOP;
    END IF;
    
    contador := contador + 1;
  END LOOP;
  
  RETURN data_resultado;
END;
$function$;

-- Fix search_path mutable warning: proximo_dia_util
CREATE OR REPLACE FUNCTION public.proximo_dia_util(data_base date)
 RETURNS date
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  resultado DATE := data_base;
  mes INT;
  dia INT;
BEGIN
  LOOP
    IF EXTRACT(DOW FROM resultado) IN (0, 6) THEN
      resultado := resultado + 1;
      CONTINUE;
    END IF;
    
    mes := EXTRACT(MONTH FROM resultado);
    dia := EXTRACT(DAY FROM resultado);
    
    IF (mes = 12 AND dia >= 20) OR (mes = 1 AND dia <= 6) THEN
      IF mes = 12 THEN
        resultado := DATE_TRUNC('year', resultado) + INTERVAL '1 year' + INTERVAL '6 days';
      ELSE
        resultado := DATE_TRUNC('year', resultado) + INTERVAL '6 days';
      END IF;
      CONTINUE;
    END IF;
    
    EXIT;
  END LOOP;
  
  RETURN resultado;
END;
$function$;

-- Fix search_path mutable warning: djen_diario_publicacoes_tsv_update
CREATE OR REPLACE FUNCTION public.djen_diario_publicacoes_tsv_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.conteudo_tsv := to_tsvector('portuguese', unaccent(NEW.conteudo));
  RETURN NEW;
END;
$function$;

-- Fix search_path mutable warning: get_publicacoes_contagens_por_monitoramento (sem período)
CREATE OR REPLACE FUNCTION public.get_publicacoes_contagens_por_monitoramento()
 RETURNS TABLE(monitoramento_id uuid, total bigint, nao_lidas bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    p.monitoramento_id,
    COUNT(*)::BIGINT as total,
    COUNT(*) FILTER (WHERE NOT p.lida)::BIGINT as nao_lidas
  FROM public.publicacoes_djen p
  GROUP BY p.monitoramento_id;
$function$;
