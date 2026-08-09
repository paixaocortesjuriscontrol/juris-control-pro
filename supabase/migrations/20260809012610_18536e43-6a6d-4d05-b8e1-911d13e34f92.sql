DO $$
DECLARE
  r record;
  d text;
BEGIN
  FOR r IN
    SELECT oid FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace AND proname = 'get_processos_paginados'
  LOOP
    d := pg_get_functiondef(r.oid);
    IF position('pcr.coordenacao_id = _coordenacao_id' in d) = 0 THEN
      d := replace(
        d,
        'p.coordenacao_id = _coordenacao_id',
        '(p.coordenacao_id = _coordenacao_id OR EXISTS (SELECT 1 FROM processos_coordenacoes_responsaveis pcr WHERE pcr.processo_id = p.id AND pcr.coordenacao_id = _coordenacao_id))'
      );
      EXECUTE d;
    END IF;
  END LOOP;
END $$;