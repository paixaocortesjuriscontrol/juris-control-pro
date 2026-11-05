CREATE OR REPLACE FUNCTION public.pauta_partes_polo(_pj jsonb, _polo text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT nullif(string_agg(DISTINCT e->>'nome', ', '), '')
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(_pj)='array' THEN _pj ELSE '[]'::jsonb END) e
  WHERE e->>'polo' = _polo AND coalesce(e->>'nome','') <> ''
$$;

CREATE OR REPLACE FUNCTION public.pauta_advogado_interno(_benner uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT nullif(string_agg(DISTINCT pr.nome, ', '), '')
  FROM dados_benner_responsaveis r JOIN profiles pr ON pr.id = r.usuario_id
  WHERE r.dados_benner_id = _benner
$$;

CREATE OR REPLACE FUNCTION public.gerar_pautas_tst_auto(_dias integer DEFAULT 3)
 RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  r record; txt text; d date; dig text; num text; b record; n integer := 0; seg date; hora text; rel text;
  pub date; modal text;
  coord uuid := 'b0f690ad-68da-43d7-af5f-9adafeab3fd5';
BEGIN
  FOR r IN
    SELECT p.id, p.processo_numero, p.conteudo, p.orgao, p.data_publicacao, p.partes_json
    FROM publicacoes_djen p
    WHERE p.coordenacao_id = coord
      AND p.created_at > now() - make_interval(days => _dias)
      AND p.conteudo ILIKE '%pauta de julgamento%'
  LOOP
    txt := regexp_replace(r.conteudo, '<[^>]+>', ' ', 'g');
    IF txt ~* '\mcejusc\M' OR txt ~* '\mACORDAM\M' OR txt ~* '\mEMENTA\M' OR txt ~* 'A\s*C\s*[OÓ]\s*R\s*D\s*[AÃ]\s*O' THEN CONTINUE; END IF;
    dig := regexp_replace(coalesce(r.processo_numero,''), '\D', '', 'g');
    IF length(dig) <> 20 THEN CONTINUE; END IF;
    num := substr(dig,1,7)||'-'||substr(dig,8,2)||'.'||substr(dig,10,4)||'.'||substr(dig,14,1)||'.'||substr(dig,15,2)||'.'||substr(dig,17);
    pub := (r.data_publicacao AT TIME ZONE 'America/Sao_Paulo')::date;
    d := NULL;
    BEGIN
      d := to_date(substring(txt from '(?:in[ií]cio no dia|realizar-se no dia|sess[aã]o[^.]{0,80}?dia)\s*(\d{2}/\d{2}/\d{4})'), 'DD/MM/YYYY');
      IF d IS NULL THEN d := to_date(substring(txt from '(\d{2}/\d{2}/\d{4})'), 'DD/MM/YYYY'); END IF;
    EXCEPTION WHEN others THEN d := NULL; END;
    IF d IS NULL OR d < pub THEN d := pub; END IF;
    IF EXISTS (SELECT 1 FROM pautas_tst t WHERE t.processo_digits = dig AND t.data_julgamento = d) THEN CONTINUE; END IF;
    modal := CASE WHEN txt ~* 'sess[aã]o virtual|ambiente eletr' THEN 'Virtual' WHEN txt ~* 'telepresencial' THEN 'Telepresencial' ELSE 'Presencial' END;
    hora := CASE WHEN modal = 'Virtual' THEN NULL ELSE substring(txt from '(\d{1,2}h\d{0,2}|\d{1,2}:\d{2})') END;
    rel := trim(substring(txt from 'Relator[a]?\s*:?\s*(?:Ministr[oa]\s+)?([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç .]{3,80})'));
    SELECT id, dossie, equipe, reclamante, reclamada, recorrente, tipo_recurso, relator, turma,
      materias_recurso_reclamante, aparelhamento_reclamante, chance_exito_reclamante,
      materias_recurso_banco, aparelhamento_banco, chance_exito_banco, honra, midia_negativa
      INTO b FROM dados_benner WHERE processo = num
      ORDER BY (aba_origem IS NOT NULL) DESC, (dossie IS NOT NULL) DESC LIMIT 1;
    seg := d - ((extract(isodow from d)::int) - 1);
    INSERT INTO pautas_tst (processo_numero, processo_id, data_julgamento, horario, modalidade, orgao, relator,
      dossie, equipe, advogado_interno, reclamante, reclamada, parte_recorrente, tipo_recurso,
      materia_recurso_reclamante, aparelhamento_reclamante, chance_exito_reclamante,
      materia_recurso_banco, aparelhamento_banco, chance_exito_banco, honra, midia_negativa,
      dados_benner_id, coordenacao_id, semana_inicio, status_avaliacao, origem, publicacao_djen_id)
    VALUES (num, (SELECT id FROM processos WHERE regexp_replace(numero,'\D','','g') = dig LIMIT 1), d, hora,
      modal, coalesce(r.orgao, b.turma), coalesce(b.relator, rel),
      b.dossie, b.equipe, CASE WHEN b.id IS NOT NULL THEN pauta_advogado_interno(b.id) END,
      coalesce(nullif(b.reclamante,''), pauta_partes_polo(r.partes_json::jsonb,'A')),
      coalesce(nullif(b.reclamada,''), pauta_partes_polo(r.partes_json::jsonb,'P')),
      b.recorrente, b.tipo_recurso,
      b.materias_recurso_reclamante, b.aparelhamento_reclamante, b.chance_exito_reclamante,
      b.materias_recurso_banco, b.aparelhamento_banco, b.chance_exito_banco, b.honra, b.midia_negativa,
      b.id, coord, seg, 'a_avaliar', 'djen_auto', r.id);
    n := n + 1;
  END LOOP;
  RETURN n;
END
$function$;

-- Ligar ao Benner as pautas automáticas sem ligação
UPDATE pautas_tst t SET dados_benner_id = (
  SELECT b.id FROM dados_benner b WHERE b.processo = t.processo_numero
  ORDER BY (b.aba_origem IS NOT NULL) DESC, (b.dossie IS NOT NULL) DESC LIMIT 1)
WHERE t.origem='djen_auto' AND t.dados_benner_id IS NULL;

-- Completar apenas campos vazios
UPDATE pautas_tst t SET
  dossie = coalesce(nullif(t.dossie,''), b.dossie),
  equipe = coalesce(nullif(t.equipe,''), b.equipe),
  advogado_interno = coalesce(nullif(t.advogado_interno,''), pauta_advogado_interno(b.id)),
  reclamante = coalesce(nullif(t.reclamante,''), nullif(b.reclamante,''), pauta_partes_polo(p.partes_json::jsonb,'A')),
  reclamada = coalesce(nullif(t.reclamada,''), nullif(b.reclamada,''), pauta_partes_polo(p.partes_json::jsonb,'P')),
  relator = coalesce(nullif(t.relator,''), b.relator),
  horario = CASE WHEN t.modalidade = 'Virtual' THEN NULL ELSE t.horario END
FROM pautas_tst t2
LEFT JOIN dados_benner b ON b.id = t2.dados_benner_id
LEFT JOIN publicacoes_djen p ON p.id = t2.publicacao_djen_id
WHERE t2.id = t.id AND t.origem = 'djen_auto';