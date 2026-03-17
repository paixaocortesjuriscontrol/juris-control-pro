
-- Add new columns to audiencias_detectadas for spreadsheet import support
ALTER TABLE public.audiencias_detectadas 
  ADD COLUMN IF NOT EXISTS modalidade text,
  ADD COLUMN IF NOT EXISTS equipe text,
  ADD COLUMN IF NOT EXISTS nucleo_origem text,
  ADD COLUMN IF NOT EXISTS dossie text;

-- Add comments for documentation
COMMENT ON COLUMN public.audiencias_detectadas.modalidade IS 'Virtual ou Presencial';
COMMENT ON COLUMN public.audiencias_detectadas.equipe IS 'Equipe/Núcleo responsável (ex: Núcleo de Terceiros, Ações Especiais)';
COMMENT ON COLUMN public.audiencias_detectadas.nucleo_origem IS 'Núcleo de origem (ex: Núcleo Sudeste, Núcleo Noroeste Sul)';
COMMENT ON COLUMN public.audiencias_detectadas.dossie IS 'Número do dossiê';
