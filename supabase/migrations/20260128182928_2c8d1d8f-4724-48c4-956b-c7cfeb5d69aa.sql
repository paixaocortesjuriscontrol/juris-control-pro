-- Migrar pedidos existentes dos campos da tabela processos para a tabela pedidos_processo
-- Cada campo pedido_* com valor válido vira uma linha na tabela pedidos_processo

INSERT INTO public.pedidos_processo (processo_id, pedido, observacao)
SELECT p.id, 'Excesso de Jornada', p.pedido_excesso_jornada
FROM public.processos p
WHERE p.pedido_excesso_jornada IS NOT NULL 
  AND TRIM(p.pedido_excesso_jornada) != '' 
  AND LOWER(TRIM(p.pedido_excesso_jornada)) NOT IN ('não', 'nao', 'n', '-')
  AND NOT EXISTS (
    SELECT 1 FROM public.pedidos_processo pp 
    WHERE pp.processo_id = p.id AND pp.pedido = 'Excesso de Jornada'
  );

INSERT INTO public.pedidos_processo (processo_id, pedido, observacao)
SELECT p.id, 'Plantões Extras', p.pedido_plantoes_extras
FROM public.processos p
WHERE p.pedido_plantoes_extras IS NOT NULL 
  AND TRIM(p.pedido_plantoes_extras) != '' 
  AND LOWER(TRIM(p.pedido_plantoes_extras)) NOT IN ('não', 'nao', 'n', '-')
  AND NOT EXISTS (
    SELECT 1 FROM public.pedidos_processo pp 
    WHERE pp.processo_id = p.id AND pp.pedido = 'Plantões Extras'
  );

INSERT INTO public.pedidos_processo (processo_id, pedido, observacao)
SELECT p.id, 'Dobras', p.pedido_dobras
FROM public.processos p
WHERE p.pedido_dobras IS NOT NULL 
  AND TRIM(p.pedido_dobras) != '' 
  AND LOWER(TRIM(p.pedido_dobras)) NOT IN ('não', 'nao', 'n', '-')
  AND NOT EXISTS (
    SELECT 1 FROM public.pedidos_processo pp 
    WHERE pp.processo_id = p.id AND pp.pedido = 'Dobras'
  );

INSERT INTO public.pedidos_processo (processo_id, pedido, observacao)
SELECT p.id, 'Intervalo Intrajornada', p.pedido_intervalo_intrajornada
FROM public.processos p
WHERE p.pedido_intervalo_intrajornada IS NOT NULL 
  AND TRIM(p.pedido_intervalo_intrajornada) != '' 
  AND LOWER(TRIM(p.pedido_intervalo_intrajornada)) NOT IN ('não', 'nao', 'n', '-')
  AND NOT EXISTS (
    SELECT 1 FROM public.pedidos_processo pp 
    WHERE pp.processo_id = p.id AND pp.pedido = 'Intervalo Intrajornada'
  );

INSERT INTO public.pedidos_processo (processo_id, pedido, observacao)
SELECT p.id, 'Intervalo Interjornada', p.pedido_intervalo_interjornada
FROM public.processos p
WHERE p.pedido_intervalo_interjornada IS NOT NULL 
  AND TRIM(p.pedido_intervalo_interjornada) != '' 
  AND LOWER(TRIM(p.pedido_intervalo_interjornada)) NOT IN ('não', 'nao', 'n', '-')
  AND NOT EXISTS (
    SELECT 1 FROM public.pedidos_processo pp 
    WHERE pp.processo_id = p.id AND pp.pedido = 'Intervalo Interjornada'
  );

INSERT INTO public.pedidos_processo (processo_id, pedido, observacao)
SELECT p.id, 'Descaracterização Jornada 12x36', p.pedido_descaract_jornada_12_36
FROM public.processos p
WHERE p.pedido_descaract_jornada_12_36 IS NOT NULL 
  AND TRIM(p.pedido_descaract_jornada_12_36) != '' 
  AND LOWER(TRIM(p.pedido_descaract_jornada_12_36)) NOT IN ('não', 'nao', 'n', '-')
  AND NOT EXISTS (
    SELECT 1 FROM public.pedidos_processo pp 
    WHERE pp.processo_id = p.id AND pp.pedido = 'Descaracterização Jornada 12x36'
  );

