-- Tabela para configurações de alertas de audiências
CREATE TABLE IF NOT EXISTS public.config_alertas_audiencias (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  enviar_whatsapp_criacao boolean NOT NULL DEFAULT true,
  enviar_email_criacao boolean NOT NULL DEFAULT false,
  destinatarios_whatsapp text[] DEFAULT '{}',
  destinatarios_email text[] DEFAULT '{}',
  lembretes_minutos integer[] DEFAULT '{1440, 60}', -- 1 dia e 1 hora antes por padrão
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Tabela para lembretes de audiências (similar a alertas_evento)
CREATE TABLE IF NOT EXISTS public.lembretes_audiencia (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  audiencia_id uuid NOT NULL REFERENCES public.audiencias_detectadas(id) ON DELETE CASCADE,
  minutos_antes integer NOT NULL DEFAULT 60,
  enviado boolean DEFAULT false,
  enviado_em timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Inserir configuração padrão
INSERT INTO public.config_alertas_audiencias (id, enviar_whatsapp_criacao, enviar_email_criacao, lembretes_minutos)
VALUES (gen_random_uuid(), true, false, '{1440, 60}')
ON CONFLICT DO NOTHING;

-- Habilitar RLS
ALTER TABLE public.config_alertas_audiencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lembretes_audiencia ENABLE ROW LEVEL SECURITY;

-- Políticas para config_alertas_audiencias (admins/coordenadores podem gerenciar)
CREATE POLICY "Admins podem gerenciar config de alertas"
ON public.config_alertas_audiencias
FOR ALL
USING (is_admin_or_coordenador(auth.uid()));

CREATE POLICY "Usuários autenticados podem ver config de alertas"
ON public.config_alertas_audiencias
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Políticas para lembretes_audiencia
CREATE POLICY "Sistema pode inserir lembretes"
ON public.lembretes_audiencia
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Sistema pode atualizar lembretes"
ON public.lembretes_audiencia
FOR UPDATE
USING (true);

CREATE POLICY "Usuários autenticados podem ver lembretes"
ON public.lembretes_audiencia
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_config_alertas_audiencias_updated_at
  BEFORE UPDATE ON public.config_alertas_audiencias
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Índice para buscar lembretes pendentes
CREATE INDEX idx_lembretes_audiencia_pendentes 
ON public.lembretes_audiencia(enviado, audiencia_id) 
WHERE enviado = false;