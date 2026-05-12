ALTER TABLE public.dados_benner
  ADD COLUMN IF NOT EXISTS subida_em_massa boolean NOT NULL DEFAULT false;

UPDATE public.dados_benner
   SET subida_em_massa = true
 WHERE relator ILIKE '%subida em massa%';

UPDATE public.dados_benner
   SET relator = NULLIF(
         regexp_replace(
           regexp_replace(relator, 'SUBIDA\s+EM\s+MASSA.*$', '', 'i'),
           '[\s\-–—:]+$', ''
         ),
         ''
       )
 WHERE subida_em_massa = true;