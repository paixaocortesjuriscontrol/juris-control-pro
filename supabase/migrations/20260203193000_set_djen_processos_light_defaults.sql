update public.parametros_monitoramento_djen p
set
  max_paralelo = 1,
  batch_size = 10,
  group_search_size = 10,
  delay_entre_lotes = 10000,
  delay_entre_paginas = 2000,
  soft_timeout_ms = 60000,
  finalization_buffer_ms = 15000,
  max_retries = 5,
  retry_base_delay_ms = 10000
from public.tipo_monitoramento t
where p.tipo_monitoramento_id = t.id
  and t.slug = 'djen_processos';
