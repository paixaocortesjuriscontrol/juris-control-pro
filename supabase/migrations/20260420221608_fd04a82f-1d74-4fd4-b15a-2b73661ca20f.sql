
-- Criar bucket privado para armazenar certificados A1 (.pfx)
INSERT INTO storage.buckets (id, name, public)
VALUES ('certificados-a1', 'certificados-a1', false)
ON CONFLICT (id) DO NOTHING;

-- Políticas RLS: apenas o próprio usuário (pasta = auth.uid()) pode ler/gravar/deletar
-- A Edge Function usa service_role e ignora RLS
CREATE POLICY "Usuários podem fazer upload do próprio certificado"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'certificados-a1'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Usuários podem ler o próprio certificado"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'certificados-a1'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Usuários podem atualizar o próprio certificado"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'certificados-a1'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Usuários podem deletar o próprio certificado"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'certificados-a1'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
