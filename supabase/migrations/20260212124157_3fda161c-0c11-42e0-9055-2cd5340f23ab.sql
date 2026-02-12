
-- Atualizar monitoramentos "Advogado" do Dr. Thomás para incluir TJMG e TJSP
UPDATE public.monitoramentos_djen 
SET tribunais = CASE 
  -- Monitoramentos com múltiplos TRTs: adicionar TJMG e TJSP
  WHEN tribunais && ARRAY['TST', 'TRT1', 'TRT2', 'TRT3', 'TRT4', 'TRT5', 'TRT6', 'TRT7', 'TRT8', 'TRT9', 'TRT10', 'TRT11', 'TRT12', 'TRT13', 'TRT14', 'TRT15', 'TRT16', 'TRT17', 'TRT18', 'TRT19', 'TRT20', 'TRT21', 'TRT22', 'TRT23', 'TRT24'] 
    AND NOT (tribunais && ARRAY['TJMG', 'TJSP'])
  THEN tribunais || ARRAY['TJMG', 'TJSP']
  
  -- Monitoramento só com TJSP: adicionar TJMG
  WHEN tribunais = ARRAY['TJSP']::text[] 
  THEN ARRAY['TJSP', 'TJMG']
  
  -- Monitoramento só com TJGO: adicionar TJMG e TJSP
  WHEN tribunais = ARRAY['TJGO']::text[] 
  THEN ARRAY['TJGO', 'TJMG', 'TJSP']
  
  -- Monitoramento com TJDFT/STJ/TRF1: adicionar TJMG e TJSP
  WHEN tribunais && ARRAY['TJDFT', 'STJ', 'TRF1'] 
    AND NOT (tribunais && ARRAY['TJMG', 'TJSP'])
  THEN tribunais || ARRAY['TJMG', 'TJSP']
  
  -- Monitoramento só com STJ: adicionar TJMG e TJSP
  WHEN tribunais = ARRAY['STJ']::text[]
  THEN ARRAY['STJ', 'TJMG', 'TJSP']
  
  -- Monitoramento só com TRF1: adicionar TJMG e TJSP
  WHEN tribunais = ARRAY['TRF1']::text[]
  THEN ARRAY['TRF1', 'TJMG', 'TJSP']
  
  ELSE tribunais
END,
updated_at = NOW()
WHERE coordenacao_id = 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f' 
  AND tipo = 'advogado'
  AND termo_busca = 'OSMAR MENDES PAIXAO CORTES';
