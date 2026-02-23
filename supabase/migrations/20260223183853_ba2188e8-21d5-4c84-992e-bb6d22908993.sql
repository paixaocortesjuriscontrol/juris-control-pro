
-- Limpar publicações das coordenações Dra. Renata Santander e Dra. Renata Geral
DELETE FROM publicacoes_djen 
WHERE monitoramento_id IN (
  SELECT id FROM monitoramentos_djen 
  WHERE coordenacao_id IN ('3e47fc83-3539-4fa7-9fcf-33825120e1b7', 'b6a3a750-3109-4962-bea9-7b5116e3a4fd')
);

DELETE FROM publicacoes_djen_descartadas 
WHERE monitoramento_id IN (
  SELECT id FROM monitoramentos_djen 
  WHERE coordenacao_id IN ('3e47fc83-3539-4fa7-9fcf-33825120e1b7', 'b6a3a750-3109-4962-bea9-7b5116e3a4fd')
);

DELETE FROM publicacoes_djen_processos 
WHERE processo_id IN (
  SELECT id FROM processos 
  WHERE coordenacao_id IN ('3e47fc83-3539-4fa7-9fcf-33825120e1b7', 'b6a3a750-3109-4962-bea9-7b5116e3a4fd')
);
