-- Read-only regression: the agenda asks the database for each item type.
-- Pessoal takes one person, Escritório takes coordinations, and the browser
-- never sends lists of item identifiers (which used to overflow the URL limit).
WITH definitions AS (
  SELECT p.oid, p.proname, pg_get_functiondef(p.oid) AS definition,
         pg_get_function_arguments(p.oid) AS arguments,
         p.prosecdef, p.provolatile,
         has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_run,
         has_function_privilege('authenticated', p.oid, 'EXECUTE') AS signed_in_can_run
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('get_agenda_pessoal', 'get_agenda_escritorio')
), empty_office AS (
  SELECT public.get_agenda_escritorio(ARRAY[]::uuid[], DATE '2026-10-01', DATE '2026-10-31',
         TIMESTAMPTZ '2026-10-01 00:00:00-03', TIMESTAMPTZ '2026-10-31 23:59:59-03',
         NULL, NULL, NULL, NULL, NULL, 0, 1000) AS result
), nobody AS (
  SELECT public.get_agenda_pessoal('00000000-0000-4000-8000-000000000000'::uuid,
         DATE '2026-10-01', DATE '2026-10-31',
         TIMESTAMPTZ '2026-10-01 00:00:00-03', TIMESTAMPTZ '2026-10-31 23:59:59-03',
         NULL, NULL, NULL, NULL, NULL, 0, 1000) AS result
)
SELECT 1 / CASE WHEN
  (SELECT count(*) FROM definitions) = 2
  -- Both searches run with the caller's own rights and the same access rules.
  AND NOT EXISTS (SELECT 1 FROM definitions WHERE prosecdef OR provolatile <> 's')
  AND NOT EXISTS (SELECT 1 FROM definitions WHERE definition NOT LIKE '%set search_path = public%')
  -- Only signed-in people may run them.
  AND NOT EXISTS (SELECT 1 FROM definitions WHERE anon_can_run)
  AND NOT EXISTS (SELECT 1 FROM definitions WHERE NOT signed_in_can_run)
  -- The person search takes one person and no list of item identifiers.
  AND NOT EXISTS (SELECT 1 FROM definitions
                  WHERE proname = 'get_agenda_pessoal' AND arguments LIKE '%uuid[]%')
  AND EXISTS (SELECT 1 FROM definitions WHERE proname = 'get_agenda_pessoal'
    AND definition LIKE '%tarefa_responsaveis%' AND definition LIKE '%tarefa_envolvidos%'
    AND definition LIKE '%participantes_evento%' AND definition LIKE '%audiencias_advogados%'
    AND definition LIKE '%audiencia_envolvidos%')
  -- The office search is by coordination.
  AND EXISTS (SELECT 1 FROM definitions WHERE proname = 'get_agenda_escritorio'
    AND arguments LIKE '%p_coordenacoes uuid[]%' AND definition LIKE '%coordenacao_id%')
  -- An office search without coordinations returns nothing, and a person who does
  -- not exist returns nothing either.
  AND (SELECT result FROM empty_office) = '{}'::jsonb
  AND (SELECT coalesce(jsonb_array_length(result -> 'tarefas' -> 'linhas'), 0) FROM nobody) = 0
  AND (SELECT coalesce(jsonb_array_length(result -> 'eventos' -> 'linhas'), 0) FROM nobody) = 0
  AND (SELECT coalesce(jsonb_array_length(result -> 'audiencias' -> 'linhas'), 0) FROM nobody) = 0
  AND (SELECT coalesce(jsonb_array_length(result -> 'prazos_tst' -> 'linhas'), 0) FROM nobody) = 0
  AND (SELECT coalesce(jsonb_array_length(result -> 'parcelas' -> 'linhas'), 0) FROM nobody) = 0
THEN 1 ELSE 0 END AS regression_passed;