INSERT INTO public.pedidos_processo (processo_id, pedido, observacao)
SELECT p.id, 'Domingos e Feriados', p.pedido_domingos_feriados
FROM public.processos p
WHERE p.pedido_domingos_feriados IS NOT NULL 
  AND TRIM(p.pedido_domingos_feriados) != '' 
  AND LOWER(TRIM(p.pedido_domingos_feriados)) NOT IN ('não', 'nao', 'n', '-')
  AND NOT EXISTS (
    SELECT 1 FROM public.pedidos_processo pp 
    WHERE pp.processo_id = p.id AND pp.pedido = 'Domingos e Feriados'
  );

INSERT INTO public.pedidos_processo (processo_id, pedido, observacao)
SELECT p.id, 'Insalubridade/Periculosidade', p.pedido_insalubridade_periculosidade
FROM public.processos p
WHERE p.pedido_insalubridade_periculosidade IS NOT NULL 
  AND TRIM(p.pedido_insalubridade_periculosidade) != '' 
  AND LOWER(TRIM(p.pedido_insalubridade_periculosidade)) NOT IN ('não', 'nao', 'n', '-')
  AND NOT EXISTS (
    SELECT 1 FROM public.pedidos_processo pp 
    WHERE pp.processo_id = p.id AND pp.pedido = 'Insalubridade/Periculosidade'
  );

INSERT INTO public.pedidos_processo (processo_id, pedido, observacao)
SELECT p.id, 'Diferenças Salariais', p.pedido_diferencas_salariais
FROM public.processos p
WHERE p.pedido_diferencas_salariais IS NOT NULL 
  AND TRIM(p.pedido_diferencas_salariais) != '' 
  AND LOWER(TRIM(p.pedido_diferencas_salariais)) NOT IN ('não', 'nao', 'n', '-')
  AND NOT EXISTS (
    SELECT 1 FROM public.pedidos_processo pp 
    WHERE pp.processo_id = p.id AND pp.pedido = 'Diferenças Salariais'
  );

INSERT INTO public.pedidos_processo (processo_id, pedido, observacao)
SELECT p.id, 'Adicional Noturno', p.pedido_adicional_noturno
FROM public.processos p
WHERE p.pedido_adicional_noturno IS NOT NULL 
  AND TRIM(p.pedido_adicional_noturno) != '' 
  AND LOWER(TRIM(p.pedido_adicional_noturno)) NOT IN ('não', 'nao', 'n', '-')
  AND NOT EXISTS (
    SELECT 1 FROM public.pedidos_processo pp 
    WHERE pp.processo_id = p.id AND pp.pedido = 'Adicional Noturno'
  );

INSERT INTO public.pedidos_processo (processo_id, pedido, observacao)
SELECT p.id, 'Sobrecarga de Trabalho', p.pedido_sobrecarga_trabalho
FROM public.processos p
WHERE p.pedido_sobrecarga_trabalho IS NOT NULL 
  AND TRIM(p.pedido_sobrecarga_trabalho) != '' 
  AND LOWER(TRIM(p.pedido_sobrecarga_trabalho)) NOT IN ('não', 'nao', 'n', '-')
  AND NOT EXISTS (
    SELECT 1 FROM public.pedidos_processo pp 
    WHERE pp.processo_id = p.id AND pp.pedido = 'Sobrecarga de Trabalho'
  );

INSERT INTO public.pedidos_processo (processo_id, pedido, observacao)
SELECT p.id, 'Reconhecimento de Vínculo', p.pedido_reconhecimento_vinculo
FROM public.processos p
WHERE p.pedido_reconhecimento_vinculo IS NOT NULL 
  AND TRIM(p.pedido_reconhecimento_vinculo) != '' 
  AND LOWER(TRIM(p.pedido_reconhecimento_vinculo)) NOT IN ('não', 'nao', 'n', '-')
  AND NOT EXISTS (
    SELECT 1 FROM public.pedidos_processo pp 
    WHERE pp.processo_id = p.id AND pp.pedido = 'Reconhecimento de Vínculo'
  );

INSERT INTO public.pedidos_processo (processo_id, pedido, observacao)
SELECT p.id, 'Danos Morais - Assédio', p.pedido_danos_morais_assedio
FROM public.processos p
WHERE p.pedido_danos_morais_assedio IS NOT NULL 
  AND TRIM(p.pedido_danos_morais_assedio) != '' 
  AND LOWER(TRIM(p.pedido_danos_morais_assedio)) NOT IN ('não', 'nao', 'n', '-')
  AND NOT EXISTS (
    SELECT 1 FROM public.pedidos_processo pp 
    WHERE pp.processo_id = p.id AND pp.pedido = 'Danos Morais - Assédio'
  );

