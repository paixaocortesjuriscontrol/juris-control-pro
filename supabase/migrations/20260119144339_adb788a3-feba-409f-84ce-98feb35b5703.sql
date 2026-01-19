-- Enable monitoring for all processes in Coordenação Santander Trabalhista
UPDATE processos 
SET monitorar_andamentos = true
WHERE coordenacao_id = '70d3e1ba-70ff-46d0-a6cf-4d4b553d324a';