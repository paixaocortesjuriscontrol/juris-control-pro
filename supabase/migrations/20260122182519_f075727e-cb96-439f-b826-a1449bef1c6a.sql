-- Restaurar parâmetros estáveis (dentro dos limites das constraints)
UPDATE public.parametros_monitoramento_djen 
SET 
  modo_processamento = 'semi_paralelo',
  max_paralelo = 3,
  max_por_invocacao = 30,
  delay_jina_api = 1500,
  delay_entre_monitoramentos = 300,
  delay_entre_tribunais = 150,
  delay_entre_paginas = 200,
  soft_timeout_ms = 120000,
  finalization_buffer_ms = 15000,
  max_retries = 4,
  retry_base_delay_ms = 3000,
  descricao = 'Configuração estável: semi-paralelo com 3 simultâneos, 30 por invocação, timeout 2min',
  updated_at = now()
WHERE ativo = true;