INSERT INTO public.pedidos_processo (processo_id, pedido, observacao)
SELECT p.id, 'Danos Morais - Outros', p.pedido_danos_morais_outros
FROM public.processos p
WHERE p.pedido_danos_morais_outros IS NOT NULL 
  AND TRIM(p.pedido_danos_morais_outros) != '' 
  AND LOWER(TRIM(p.pedido_danos_morais_outros)) NOT IN ('não', 'nao', 'n', '-')
  AND NOT EXISTS (
    SELECT 1 FROM public.pedidos_processo pp 
    WHERE pp.processo_id = p.id AND pp.pedido = 'Danos Morais - Outros'
  );

INSERT INTO public.pedidos_processo (processo_id, pedido, observacao)
SELECT p.id, 'Acidente/Doença', p.pedido_acidente_doenca
FROM public.processos p
WHERE p.pedido_acidente_doenca IS NOT NULL 
  AND TRIM(p.pedido_acidente_doenca) != '' 
  AND LOWER(TRIM(p.pedido_acidente_doenca)) NOT IN ('não', 'nao', 'n', '-')
  AND NOT EXISTS (
    SELECT 1 FROM public.pedidos_processo pp 
    WHERE pp.processo_id = p.id AND pp.pedido = 'Acidente/Doença'
  );

INSERT INTO public.pedidos_processo (processo_id, pedido, observacao)
SELECT p.id, 'Danos Materiais', p.pedido_danos_materiais
FROM public.processos p
WHERE p.pedido_danos_materiais IS NOT NULL 
  AND TRIM(p.pedido_danos_materiais) != '' 
  AND LOWER(TRIM(p.pedido_danos_materiais)) NOT IN ('não', 'nao', 'n', '-')
  AND NOT EXISTS (
    SELECT 1 FROM public.pedidos_processo pp 
    WHERE pp.processo_id = p.id AND pp.pedido = 'Danos Materiais'
  );

INSERT INTO public.pedidos_processo (processo_id, pedido, observacao)
SELECT p.id, 'Pensão Vitalícia', p.pedido_pensao_vitalicia
FROM public.processos p
WHERE p.pedido_pensao_vitalicia IS NOT NULL 
  AND TRIM(p.pedido_pensao_vitalicia) != '' 
  AND LOWER(TRIM(p.pedido_pensao_vitalicia)) NOT IN ('não', 'nao', 'n', '-')
  AND NOT EXISTS (
    SELECT 1 FROM public.pedidos_processo pp 
    WHERE pp.processo_id = p.id AND pp.pedido = 'Pensão Vitalícia'
  );

INSERT INTO public.pedidos_processo (processo_id, pedido, observacao)
SELECT p.id, 'Danos Morais - Acidente', p.pedido_danos_morais_acidente
FROM public.processos p
WHERE p.pedido_danos_morais_acidente IS NOT NULL 
  AND TRIM(p.pedido_danos_morais_acidente) != '' 
  AND LOWER(TRIM(p.pedido_danos_morais_acidente)) NOT IN ('não', 'nao', 'n', '-')
  AND NOT EXISTS (
    SELECT 1 FROM public.pedidos_processo pp 
    WHERE pp.processo_id = p.id AND pp.pedido = 'Danos Morais - Acidente'
  );

INSERT INTO public.pedidos_processo (processo_id, pedido, observacao)
SELECT p.id, 'Limbo Previdenciário', p.pedido_limbo_previdenciario
FROM public.processos p
WHERE p.pedido_limbo_previdenciario IS NOT NULL 
  AND TRIM(p.pedido_limbo_previdenciario) != '' 
  AND LOWER(TRIM(p.pedido_limbo_previdenciario)) NOT IN ('não', 'nao', 'n', '-')
  AND NOT EXISTS (
    SELECT 1 FROM public.pedidos_processo pp 
    WHERE pp.processo_id = p.id AND pp.pedido = 'Limbo Previdenciário'
  );

