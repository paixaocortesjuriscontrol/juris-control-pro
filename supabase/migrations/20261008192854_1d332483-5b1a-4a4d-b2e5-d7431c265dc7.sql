alter table public.credenciais_pje_usuario
  add column if not exists certificado_path text,
  add column if not exists certificado_nome text,
  add column if not exists certificado_senha_cifrada text;