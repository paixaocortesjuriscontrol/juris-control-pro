-- 1) Quem pode ver o registro do anexo (qualquer usuário logado) também pode gerar o link do arquivo
CREATE POLICY "Usuarios logados acessam arquivos vinculados a documentos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documentos_processos'
  AND EXISTS (
    SELECT 1 FROM public.documentos d
    WHERE d.url LIKE '%' || objects.name || '%'
  )
);

-- 2) Recupera o endereço dos anexos gravados sem link
WITH vazios AS (
  SELECT d.id, d.created_at,
         coalesce(d.tarefa_id, d.evento_id, d.audiencia_id)::text AS item,
         d.processo_id::text AS proc,
         regexp_replace(
           translate(d.nome,'áàâãäéêëíïóôõöúüçñÁÀÂÃÄÉÊËÍÏÓÔÕÖÚÜÇÑ','aaaaaeeeiiooooouucnAAAAAEEEIIOOOOOUUCN'),
           '[^a-zA-Z0-9._-]','_','g') AS san
  FROM public.documentos d
  WHERE coalesce(d.url,'') = ''
),
achados AS (
  SELECT v.id,
    (SELECT o.name FROM storage.objects o
      WHERE o.bucket_id = 'documentos_processos'
        AND (right(o.name, length(v.san) + 1) = '_' || v.san
             OR right(o.name, length(v.san) + 1) = '/' || v.san)
        AND (
          (v.item IS NOT NULL AND o.name LIKE '%' || v.item || '/%')
          OR (v.proc IS NOT NULL AND o.name LIKE v.proc || '/%')
          OR abs(extract(epoch FROM o.created_at - v.created_at)) < 600
        )
      ORDER BY abs(extract(epoch FROM o.created_at - v.created_at))
      LIMIT 1) AS obj
  FROM vazios v
)
UPDATE public.documentos d
SET url = 'https://bfxahrrvoqxcdmfsvnrk.supabase.co/storage/v1/object/sign/documentos_processos/' || a.obj
FROM achados a
WHERE a.id = d.id AND a.obj IS NOT NULL;