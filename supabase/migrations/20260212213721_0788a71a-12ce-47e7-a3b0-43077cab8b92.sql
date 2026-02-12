
-- Tabela para rastrear documentos baixados dos tribunais
CREATE TABLE public.processos_documentos_download (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  processo_id UUID NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  cofre_senha_id UUID REFERENCES public.cofre_senhas(id) ON DELETE SET NULL,
  nome_arquivo TEXT NOT NULL,
  tipo_documento TEXT NOT NULL DEFAULT 'auto',
  storage_path TEXT NOT NULL,
  tamanho_bytes INTEGER,
  data_documento DATE,
  status_download TEXT NOT NULL DEFAULT 'pendente',
  mensagem_erro TEXT,
  downloaded_at TIMESTAMPTZ,
  downloaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_proc_docs_download_processo ON public.processos_documentos_download(processo_id);
CREATE INDEX idx_proc_docs_download_status ON public.processos_documentos_download(status_download);

-- Trigger updated_at
CREATE TRIGGER update_processos_documentos_download_updated_at
  BEFORE UPDATE ON public.processos_documentos_download
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.processos_documentos_download ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ver documentos dos seus processos"
  ON public.processos_documentos_download FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.processos p
      WHERE p.id = processo_id
    )
  );

CREATE POLICY "Usuários autenticados podem inserir documentos"
  ON public.processos_documentos_download FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = downloaded_by);

CREATE POLICY "Usuários podem deletar seus próprios downloads"
  ON public.processos_documentos_download FOR DELETE TO authenticated
  USING (auth.uid() = downloaded_by);

-- Storage bucket para autos baixados
INSERT INTO storage.buckets (id, name, public) VALUES ('processos-autos', 'processos-autos', false);

-- Storage RLS policies
CREATE POLICY "Usuários autenticados podem fazer upload de autos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'processos-autos');

CREATE POLICY "Usuários autenticados podem ver autos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'processos-autos');

CREATE POLICY "Usuários autenticados podem deletar autos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'processos-autos');
