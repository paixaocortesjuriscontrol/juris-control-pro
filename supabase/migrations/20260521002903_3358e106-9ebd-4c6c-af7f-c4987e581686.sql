DELETE FROM publicacoes_djen_descartadas d
USING monitoramentos_djen m
WHERE d.monitoramento_id = m.id
  AND m.coordenacao_id = 'b1ff723c-3d0b-40fb-a477-5d2ff2bd7d2f'
  AND d.hash_conteudo = '608d28ae49ca7ee5'
  AND d.processo_numero = '00100745820078260038';