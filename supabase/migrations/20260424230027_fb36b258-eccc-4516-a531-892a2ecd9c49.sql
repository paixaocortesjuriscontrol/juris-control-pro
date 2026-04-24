-- Tabela para persistir o cadastro de VPS proxy do DJEN (POC pool de proxies)
-- Antes ficava só em localStorage, o que fazia o cadastro sumir ao trocar de
-- navegador/dispositivo ou ao limpar dados do site.
CREATE TABLE IF NOT EXISTS public.djen_proxy_pool (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label TEXT NOT NULL,
  base_url TEXT NOT NULL,
  token TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  pool_enabled_global BOOLEAN NOT NULL DEFAULT true,
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Evita duplicar a mesma URL
CREATE UNIQUE INDEX IF NOT EXISTS djen_proxy_pool_base_url_key
  ON public.djen_proxy_pool ((lower(base_url)));

ALTER TABLE public.djen_proxy_pool ENABLE ROW LEVEL SECURITY;

-- Apenas admins/coordenadores podem ver e gerenciar (token é credencial sensível)
DROP POLICY IF EXISTS "Admin/coord podem ver pool de proxies DJEN" ON public.djen_proxy_pool;
CREATE POLICY "Admin/coord podem ver pool de proxies DJEN"
  ON public.djen_proxy_pool
  FOR SELECT
  TO authenticated
  USING (public.is_admin_or_coordenador(auth.uid()));

DROP POLICY IF EXISTS "Admin/coord podem inserir pool de proxies DJEN" ON public.djen_proxy_pool;
CREATE POLICY "Admin/coord podem inserir pool de proxies DJEN"
  ON public.djen_proxy_pool
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_coordenador(auth.uid()));

DROP POLICY IF EXISTS "Admin/coord podem atualizar pool de proxies DJEN" ON public.djen_proxy_pool;
CREATE POLICY "Admin/coord podem atualizar pool de proxies DJEN"
  ON public.djen_proxy_pool
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_coordenador(auth.uid()))
  WITH CHECK (public.is_admin_or_coordenador(auth.uid()));

DROP POLICY IF EXISTS "Admin/coord podem deletar pool de proxies DJEN" ON public.djen_proxy_pool;
CREATE POLICY "Admin/coord podem deletar pool de proxies DJEN"
  ON public.djen_proxy_pool
  FOR DELETE
  TO authenticated
  USING (public.is_admin_or_coordenador(auth.uid()));

-- Trigger para manter updated_at
DROP TRIGGER IF EXISTS update_djen_proxy_pool_updated_at ON public.djen_proxy_pool;
CREATE TRIGGER update_djen_proxy_pool_updated_at
  BEFORE UPDATE ON public.djen_proxy_pool
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para preencher criado_por
DROP TRIGGER IF EXISTS set_criado_por_djen_proxy_pool ON public.djen_proxy_pool;
CREATE TRIGGER set_criado_por_djen_proxy_pool
  BEFORE INSERT ON public.djen_proxy_pool
  FOR EACH ROW
  EXECUTE FUNCTION public.set_criado_por();