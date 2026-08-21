DELETE FROM public.publicacoes_djen
WHERE coordenacao_id = 'a4a5ce62-4935-4465-8bcd-ac05f25c8a23'
  AND created_at >= '2026-08-21T00:00:00Z';

DELETE FROM public.publicacoes_djen_descartadas
WHERE coordenacao_id = 'a4a5ce62-4935-4465-8bcd-ac05f25c8a23'
  AND created_at >= '2026-08-21T00:00:00Z';

DELETE FROM public.publicacoes_djen_processos
WHERE coordenacao_id = 'a4a5ce62-4935-4465-8bcd-ac05f25c8a23'
  AND created_at >= '2026-08-21T00:00:00Z';

DELETE FROM public.publicacoes_djen_servidor
WHERE coordenacao_id = 'a4a5ce62-4935-4465-8bcd-ac05f25c8a23'
  AND created_at >= '2026-08-21T00:00:00Z';