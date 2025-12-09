-- Enable realtime for notificacoes table
ALTER TABLE public.notificacoes REPLICA IDENTITY FULL;

-- Add table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;