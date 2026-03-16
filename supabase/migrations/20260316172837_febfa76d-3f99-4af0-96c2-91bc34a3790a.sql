
-- Fix publicacoes_djen_processos: data_publicacao must be next business day after data_disponibilizacao
-- Step 1: Add 1 day, then skip to Monday if it falls on weekend
UPDATE publicacoes_djen_processos
SET data_publicacao = CASE
  -- If disp+1 is Saturday (6), move to Monday (+2 more days = +3 total)
  WHEN EXTRACT(DOW FROM (data_disponibilizacao + interval '1 day')) = 6
    THEN data_disponibilizacao + interval '3 days'
  -- If disp+1 is Sunday (0), move to Monday (+1 more day = +2 total)  
  WHEN EXTRACT(DOW FROM (data_disponibilizacao + interval '1 day')) = 0
    THEN data_disponibilizacao + interval '2 days'
  -- Otherwise just +1 day
  ELSE data_disponibilizacao + interval '1 day'
END
WHERE data_disponibilizacao IS NOT NULL
AND data_disponibilizacao::date = data_publicacao::date;
