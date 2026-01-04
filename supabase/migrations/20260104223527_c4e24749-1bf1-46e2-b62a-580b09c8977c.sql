-- Converter campos boolean para text para preservar valores originais
ALTER TABLE public.processos
ALTER COLUMN pedido_excesso_jornada TYPE TEXT USING CASE WHEN pedido_excesso_jornada = true THEN 'Sim' WHEN pedido_excesso_jornada = false THEN 'Não' ELSE NULL END,
ALTER COLUMN pedido_plantoes_extras TYPE TEXT USING CASE WHEN pedido_plantoes_extras = true THEN 'Sim' WHEN pedido_plantoes_extras = false THEN 'Não' ELSE NULL END,
ALTER COLUMN pedido_dobras TYPE TEXT USING CASE WHEN pedido_dobras = true THEN 'Sim' WHEN pedido_dobras = false THEN 'Não' ELSE NULL END,
ALTER COLUMN pedido_intervalo_interjornada TYPE TEXT USING CASE WHEN pedido_intervalo_interjornada = true THEN 'Sim' WHEN pedido_intervalo_interjornada = false THEN 'Não' ELSE NULL END,
ALTER COLUMN pedido_descaract_jornada_12_36 TYPE TEXT USING CASE WHEN pedido_descaract_jornada_12_36 = true THEN 'Sim' WHEN pedido_descaract_jornada_12_36 = false THEN 'Não' ELSE NULL END,
ALTER COLUMN pedido_danos_materiais TYPE TEXT USING CASE WHEN pedido_danos_materiais = true THEN 'Sim' WHEN pedido_danos_materiais = false THEN 'Não' ELSE NULL END,
ALTER COLUMN pedido_pensao_vitalicia TYPE TEXT USING CASE WHEN pedido_pensao_vitalicia = true THEN 'Sim' WHEN pedido_pensao_vitalicia = false THEN 'Não' ELSE NULL END,
ALTER COLUMN pedido_limbo_previdenciario TYPE TEXT USING CASE WHEN pedido_limbo_previdenciario = true THEN 'Sim' WHEN pedido_limbo_previdenciario = false THEN 'Não' ELSE NULL END,
ALTER COLUMN pedido_indenizacao_substitutiva TYPE TEXT USING CASE WHEN pedido_indenizacao_substitutiva = true THEN 'Sim' WHEN pedido_indenizacao_substitutiva = false THEN 'Não' ELSE NULL END,
ALTER COLUMN pedido_reversao_justa_causa TYPE TEXT USING CASE WHEN pedido_reversao_justa_causa = true THEN 'Sim' WHEN pedido_reversao_justa_causa = false THEN 'Não' ELSE NULL END,
ALTER COLUMN pedido_rescisao_indireta TYPE TEXT USING CASE WHEN pedido_rescisao_indireta = true THEN 'Sim' WHEN pedido_rescisao_indireta = false THEN 'Não' ELSE NULL END,
ALTER COLUMN pedido_reversao_pedido_demissao TYPE TEXT USING CASE WHEN pedido_reversao_pedido_demissao = true THEN 'Sim' WHEN pedido_reversao_pedido_demissao = false THEN 'Não' ELSE NULL END;