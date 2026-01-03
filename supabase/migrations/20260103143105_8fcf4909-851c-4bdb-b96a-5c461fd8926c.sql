-- Adicionar coluna para persistir preferência de envio de WhatsApp
ALTER TABLE public.eventos_agenda 
ADD COLUMN enviar_whatsapp boolean NOT NULL DEFAULT true;