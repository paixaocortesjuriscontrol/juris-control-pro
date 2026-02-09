
-- Corrigir último registro com data_publicacao incorreta em publicacoes_djen_processos
UPDATE publicacoes_djen_processos 
SET data_publicacao = proximo_dia_util((data_disponibilizacao::date + 1))::timestamptz
WHERE created_at >= (now() AT TIME ZONE 'America/Sao_Paulo')::date AT TIME ZONE 'America/Sao_Paulo'
  AND data_disponibilizacao IS NOT NULL
  AND data_publicacao::date != proximo_dia_util((data_disponibilizacao::date + 1));
