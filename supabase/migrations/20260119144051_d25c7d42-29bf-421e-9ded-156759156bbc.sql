-- Add Marcela Tavares as member of Coordenação Santander Trabalhista
INSERT INTO membros_coordenacao (coordenacao_id, usuario_id, cargo)
VALUES ('70d3e1ba-70ff-46d0-a6cf-4d4b553d324a', '12837c39-de90-4070-b574-7865f55e6d09', 'advogado')
ON CONFLICT DO NOTHING;