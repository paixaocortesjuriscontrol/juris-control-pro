
-- Reatribuir os 16 processos TST de Marcela Tavares para Lienne Vasconcelos
-- na Coordenação Dra. Renata
UPDATE processos 
SET advogado_responsavel_id = 'b6ad7321-65fa-41ff-bff2-bdace43c9f66' -- Lienne Vasconcelos
WHERE coordenacao_id = '3e47fc83-3539-4fa7-9fcf-33825120e1b7' -- Coord Dra. Renata
  AND advogado_responsavel_id = (SELECT id FROM profiles WHERE nome ILIKE '%marcela%tavares%' LIMIT 1)
  AND numero IN (
    '0001399-69.2014.5.10.0002','0000907-57.2014.5.23.0021','0000672-72.2022.5.10.0021',
    '0000778-41.2020.5.10.0009','0000335-63.2024.5.10.0005','0001376-72.2023.5.10.0014',
    '0010571-32.2024.5.18.0141','0000366-05.2023.5.10.0010','0000724-70.2023.5.10.0009',
    '0001083-81.2023.5.10.0021','0010938-25.2019.5.18.0111','0000597-22.2024.5.10.0002',
    '0011327-53.2018.5.18.0011','0001519-79.2014.5.10.0013','0001717-72.2025.5.10.0000',
    '0000968-68.2024.5.10.0007'
  );
