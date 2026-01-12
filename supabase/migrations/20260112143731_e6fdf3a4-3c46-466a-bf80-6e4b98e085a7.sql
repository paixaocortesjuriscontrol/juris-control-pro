-- Adicionar campos de agendamento na tabela capturas_intimacoes
ALTER TABLE capturas_intimacoes
ADD COLUMN IF NOT EXISTS horarios_execucao text[] DEFAULT ARRAY['08:00', '14:00', '18:00']::text[],
ADD COLUMN IF NOT EXISTS dias_semana integer[] DEFAULT ARRAY[1,2,3,4,5]::integer[], -- 1=seg, 5=sex
ADD COLUMN IF NOT EXISTS intervalo_minutos integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS modo_captura text DEFAULT 'agendado' CHECK (modo_captura IN ('agendado', 'intervalo', 'manual'));

-- Comentários para documentação
COMMENT ON COLUMN capturas_intimacoes.horarios_execucao IS 'Horários em que a captura deve ser executada (formato HH:MM)';
COMMENT ON COLUMN capturas_intimacoes.dias_semana IS 'Dias da semana para execução: 0=dom, 1=seg, 2=ter, 3=qua, 4=qui, 5=sex, 6=sab';
COMMENT ON COLUMN capturas_intimacoes.intervalo_minutos IS 'Intervalo entre capturas em minutos (apenas para modo_captura=intervalo)';
COMMENT ON COLUMN capturas_intimacoes.modo_captura IS 'Modo de captura: agendado (horários fixos), intervalo (a cada X minutos), manual (só via botão)';