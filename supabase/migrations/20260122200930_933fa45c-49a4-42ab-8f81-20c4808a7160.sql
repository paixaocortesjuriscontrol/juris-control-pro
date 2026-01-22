-- Resetar o metadata do djen_processos para estado limpo
UPDATE configuracoes_monitoramento
SET metadata = jsonb_build_object(
  'cancelado', false,
  'status', 'idle',
  'current', 0,
  'total', 0,
  'novas', 0,
  'next_offset', 0
)
WHERE tipo = 'djen_processos';