-- Adicionar campo para agrupar parcelas relacionadas
ALTER TABLE public.eventos_agenda 
ADD COLUMN IF NOT EXISTS grupo_parcelas uuid DEFAULT NULL,
ADD COLUMN IF NOT EXISTS numero_parcela integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS total_parcelas integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS valor_parcela numeric(15,2) DEFAULT NULL;

-- Índice para buscar parcelas do mesmo grupo
CREATE INDEX IF NOT EXISTS idx_eventos_agenda_grupo_parcelas ON public.eventos_agenda(grupo_parcelas) WHERE grupo_parcelas IS NOT NULL;

-- Comentários para documentação
COMMENT ON COLUMN public.eventos_agenda.grupo_parcelas IS 'UUID que agrupa parcelas do mesmo parcelamento';
COMMENT ON COLUMN public.eventos_agenda.numero_parcela IS 'Número da parcela (1, 2, 3...)';
COMMENT ON COLUMN public.eventos_agenda.total_parcelas IS 'Total de parcelas do parcelamento';
COMMENT ON COLUMN public.eventos_agenda.valor_parcela IS 'Valor da parcela em reais';