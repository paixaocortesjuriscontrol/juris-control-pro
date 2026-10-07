CREATE TABLE public.credenciais_pje_usuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL UNIQUE,
  cpf text NOT NULL,
  senha_cifrada text NOT NULL,
  tribunais text[] NOT NULL DEFAULT '{}',
  ativo boolean NOT NULL DEFAULT true,
  ultimo_status text,
  ultima_mensagem text,
  ultima_execucao timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT (id, usuario_id, cpf, tribunais, ativo, ultimo_status, ultima_mensagem, ultima_execucao, created_at, updated_at) ON public.credenciais_pje_usuario TO authenticated;
GRANT DELETE, UPDATE (tribunais, ativo) ON public.credenciais_pje_usuario TO authenticated;
GRANT ALL ON public.credenciais_pje_usuario TO service_role;
ALTER TABLE public.credenciais_pje_usuario ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cred_pje_select_own" ON public.credenciais_pje_usuario FOR SELECT TO authenticated USING (usuario_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "cred_pje_update_own" ON public.credenciais_pje_usuario FOR UPDATE TO authenticated USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());
CREATE POLICY "cred_pje_delete_own" ON public.credenciais_pje_usuario FOR DELETE TO authenticated USING (usuario_id = auth.uid());
CREATE TRIGGER trg_cred_pje_updated BEFORE UPDATE ON public.credenciais_pje_usuario FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.execucoes_pje_direto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL,
  coordenacao_id uuid,
  tribunal text NOT NULL,
  avisos_encontrados int NOT NULL DEFAULT 0,
  avisos_filtrados int NOT NULL DEFAULT 0,
  novos int NOT NULL DEFAULT 0,
  erro text,
  origem text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.execucoes_pje_direto TO authenticated;
GRANT ALL ON public.execucoes_pje_direto TO service_role;
ALTER TABLE public.execucoes_pje_direto ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exec_pje_select" ON public.execucoes_pje_direto FOR SELECT TO authenticated USING (usuario_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE INDEX idx_exec_pje_usuario ON public.execucoes_pje_direto(usuario_id, created_at DESC);