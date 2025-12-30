-- Adicionar campo providências tomadas e melhorar status
ALTER TABLE public.audiencias_detectadas
ADD COLUMN IF NOT EXISTS providencias_tomadas text,
ADD COLUMN IF NOT EXISTS alerta_enviado boolean DEFAULT false;

-- Criar tabela para alertas de audiências
CREATE TABLE IF NOT EXISTS public.alertas_audiencias (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  audiencia_id uuid NOT NULL REFERENCES public.audiencias_detectadas(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'proximidade', -- 'proximidade', 'hoje', 'amanha'
  dias_restantes integer,
  enviado_em timestamp with time zone NOT NULL DEFAULT now(),
  lido boolean NOT NULL DEFAULT false,
  lido_por uuid REFERENCES auth.users(id),
  lido_em timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.alertas_audiencias ENABLE ROW LEVEL SECURITY;

-- Políticas para alertas de audiências
CREATE POLICY "Sistema pode inserir alertas"
ON public.alertas_audiencias
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem ver alertas"
ON public.alertas_audiencias
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Usuários autenticados podem atualizar alertas"
ON public.alertas_audiencias
FOR UPDATE
USING (auth.uid() IS NOT NULL);

-- Índice para buscar audiências próximas
CREATE INDEX IF NOT EXISTS idx_audiencias_data_status 
ON public.audiencias_detectadas(data_audiencia, status) 
WHERE status = 'pendente';