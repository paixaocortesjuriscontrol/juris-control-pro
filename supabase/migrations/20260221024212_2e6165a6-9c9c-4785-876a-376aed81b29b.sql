
-- Apagar todas as publicações da Coordenação Dra. Renata
DELETE FROM publicacoes_djen 
WHERE monitoramento_id IN (
  SELECT id FROM monitoramentos_djen 
  WHERE coordenacao_id = '3e47fc83-3539-4fa7-9fcf-33825120e1b7'
);

DELETE FROM publicacoes_djen_descartadas
WHERE monitoramento_id IN (
  SELECT id FROM monitoramentos_djen 
  WHERE coordenacao_id = '3e47fc83-3539-4fa7-9fcf-33825120e1b7'
);

DELETE FROM publicacoes_djen_processos
WHERE processo_id IN (
  SELECT id FROM processos 
  WHERE coordenacao_id = '3e47fc83-3539-4fa7-9fcf-33825120e1b7'
);
