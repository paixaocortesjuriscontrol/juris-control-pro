
-- Remove dependent data from test coordinations
DELETE FROM alertas_processos_nao_cadastrados WHERE coordenacao_id IN ('42e2eb97-2a4d-4488-8df1-193d373d3fc9', 'b5caa9da-ed2d-4fbc-8735-9762443e945d');
DELETE FROM config_alertas_coordenacao WHERE coordenacao_id IN ('42e2eb97-2a4d-4488-8df1-193d373d3fc9', 'b5caa9da-ed2d-4fbc-8735-9762443e945d');
DELETE FROM membros_coordenacao WHERE coordenacao_id IN ('42e2eb97-2a4d-4488-8df1-193d373d3fc9', 'b5caa9da-ed2d-4fbc-8735-9762443e945d');
DELETE FROM monitoramentos_djen WHERE coordenacao_id IN ('42e2eb97-2a4d-4488-8df1-193d373d3fc9', 'b5caa9da-ed2d-4fbc-8735-9762443e945d');
DELETE FROM configuracoes_monitoramento WHERE coordenacao_id IN ('42e2eb97-2a4d-4488-8df1-193d373d3fc9', 'b5caa9da-ed2d-4fbc-8735-9762443e945d');
DELETE FROM alertas_coordenacao_djen WHERE coordenacao_id IN ('42e2eb97-2a4d-4488-8df1-193d373d3fc9', 'b5caa9da-ed2d-4fbc-8735-9762443e945d');
DELETE FROM historico_alertas_enviados WHERE coordenacao_id IN ('42e2eb97-2a4d-4488-8df1-193d373d3fc9', 'b5caa9da-ed2d-4fbc-8735-9762443e945d');
DELETE FROM workers_djen_vps WHERE coordenacao_id IN ('42e2eb97-2a4d-4488-8df1-193d373d3fc9', 'b5caa9da-ed2d-4fbc-8735-9762443e945d');
DELETE FROM movimentacoes_datajud WHERE coordenacao_id IN ('42e2eb97-2a4d-4488-8df1-193d373d3fc9', 'b5caa9da-ed2d-4fbc-8735-9762443e945d');

-- Transfer any processes (if any exist) to Dra. Janaina
UPDATE processos SET coordenacao_id = 'f73e8ee7-924c-4518-bbdc-62dd77df93a1' WHERE coordenacao_id IN ('42e2eb97-2a4d-4488-8df1-193d373d3fc9', 'b5caa9da-ed2d-4fbc-8735-9762443e945d');

-- Delete the test coordinations
DELETE FROM coordenacoes WHERE id IN ('42e2eb97-2a4d-4488-8df1-193d373d3fc9', 'b5caa9da-ed2d-4fbc-8735-9762443e945d');
