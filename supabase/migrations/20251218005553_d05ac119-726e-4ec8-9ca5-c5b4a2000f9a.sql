-- Inserir configuração de monitoramento DJEN
INSERT INTO configuracoes_monitoramento (tipo, frequencia, ativo, metadata)
VALUES ('djen', '2x_dia', true, '{}')
ON CONFLICT DO NOTHING;