INSERT INTO public.pedidos_processo (processo_id, pedido, observacao)
SELECT p.id, 'Estabilidade', p.pedido_estabilidade
FROM public.processos p
WHERE p.pedido_estabilidade IS NOT NULL 
  AND TRIM(p.pedido_estabilidade) != '' 
  AND LOWER(TRIM(p.pedido_estabilidade)) NOT IN ('não', 'nao', 'n', '-')
  AND NOT EXISTS (
    SELECT 1 FROM public.pedidos_processo pp 
    WHERE pp.processo_id = p.id AND pp.pedido = 'Estabilidade'
  );

INSERT INTO public.pedidos_processo (processo_id, pedido, observacao)
SELECT p.id, 'Indenização Substitutiva', p.pedido_indenizacao_substitutiva
FROM public.processos p
WHERE p.pedido_indenizacao_substitutiva IS NOT NULL 
  AND TRIM(p.pedido_indenizacao_substitutiva) != '' 
  AND LOWER(TRIM(p.pedido_indenizacao_substitutiva)) NOT IN ('não', 'nao', 'n', '-')
  AND NOT EXISTS (
    SELECT 1 FROM public.pedidos_processo pp 
    WHERE pp.processo_id = p.id AND pp.pedido = 'Indenização Substitutiva'
  );

INSERT INTO public.pedidos_processo (processo_id, pedido, observacao)
SELECT p.id, 'Reversão Justa Causa', p.pedido_reversao_justa_causa
FROM public.processos p
WHERE p.pedido_reversao_justa_causa IS NOT NULL 
  AND TRIM(p.pedido_reversao_justa_causa) != '' 
  AND LOWER(TRIM(p.pedido_reversao_justa_causa)) NOT IN ('não', 'nao', 'n', '-')
  AND NOT EXISTS (
    SELECT 1 FROM public.pedidos_processo pp 
    WHERE pp.processo_id = p.id AND pp.pedido = 'Reversão Justa Causa'
  );

INSERT INTO public.pedidos_processo (processo_id, pedido, observacao)
SELECT p.id, 'Rescisão Indireta', p.pedido_rescisao_indireta
FROM public.processos p
WHERE p.pedido_rescisao_indireta IS NOT NULL 
  AND TRIM(p.pedido_rescisao_indireta) != '' 
  AND LOWER(TRIM(p.pedido_rescisao_indireta)) NOT IN ('não', 'nao', 'n', '-')
  AND NOT EXISTS (
    SELECT 1 FROM public.pedidos_processo pp 
    WHERE pp.processo_id = p.id AND pp.pedido = 'Rescisão Indireta'
  );

INSERT INTO public.pedidos_processo (processo_id, pedido, observacao)
SELECT p.id, 'Reversão Pedido Demissão', p.pedido_reversao_pedido_demissao
FROM public.processos p
WHERE p.pedido_reversao_pedido_demissao IS NOT NULL 
  AND TRIM(p.pedido_reversao_pedido_demissao) != '' 
  AND LOWER(TRIM(p.pedido_reversao_pedido_demissao)) NOT IN ('não', 'nao', 'n', '-')
  AND NOT EXISTS (
    SELECT 1 FROM public.pedidos_processo pp 
    WHERE pp.processo_id = p.id AND pp.pedido = 'Reversão Pedido Demissão'
  );

INSERT INTO public.pedidos_processo (processo_id, pedido, observacao)
SELECT p.id, 'Multas CLT', p.pedido_multas_clt
FROM public.processos p
WHERE p.pedido_multas_clt IS NOT NULL 
  AND TRIM(p.pedido_multas_clt) != '' 
  AND LOWER(TRIM(p.pedido_multas_clt)) NOT IN ('não', 'nao', 'n', '-')
  AND NOT EXISTS (
    SELECT 1 FROM public.pedidos_processo pp 
    WHERE pp.processo_id = p.id AND pp.pedido = 'Multas CLT'
  );

INSERT INTO public.pedidos_processo (processo_id, pedido, observacao)
SELECT p.id, 'Multas CCTs', p.pedido_multas_ccts
FROM public.processos p
WHERE p.pedido_multas_ccts IS NOT NULL 
  AND TRIM(p.pedido_multas_ccts) != '' 
  AND LOWER(TRIM(p.pedido_multas_ccts)) NOT IN ('não', 'nao', 'n', '-')
  AND NOT EXISTS (
    SELECT 1 FROM public.pedidos_processo pp 
    WHERE pp.processo_id = p.id AND pp.pedido = 'Multas CCTs'
  );