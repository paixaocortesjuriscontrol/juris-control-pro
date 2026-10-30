INSERT INTO membros_coordenacao (coordenacao_id, usuario_id, cargo)
SELECT '0e3d8046-4e07-4056-9c8c-2b22cc77297c','233c9fed-cc50-4ce5-8c5f-bf777a84b6cb','assistente_coordenador'
WHERE NOT EXISTS (SELECT 1 FROM membros_coordenacao WHERE coordenacao_id='0e3d8046-4e07-4056-9c8c-2b22cc77297c' AND usuario_id='233c9fed-cc50-4ce5-8c5f-bf777a84b6cb');