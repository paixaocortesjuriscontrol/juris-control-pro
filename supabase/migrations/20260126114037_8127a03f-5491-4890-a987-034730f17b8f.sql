-- Ajustar parâmetros DJEN para valores mais conservadores (similares ao início do mês)
UPDATE parametros_monitoramento_djen 
SET 
  delay_jina_api = 3000,
  delay_entre_monitoramentos = 1500,
  delay_entre_paginas = 800,
  delay_entre_tribunais = 600,
  max_paralelo = 2,
  max_por_invocacao = 20,
  descricao = 'Configuração conservadora: 2 paralelos, 20 por invocação, delays aumentados para estabilidade',
  updated_at = NOW()
WHERE ativo = true;