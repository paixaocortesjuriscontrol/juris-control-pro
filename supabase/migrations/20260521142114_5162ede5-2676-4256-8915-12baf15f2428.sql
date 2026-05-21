DELETE FROM publicacoes_djen
WHERE created_at >= (CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo')
  AND monitoramento_id IN (
    SELECT id FROM monitoramentos_djen
    WHERE coordenacao_id IN (
      'b6a3a750-3109-4962-bea9-7b5116e3a4fd',
      '6324396e-487a-4b4b-8bae-aacb3bb161bc'
    )
  );