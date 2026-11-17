DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['workflows','workflow_etapas','workflow_etapa_atividades','workflow_etapa_envolvidos','workflow_etapa_responsaveis','workflow_execucoes','workflow_execucao_etapas'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Workflows liberados para todos" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Workflows liberados para todos" ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
  END LOOP;
END $$;