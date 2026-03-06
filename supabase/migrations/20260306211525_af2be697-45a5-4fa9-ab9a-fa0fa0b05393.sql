
-- Mover TODOS os monitoramentos da Coordenação Dra. Polyana Nava para a Coordenação Dra. Janaina
-- Polyana: 42e2eb97-2a4d-4488-8df1-193d373d3fc9
-- Janaina: f73e8ee7-924c-4518-bbdc-62dd77df93a1

UPDATE monitoramentos_djen 
SET coordenacao_id = 'f73e8ee7-924c-4518-bbdc-62dd77df93a1',
    updated_at = now()
WHERE coordenacao_id = '42e2eb97-2a4d-4488-8df1-193d373d3fc9';

-- Também mover os processos que estavam na coordenação da Polyana para a Janaina
UPDATE processos 
SET coordenacao_id = 'f73e8ee7-924c-4518-bbdc-62dd77df93a1',
    updated_at = now()
WHERE coordenacao_id = '42e2eb97-2a4d-4488-8df1-193d373d3fc9';
