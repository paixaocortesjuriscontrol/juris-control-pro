
DROP POLICY IF EXISTS "Authenticated delete remessas storage" ON storage.objects;
CREATE POLICY "Authenticated delete remessas storage" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'cargas-benner-remessas' AND is_admin_or_coordenador(auth.uid()));

DROP POLICY IF EXISTS "Authenticated update remessas storage" ON storage.objects;
CREATE POLICY "Authenticated update remessas storage" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'cargas-benner-remessas' AND is_admin_or_coordenador(auth.uid())) WITH CHECK (bucket_id = 'cargas-benner-remessas' AND is_admin_or_coordenador(auth.uid()));
