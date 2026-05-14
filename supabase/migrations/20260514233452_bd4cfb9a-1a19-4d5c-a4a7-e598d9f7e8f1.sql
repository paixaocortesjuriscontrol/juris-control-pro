
-- Mover TODAS as pastas da Janaina para Completa (estão compartilhadas com processos da Completa via FK)
UPDATE public.pastas
   SET coordenacao_id='9d4e11e2-e81f-45ef-a8d4-977ddf371e18'
 WHERE coordenacao_id='f73e8ee7-924c-4518-bbdc-62dd77df93a1';

-- Mover os 2 processos
UPDATE public.processos
   SET coordenacao_id='9d4e11e2-e81f-45ef-a8d4-977ddf371e18'
 WHERE coordenacao_id='f73e8ee7-924c-4518-bbdc-62dd77df93a1';

UPDATE public.processos_responsaveis
   SET coordenacao_id='9d4e11e2-e81f-45ef-a8d4-977ddf371e18'
 WHERE processo_id IN ('7c7fbdc5-c2ad-45e1-a25f-4a3e65caabaf','9d35cebc-91e2-488a-b847-37ca8f64b19b');

UPDATE public.audiencias_detectadas
   SET coordenacao_id='9d4e11e2-e81f-45ef-a8d4-977ddf371e18'
 WHERE processo_id IN ('7c7fbdc5-c2ad-45e1-a25f-4a3e65caabaf','9d35cebc-91e2-488a-b847-37ca8f64b19b');

UPDATE public.publicacoes_djen_processos
   SET coordenacao_id='9d4e11e2-e81f-45ef-a8d4-977ddf371e18'
 WHERE processo_id IN ('7c7fbdc5-c2ad-45e1-a25f-4a3e65caabaf','9d35cebc-91e2-488a-b847-37ca8f64b19b');

UPDATE public.movimentacoes_datajud
   SET coordenacao_id='9d4e11e2-e81f-45ef-a8d4-977ddf371e18'
 WHERE numero_processo IN ('00007859020265100019','00000718720265100001');

-- Apagar resto vinculado à Dra. Janaina
DELETE FROM public.publicacoes_djen WHERE coordenacao_id='f73e8ee7-924c-4518-bbdc-62dd77df93a1';
DELETE FROM public.publicacoes_djen_processos WHERE coordenacao_id='f73e8ee7-924c-4518-bbdc-62dd77df93a1';
DELETE FROM public.movimentacoes_datajud WHERE coordenacao_id='f73e8ee7-924c-4518-bbdc-62dd77df93a1';
DELETE FROM public.audiencias_detectadas WHERE coordenacao_id='f73e8ee7-924c-4518-bbdc-62dd77df93a1';
DELETE FROM public.processos_responsaveis WHERE coordenacao_id='f73e8ee7-924c-4518-bbdc-62dd77df93a1';
DELETE FROM public.alertas_processos_nao_cadastrados WHERE coordenacao_id='f73e8ee7-924c-4518-bbdc-62dd77df93a1';
DELETE FROM public.historico_alertas_enviados WHERE coordenacao_id='f73e8ee7-924c-4518-bbdc-62dd77df93a1';
DELETE FROM public.config_alertas_coordenacao WHERE coordenacao_id='f73e8ee7-924c-4518-bbdc-62dd77df93a1';
DELETE FROM public.alertas_coordenacao_djen WHERE coordenacao_id='f73e8ee7-924c-4518-bbdc-62dd77df93a1';
DELETE FROM public.monitoramentos_djen WHERE coordenacao_id='f73e8ee7-924c-4518-bbdc-62dd77df93a1';

DELETE FROM public.coordenacoes WHERE id='f73e8ee7-924c-4518-bbdc-62dd77df93a1';
