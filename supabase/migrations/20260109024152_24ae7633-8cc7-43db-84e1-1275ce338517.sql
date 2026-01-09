-- Tabela para configuração de alertas WhatsApp por monitoramento DJEN
CREATE TABLE public.alertas_monitoramento_djen (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  monitoramento_id UUID NOT NULL REFERENCES public.monitoramentos_djen(id) ON DELETE CASCADE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  horario_envio TIME NOT NULL DEFAULT '08:00:00',
  membros_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(monitoramento_id)
);

-- Enable RLS
ALTER TABLE public.alertas_monitoramento_djen ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuários podem ver alertas dos monitoramentos que têm acesso"
ON public.alertas_monitoramento_djen
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM monitoramentos_djen m
    WHERE m.id = monitoramento_id
  )
);

CREATE POLICY "Usuários podem criar alertas para monitoramentos que têm acesso"
ON public.alertas_monitoramento_djen
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM monitoramentos_djen m
    WHERE m.id = monitoramento_id
  )
);

CREATE POLICY "Usuários podem atualizar alertas dos monitoramentos que têm acesso"
ON public.alertas_monitoramento_djen
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM monitoramentos_djen m
    WHERE m.id = monitoramento_id
  )
);

CREATE POLICY "Usuários podem deletar alertas dos monitoramentos que têm acesso"
ON public.alertas_monitoramento_djen
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM monitoramentos_djen m
    WHERE m.id = monitoramento_id
  )
);

-- Trigger para updated_at
CREATE TRIGGER update_alertas_monitoramento_djen_updated_at
BEFORE UPDATE ON public.alertas_monitoramento_djen
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();