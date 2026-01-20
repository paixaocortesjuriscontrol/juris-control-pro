-- Corrigir runs do DJEN finalizados que ficaram com status incorreto (exibidos como "em andamento")
UPDATE public.djen_runs
SET status = 'cancelado'
WHERE status = 'em_andamento'
  AND finalizado_em IS NOT NULL
  AND (
    motivo_erro ILIKE 'cancelado%' OR
    motivo_erro ILIKE 'cleanup%'
  );

-- Fallback seguro: se houver run com finalizado_em preenchido e status ainda "em_andamento" sem motivo_erro,
-- marcar como "concluido" para evitar ficar preso na UI.
UPDATE public.djen_runs
SET status = 'concluido'
WHERE status = 'em_andamento'
  AND finalizado_em IS NOT NULL
  AND motivo_erro IS NULL;