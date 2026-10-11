ALTER TABLE public.pautas_tst
  ADD COLUMN IF NOT EXISTS status_avaliacao text NOT NULL DEFAULT 'avaliada',
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'planilha',
  ADD COLUMN IF NOT EXISTS publicacao_djen_id uuid;

CREATE TABLE IF NOT EXISTS public.pautas_tst_responsaveis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pauta_id uuid NOT NULL REFERENCES public.pautas_tst(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pauta_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.pautas_tst_responsaveis TO authenticated;
GRANT ALL ON public.pautas_tst_responsaveis TO service_role;
ALTER TABLE public.pautas_tst_responsaveis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados gerenciam responsaveis de pautas" ON public.pautas_tst_responsaveis
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE OR REPLACE FUNCTION public.gerar_pautas_tst_auto(_dias integer DEFAULT 3)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r record; txt text; d date; dig text; num text; b record; n integer := 0; seg date; hora text; rel text;
  coord uuid := 'b0f690ad-68da-43d7-af5f-9adafeab3fd5';
BEGIN
  FOR r IN
    SELECT p.id, p.processo_numero, p.conteudo, p.orgao, p.data_publicacao
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
    d := NULL;
    BEGIN
      d := to_date(substring(txt from '(?:in[ií]cio no dia|realizar-se no dia|sess[aã]o[^.]{0,80}?dia)\s*(\d{2}/\d{2}/\d{4})'), 'DD/MM/YYYY');
      IF d IS NULL THEN d := to_date(substring(txt from '(\d{2}/\d{2}/\d{4})'), 'DD/MM/YYYY'); END IF;
    EXCEPTION WHEN others THEN d := NULL; END;
    IF d IS NULL THEN d := (r.data_publicacao AT TIME ZONE 'America/Sao_Paulo')::date; END IF;
    IF EXISTS (SELECT 1 FROM pautas_tst t WHERE t.processo_digits = dig AND t.data_julgamento = d) THEN CONTINUE; END IF;
    hora := substring(txt from '(\d{1,2}h\d{0,2}|\d{1,2}:\d{2})');
    rel := trim(substring(txt from 'Relator[a]?\s*:?\s*(?:Ministr[oa]\s+)?([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç .]{3,80})'));
    SELECT id, dossie, equipe, reclamante, reclamada, recorrente, tipo_recurso, relator, turma,
      materias_recurso_reclamante, aparelhamento_reclamante, chance_exito_reclamante,
      materias_recurso_banco, aparelhamento_banco, chance_exito_banco, honra, midia_negativa
      INTO b FROM dados_benner WHERE processo = num AND aba_origem IS NOT NULL LIMIT 1;
    seg := d - ((extract(isodow from d)::int) - 1);
    INSERT INTO pautas_tst (processo_numero, processo_id, data_julgamento, horario, modalidade, orgao, relator,
      dossie, equipe, reclamante, reclamada, parte_recorrente, tipo_recurso,
      materia_recurso_reclamante, aparelhamento_reclamante, chance_exito_reclamante,
      materia_recurso_banco, aparelhamento_banco, chance_exito_banco, honra, midia_negativa,
      dados_benner_id, coordenacao_id, semana_inicio, status_avaliacao, origem, publicacao_djen_id)
    VALUES (num, (SELECT id FROM processos WHERE regexp_replace(numero,'\D','','g') = dig LIMIT 1), d, hora,
      CASE WHEN txt ~* 'sess[aã]o virtual|ambiente eletr' THEN 'Virtual' WHEN txt ~* 'telepresencial' THEN 'Telepresencial' ELSE 'Presencial' END,
      coalesce(r.orgao, b.turma), coalesce(b.relator, rel),
      b.dossie, b.equipe, b.reclamante, b.reclamada, b.recorrente, b.tipo_recurso,
      b.materias_recurso_reclamante, b.aparelhamento_reclamante, b.chance_exito_reclamante,
      b.materias_recurso_banco, b.aparelhamento_banco, b.chance_exito_banco, b.honra, b.midia_negativa,
      b.id, coord, seg, 'a_avaliar', 'djen_auto', r.id);
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.gerar_pautas_tst_auto(integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.gerar_pautas_tst_auto(integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.trg_pautas_apos_djen_servidor()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.tipo = 'djen_paralela_servidor' AND NEW.status IN ('concluido','concluido_parcial')
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    BEGIN PERFORM public.gerar_pautas_tst_auto(2);
    EXCEPTION WHEN others THEN RAISE WARNING 'gerar_pautas_tst_auto: %', SQLERRM; END;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS pautas_apos_djen_servidor ON public.execucoes_servidor;
CREATE TRIGGER pautas_apos_djen_servidor AFTER UPDATE OF status ON public.execucoes_servidor
  FOR EACH ROW EXECUTE FUNCTION public.trg_pautas_apos_djen_servidor();