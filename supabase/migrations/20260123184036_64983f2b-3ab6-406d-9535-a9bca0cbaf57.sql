-- Função para calcular próximo dia útil (considerando fins de semana e recesso forense)
CREATE OR REPLACE FUNCTION public.proximo_dia_util(data_base DATE)
RETURNS DATE
LANGUAGE plpgsql
AS $$
DECLARE
  resultado DATE := data_base;
  mes INT;
  dia INT;
BEGIN
  -- Loop até encontrar dia útil
  LOOP
    -- Verificar se é fim de semana (0=domingo, 6=sábado)
    IF EXTRACT(DOW FROM resultado) IN (0, 6) THEN
      resultado := resultado + 1;
      CONTINUE;
    END IF;
    
    -- Verificar recesso forense (20/dez a 6/jan)
    mes := EXTRACT(MONTH FROM resultado);
    dia := EXTRACT(DAY FROM resultado);
    
    IF (mes = 12 AND dia >= 20) OR (mes = 1 AND dia <= 6) THEN
      -- Avançar para 7 de janeiro
      IF mes = 12 THEN
        resultado := DATE_TRUNC('year', resultado) + INTERVAL '1 year' + INTERVAL '6 days';
      ELSE
        resultado := DATE_TRUNC('year', resultado) + INTERVAL '6 days';
      END IF;
      -- Verificar se 7/jan é dia útil
      CONTINUE;
    END IF;
    
    -- É dia útil, sair do loop
    EXIT;
  END LOOP;
  
  RETURN resultado;
END;
$$;

-- Atualizar publicacoes_djen: data_publicacao = próximo dia útil após data_disponibilizacao
UPDATE publicacoes_djen
SET data_publicacao = proximo_dia_util(data_disponibilizacao::DATE + 1)
WHERE data_disponibilizacao IS NOT NULL;

-- Atualizar publicacoes_djen_processos: data_publicacao = próximo dia útil após data_disponibilizacao
UPDATE publicacoes_djen_processos
SET data_publicacao = proximo_dia_util(data_disponibilizacao::DATE + 1)
WHERE data_disponibilizacao IS NOT NULL;

-- Atualizar publicacoes_djen_descartadas: data_publicacao = próximo dia útil após data_disponibilizacao
UPDATE publicacoes_djen_descartadas
SET data_publicacao = proximo_dia_util(data_disponibilizacao::DATE + 1)
WHERE data_disponibilizacao IS NOT NULL;