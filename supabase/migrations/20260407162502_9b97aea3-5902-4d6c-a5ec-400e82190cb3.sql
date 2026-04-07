UPDATE dados_benner db
SET contrato = dt.processo_numero
FROM distribuicoes_tst dt
WHERE dt.dossie = db.dossie
  AND (db.contrato IS NULL OR db.contrato = '');