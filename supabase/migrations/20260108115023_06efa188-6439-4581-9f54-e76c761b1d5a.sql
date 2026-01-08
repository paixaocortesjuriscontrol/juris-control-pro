-- 1. Remover duplicatas mantendo apenas o registro mais recente
DELETE FROM public.intimacoes_detectadas a
USING public.intimacoes_detectadas b
WHERE a.created_at < b.created_at
  AND a.processo_numero = b.processo_numero
  AND COALESCE(a.tipo_intimacao, '') = COALESCE(b.tipo_intimacao, '')
  AND COALESCE(SUBSTRING(a.conteudo_publicacao FROM 1 FOR 500), '') = COALESCE(SUBSTRING(b.conteudo_publicacao FROM 1 FOR 500), '');

-- 2. Adicionar coluna para hash único de deduplicação
ALTER TABLE public.intimacoes_detectadas 
ADD COLUMN IF NOT EXISTS hash_dedup TEXT;

-- 3. Adicionar colunas para datas corretas do DJEN
ALTER TABLE public.intimacoes_detectadas 
ADD COLUMN IF NOT EXISTS data_disponibilizacao TIMESTAMP WITH TIME ZONE;

-- 4. Gerar hash para registros existentes
UPDATE public.intimacoes_detectadas
SET hash_dedup = MD5(
  COALESCE(processo_numero, '') || '|' ||
  COALESCE(tipo_intimacao, '') || '|' ||
  COALESCE(SUBSTRING(conteudo_publicacao FROM 1 FOR 500), '')
)
WHERE hash_dedup IS NULL;

-- 5. Criar índice único para evitar duplicatas futuras
CREATE UNIQUE INDEX IF NOT EXISTS idx_intimacoes_hash_dedup 
ON public.intimacoes_detectadas(hash_dedup) 
WHERE hash_dedup IS NOT NULL;

-- 6. Função para calcular o primeiro dia útil considerando recesso forense
CREATE OR REPLACE FUNCTION public.calcular_primeiro_dia_util(
  data_base DATE,
  dias_uteis_adicionar INTEGER DEFAULT 0
) RETURNS DATE
LANGUAGE plpgsql
AS $$
DECLARE
  data_resultado DATE;
  contador INTEGER := 0;
  ano_atual INTEGER;
BEGIN
  data_resultado := data_base;
  ano_atual := EXTRACT(YEAR FROM data_resultado);
  
  -- Se data_base for sábado ou domingo, avançar para segunda
  WHILE EXTRACT(DOW FROM data_resultado) IN (0, 6) LOOP
    data_resultado := data_resultado + 1;
  END LOOP;
  
  -- Verificar recesso forense (20 de dezembro a 6 de janeiro)
  -- Se estiver no recesso, pular para 7 de janeiro do próximo ano
  IF (EXTRACT(MONTH FROM data_resultado) = 12 AND EXTRACT(DAY FROM data_resultado) >= 20) THEN
    data_resultado := (ano_atual + 1 || '-01-07')::DATE;
    -- Garantir que 7 de janeiro não seja fim de semana
    WHILE EXTRACT(DOW FROM data_resultado) IN (0, 6) LOOP
      data_resultado := data_resultado + 1;
    END LOOP;
  ELSIF (EXTRACT(MONTH FROM data_resultado) = 1 AND EXTRACT(DAY FROM data_resultado) <= 6) THEN
    data_resultado := (ano_atual || '-01-07')::DATE;
    WHILE EXTRACT(DOW FROM data_resultado) IN (0, 6) LOOP
      data_resultado := data_resultado + 1;
    END LOOP;
  END IF;
  
  -- Adicionar dias úteis se solicitado
  WHILE contador < dias_uteis_adicionar LOOP
    data_resultado := data_resultado + 1;
    
    -- Pular finais de semana
    WHILE EXTRACT(DOW FROM data_resultado) IN (0, 6) LOOP
      data_resultado := data_resultado + 1;
    END LOOP;
    
    -- Verificar recesso forense novamente
    ano_atual := EXTRACT(YEAR FROM data_resultado);
    IF (EXTRACT(MONTH FROM data_resultado) = 12 AND EXTRACT(DAY FROM data_resultado) >= 20) THEN
      data_resultado := (ano_atual + 1 || '-01-07')::DATE;
      WHILE EXTRACT(DOW FROM data_resultado) IN (0, 6) LOOP
        data_resultado := data_resultado + 1;
      END LOOP;
    ELSIF (EXTRACT(MONTH FROM data_resultado) = 1 AND EXTRACT(DAY FROM data_resultado) <= 6) THEN
      data_resultado := (ano_atual || '-01-07')::DATE;
      WHILE EXTRACT(DOW FROM data_resultado) IN (0, 6) LOOP
        data_resultado := data_resultado + 1;
      END LOOP;
    END IF;
    
    contador := contador + 1;
  END LOOP;
  
  RETURN data_resultado;
END;
$$;