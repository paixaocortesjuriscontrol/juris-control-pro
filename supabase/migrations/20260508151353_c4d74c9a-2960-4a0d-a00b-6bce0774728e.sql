
-- Backfill: marca processos com responsável como "delegados" pelo coordenador
-- Processos com benner_atualizado=true viram "entregue"; demais ficam "pendente"
UPDATE public.dados_benner d
SET 
  distribuido_em = COALESCE(d.distribuido_em, now()),
  distribuido_por = COALESCE(d.distribuido_por, c.coordenador_id),
  prazo_entrega = NULL,
  status_distribuicao = CASE 
    WHEN d.benner_atualizado IS TRUE THEN 'entregue'
    ELSE 'pendente'
  END,
  entregue_em = CASE
    WHEN d.benner_atualizado IS TRUE THEN COALESCE(d.entregue_em, now())
    ELSE d.entregue_em
  END,
  entregue_por = CASE
    WHEN d.benner_atualizado IS TRUE THEN COALESCE(d.entregue_por, c.coordenador_id)
    ELSE d.entregue_por
  END
FROM public.coordenacoes c
WHERE d.coordenacao_id = c.id
  AND d.distribuido_em IS NULL
  AND EXISTS (
    SELECT 1 FROM public.dados_benner_responsaveis r
    WHERE r.dados_benner_id = d.id
  );
