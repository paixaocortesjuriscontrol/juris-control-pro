CREATE INDEX IF NOT EXISTS idx_publicacoes_djen_id_kurier ON public.publicacoes_djen (id_kurier) WHERE fonte = 'kurier' AND id_kurier IS NOT NULL;

CREATE OR REPLACE FUNCTION public.compute_djen_conteudo_dedup_key(p_coordenacao uuid, p_processo_numero text, p_data_disp timestamp with time zone, p_data_pub timestamp with time zone, p_created_at timestamp with time zone, p_conteudo text)
 RETURNS text
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  v_digits text;
  v_data date;
  v_norm text;
  v_comunicacao text;
BEGIN
  v_digits := regexp_replace(COALESCE(p_processo_numero, ''), '[^0-9]', '', 'g');
  IF v_digits = '' THEN
    RETURN NULL;
  END IF;
  v_data := COALESCE(p_data_disp::date, p_data_pub::date, p_created_at::date);
  IF v_data IS NULL THEN
    RETURN NULL;
  END IF;

  IF COALESCE(p_conteudo, '') ~* 'Parte[[:space:]]+intima[çc][ãa]o|Advogados?[[:space:]]+polo' THEN
    v_norm := left(public.kurier_normalize_conteudo_sem_parte_intimacao(p_conteudo), 400);
  ELSE
    v_norm := left(public.djen_normalize_conteudo_sem_destinatarios(p_conteudo), 400);
  END IF;

  IF v_norm = '' THEN
    RETURN NULL;
  END IF;

  -- Comunicações distintas do mesmo ato (destinatários diferentes) têm IDs
  -- próprios; o mesmo ID capturado por logins diferentes continua deduplicado.
  v_comunicacao := substring(COALESCE(p_conteudo, '') from 'ID[[:space:]]*COMUNICA(?:ÇÃO|CAO)[[:space:]]*([0-9]{5,})');

  RETURN COALESCE(p_coordenacao::text, 'sem_coord') || '|' || v_digits || '|' || v_data::text || '|' || md5(v_norm)
    || CASE WHEN v_comunicacao IS NOT NULL THEN '|c' || v_comunicacao ELSE '' END;
END;
$function$;

CREATE OR REPLACE FUNCTION public.restaurar_conteudo_kurier_truncado(p_de timestamptz, p_ate timestamptz)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
  v_pref text;
  v_rest int := 0;
  v_conf int := 0;
BEGIN
  FOR r IN
    WITH raw AS (
      SELECT id_kurier, min(texto) AS texto
      FROM (
        SELECT id_kurier,
          btrim(regexp_replace(substring(payload->>'Texto' from '\mTEXTO([[:upper:]À-Ÿ].*)'), '[[:space:]]+', ' ', 'g')) AS texto
        FROM public.kurier_publicacoes_raw
        WHERE recebida_em >= p_de AND recebida_em < p_ate AND id_kurier IS NOT NULL
      ) s
      WHERE texto IS NOT NULL AND texto <> ''
      GROUP BY id_kurier
      HAVING count(DISTINCT texto) = 1
    )
    SELECT p.id, raw.texto, btrim(regexp_replace(p.conteudo, '[[:space:]]+', ' ', 'g')) AS atual
    FROM raw
    JOIN public.publicacoes_djen p ON p.id_kurier = raw.id_kurier AND p.fonte = 'kurier'
    WHERE COALESCE(p.conteudo, '') <> ''
  LOOP
    IF length(r.atual) = 0 OR length(r.texto) <= length(r.atual) OR right(r.texto, length(r.atual)) <> r.atual THEN
      CONTINUE;
    END IF;
    v_pref := left(r.texto, length(r.texto) - length(r.atual));
    -- Mesmo critério da captura: só metadados compactos em caixa alta podem ser separados.
    IF NOT (v_pref ~ '[a-zà-ÿ]' OR v_pref ~* 'PODER[[:space:]]+JUDICI[ÁA]RIO|ATO[[:space:]]+DE[[:space:]]+ORDEM') THEN
      CONTINUE;
    END IF;
    BEGIN
      UPDATE public.publicacoes_djen
         SET conteudo = r.texto, resumo_ia = NULL, resumo_gerado_em = NULL
       WHERE id = r.id;
      v_rest := v_rest + 1;
    EXCEPTION WHEN unique_violation THEN
      v_conf := v_conf + 1;
    END;
  END LOOP;
  RETURN jsonb_build_object('restauradas', v_rest, 'conflitos', v_conf);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.restaurar_conteudo_kurier_truncado(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;