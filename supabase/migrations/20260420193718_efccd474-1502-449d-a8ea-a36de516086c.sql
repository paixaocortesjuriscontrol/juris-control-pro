UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{nome}',
  to_jsonb(p.nome)
)
FROM public.profiles p
WHERE p.id = auth.users.id
  AND p.nome IS NOT NULL
  AND p.nome <> ''
  AND COALESCE(auth.users.raw_user_meta_data->>'nome', '') <> p.nome;