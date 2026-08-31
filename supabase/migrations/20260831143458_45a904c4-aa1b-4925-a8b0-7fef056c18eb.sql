CREATE OR REPLACE FUNCTION public.get_ranking_atendimento_tst(p_inicio date, p_fim date, p_coordenacao_id uuid DEFAULT NULL::uuid, p_usuario_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(usuario_id uuid, nome text, total bigint, sem_pendencia bigint, com_pendencia bigint, pendencias_total bigint, judit_preenchidos bigint, prontos bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
WITH coordenacao_filtro AS (
  SELECT CASE
    WHEN c.nome = 'Coordenação Dra. Renata com termos do João'
      THEN '3e47fc83-3539-4fa7-9fcf-33825120e1b7'::uuid
    ELSE p_coordenacao_id
  END AS id
  FROM (SELECT 1) s
  LEFT JOIN public.coordenacoes c ON c.id = p_coordenacao_id
),
base AS (
  SELECT db.*, public.tst_pendencias_count(db.*) AS pend
  FROM public.dados_benner db
  CROSS JOIN coordenacao_filtro cf
  WHERE db.aba_origem IS NOT NULL
    AND (
      coalesce(db.data_distribuicao_real, db.created_at::date) BETWEEN p_inicio AND p_fim
      OR (db.pronto_em IS NOT NULL AND db.pronto_em::date BETWEEN p_inicio AND p_fim)
    )
    AND (cf.id IS NULL OR db.coordenacao_id = cf.id)
),
porresp AS (
  SELECT r.usuario_id AS uid, b.pend, b.judit_preenchido,
         (b.status::text IN ('pronto_envio','planilhado','enviado')
          AND b.pronto_em IS NOT NULL
          AND b.pronto_em::date BETWEEN p_inicio AND p_fim) AS pronto_periodo
  FROM base b
  JOIN public.dados_benner_responsaveis r ON r.dados_benner_id = b.id
)
SELECT
  pr.uid,
  coalesce(p.nome, 'Sem nome') AS nome,
  count(*) AS total,
  count(*) FILTER (WHERE pr.pend = 0) AS sem_pendencia,
  count(*) FILTER (WHERE pr.pend > 0) AS com_pendencia,
  coalesce(sum(pr.pend), 0)::bigint AS pendencias_total,
  count(*) FILTER (WHERE pr.judit_preenchido) AS judit_preenchidos,
  count(*) FILTER (WHERE pr.pronto_periodo) AS prontos
FROM porresp pr
LEFT JOIN public.profiles p ON p.id = pr.uid
WHERE p_usuario_id IS NULL OR pr.uid = p_usuario_id
GROUP BY pr.uid, p.nome
ORDER BY count(*) FILTER (WHERE pr.pronto_periodo) DESC, count(*) FILTER (WHERE pr.pend = 0) DESC, count(*) DESC;
$function$;

DO $mig$
DECLARE
  v_src text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO v_src
  FROM pg_proc WHERE proname = 'get_distribuicao_tst_multi_resp_ids';

  v_src := replace(
    v_src,
    '(db.status IS NULL OR db.status::text <> ''pronto_envio'')',
    '(db.status IS NULL OR db.status::text NOT IN (''pronto_envio'',''planilhado'',''enviado''))'
  );

  EXECUTE v_src;
END $mig$;