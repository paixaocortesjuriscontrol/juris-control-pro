INSERT INTO public.monitoramentos_djen (tipo, termo_busca, descricao, tribunais, ativo, coordenacao_id, criado_por, exclusoes)
SELECT 'parte', t.termo, 'PARTE + ' || t.termo || ' + TST', ARRAY['TST'], true,
       '3e47fc83-3539-4fa7-9fcf-33825120e1b7'::uuid,
       '1dd5f8e3-20fa-4e70-943c-bbbefdc9db37'::uuid,
       ARRAY[]::text[]
FROM (VALUES
 ('BANCO REAL'),('BEN Benefícios'),('Bonsucesso Tecnologia'),('BPV Promotora'),
 ('BW Guirapa'),('CIBRASEC'),('Crediperto'),('F. Café'),('FIRST'),
 ('Fundação Santander'),('Getnet'),('Integry Tecnologia'),('Isban Brasil'),
 ('Izzettle'),('Norchem'),('Olé Bonsucesso'),('Pulse'),('RETURN'),('Ridup'),
 ('ROJO'),('SAM Brasil'),('Sancap'),('Sanprev'),('Santanderprevi'),
 ('SI Distribuidora'),('SX Tools'),('TECBAN'),('Toque Fale'),('Virtual Motors')
) AS t(termo)
WHERE NOT EXISTS (
  SELECT 1 FROM public.monitoramentos_djen m
  WHERE m.coordenacao_id='3e47fc83-3539-4fa7-9fcf-33825120e1b7'
    AND m.tipo='parte' AND lower(m.termo_busca)=lower(t.termo)
);