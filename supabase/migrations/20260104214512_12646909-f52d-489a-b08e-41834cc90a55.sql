-- Adicionar campos específicos de "Pedidos" (reclamações trabalhistas) à tabela processos
-- Baseado no Relatório Analítico de Pedidos

-- Campos de identificação do contrato de trabalho
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS lei_13467_2017 text;
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS responsabilidade_subsidiaria text;

-- Campos de Horas Extras
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS pedido_excesso_jornada boolean DEFAULT false;
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS pedido_plantoes_extras boolean DEFAULT false;
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS pedido_dobras boolean DEFAULT false;
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS pedido_intervalo_intrajornada text;
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS pedido_intervalo_interjornada boolean DEFAULT false;
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS pedido_descaract_jornada_12_36 boolean DEFAULT false;
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS pedido_domingos_feriados text;

-- Campos de Insalubridade/Periculosidade e Adicionais
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS pedido_insalubridade_periculosidade text;
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS pedido_diferencas_salariais text;
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS pedido_adicional_noturno text;
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS pedido_sobrecarga_trabalho text;
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS pedido_reconhecimento_vinculo text;

-- Campos de Danos Morais
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS pedido_danos_morais_assedio text;
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS pedido_danos_morais_outros text;

-- Campos de Acidente de Trabalho / Doença Ocupacional
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS pedido_acidente_doenca text;
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS pedido_danos_materiais boolean DEFAULT false;
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS pedido_pensao_vitalicia boolean DEFAULT false;
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS pedido_danos_morais_acidente text;
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS pedido_limbo_previdenciario boolean DEFAULT false;

-- Campos de Estabilidade e Justa Causa
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS pedido_estabilidade text;
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS pedido_indenizacao_substitutiva boolean DEFAULT false;
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS pedido_reversao_justa_causa boolean DEFAULT false;
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS pedido_rescisao_indireta boolean DEFAULT false;
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS pedido_reversao_pedido_demissao boolean DEFAULT false;

-- Campos de Multas
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS pedido_multas_clt text;
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS pedido_multas_ccts text;

-- Campos de Encerramento
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS status_pedido text;
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS motivo_encerramento text;
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS custo_encerramento numeric;

-- Campo para categorizar o tipo de importação
ALTER TABLE public.processos ADD COLUMN IF NOT EXISTS categoria_importacao text;