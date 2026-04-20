-- Backfill: marca como "Arquivado" os processos cujo último payload da API Judit
-- retornou phase = ARQUIVADO/FINALIZADO. Cobre o caso 0020168-27.2023.5.04.0019
-- (TRT4 arquivado) e similares.
WITH latest AS (
  SELECT DISTINCT ON (cj.processo_id)
    cj.processo_id,
    UPPER(COALESCE(cj.payload_resposta->>'phase', cj.payload_resposta->>'status','')) AS phase_norm
  FROM public.consultas_judit cj
  ORDER BY cj.processo_id, cj.requisitada_em DESC
),
alvos AS (
  SELECT db.id
  FROM latest l
  JOIN public.processos p ON p.id = l.processo_id
  JOIN public.dados_benner db ON db.processo = p.numero
  WHERE (l.phase_norm LIKE '%ARQUIVAD%' OR l.phase_norm LIKE '%FINALIZAD%')
    AND COALESCE(db.situacao_processo,'') <> 'Arquivado'
)
UPDATE public.dados_benner
SET situacao_processo = 'Arquivado',
    updated_at = now()
WHERE id IN (SELECT id FROM alvos);