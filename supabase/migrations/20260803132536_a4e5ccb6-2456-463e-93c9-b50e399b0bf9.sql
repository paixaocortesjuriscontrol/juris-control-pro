DO $$
DECLARE
  pares jsonb := '[
    {"de":"13662c36-ecb2-4e4b-8fac-ef08797928de","para":"b98bb067-15b9-4f03-bcbc-db8765fab44b"},
    {"de":"e5008d0b-9b0c-4628-8c83-beb783082151","para":"b98bb067-15b9-4f03-bcbc-db8765fab44b"},
    {"de":"208107f2-e957-4b0d-9aaa-09c2a7d74db1","para":"70b1c350-35ef-4025-b295-679f8cb947b1"}
  ]'::jsonb;
  par jsonb;
  de uuid;
  para uuid;
  col record;
  rec record;
BEGIN
  FOR par IN SELECT * FROM jsonb_array_elements(pares) LOOP
    de := (par->>'de')::uuid;
    para := (par->>'para')::uuid;

    FOR col IN
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema='public'
        AND data_type='uuid'
        AND table_name NOT IN ('profiles')
        AND column_name ~ 'usuario|user_id|responsavel|criado_por|autor|advogado|uploaded_by|alterado_por|membro|coordenador'
    LOOP
      FOR rec IN EXECUTE format('SELECT ctid FROM public.%I WHERE %I = $1', col.table_name, col.column_name) USING de LOOP
        BEGIN
          EXECUTE format('UPDATE public.%I SET %I = $1 WHERE ctid = $2', col.table_name, col.column_name) USING para, rec.ctid;
        EXCEPTION WHEN unique_violation THEN
          EXECUTE format('DELETE FROM public.%I WHERE ctid = $1', col.table_name) USING rec.ctid;
        END;
      END LOOP;
    END LOOP;

    DELETE FROM public.user_roles WHERE user_id = de;
    DELETE FROM public.profiles WHERE id = de;
  END LOOP;
END $$;