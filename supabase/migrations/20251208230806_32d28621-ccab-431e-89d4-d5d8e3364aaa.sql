
-- =============================================
-- JURIS CONTROL - DATABASE SCHEMA
-- =============================================

-- 1. ENUM TYPES
-- =============================================
CREATE TYPE public.app_role AS ENUM ('admin', 'coordenador', 'advogado', 'estagiario');
CREATE TYPE public.area_atuacao AS ENUM ('civil', 'trabalhista', 'empresarial');
CREATE TYPE public.status_processo AS ENUM ('ativo', 'pendente', 'urgente', 'encerrado', 'arquivado');
CREATE TYPE public.prioridade_prazo AS ENUM ('baixa', 'media', 'alta', 'urgente');
CREATE TYPE public.status_prazo AS ENUM ('pendente', 'cumprido', 'atrasado');

-- 2. PROFILES TABLE
-- =============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT,
  oab TEXT,
  avatar_url TEXT,
  area_principal area_atuacao,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. USER ROLES TABLE (separate for security)
-- =============================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'advogado',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. COORDENACOES TABLE
-- =============================================
CREATE TABLE public.coordenacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  area area_atuacao NOT NULL,
  coordenador_id UUID REFERENCES public.profiles(id),
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coordenacoes ENABLE ROW LEVEL SECURITY;

-- 5. MEMBROS COORDENACAO (Team Members)
-- =============================================
CREATE TABLE public.membros_coordenacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coordenacao_id UUID NOT NULL REFERENCES public.coordenacoes(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cargo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(coordenacao_id, usuario_id)
);

ALTER TABLE public.membros_coordenacao ENABLE ROW LEVEL SECURITY;

-- 6. CLIENTES TABLE
-- =============================================
CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'pessoa_fisica', -- pessoa_fisica, pessoa_juridica
  cpf_cnpj TEXT,
  email TEXT,
  telefone TEXT,
  endereco TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- 7. PROCESSOS TABLE
-- =============================================
CREATE TABLE public.processos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL UNIQUE,
  cliente_id UUID REFERENCES public.clientes(id),
  area area_atuacao NOT NULL,
  status status_processo NOT NULL DEFAULT 'ativo',
  advogado_responsavel_id UUID REFERENCES public.profiles(id),
  coordenacao_id UUID REFERENCES public.coordenacoes(id),
  classe TEXT,
  assunto TEXT,
  descricao TEXT,
  valor_causa DECIMAL(15,2),
  tribunal TEXT,
  vara TEXT,
  comarca TEXT,
  data_distribuicao DATE,
  data_encerramento DATE,
  polo_ativo TEXT,
  polo_passivo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.processos ENABLE ROW LEVEL SECURITY;

-- 8. MOVIMENTACOES TABLE
-- =============================================
CREATE TABLE public.movimentacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  data_movimentacao TIMESTAMPTZ NOT NULL DEFAULT now(),
  descricao TEXT NOT NULL,
  tipo TEXT,
  fonte TEXT, -- manual, api_tribunal
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.movimentacoes ENABLE ROW LEVEL SECURITY;

-- 9. PRAZOS TABLE
-- =============================================
CREATE TABLE public.prazos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID NOT NULL REFERENCES public.processos(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  data_vencimento DATE NOT NULL,
  prioridade prioridade_prazo NOT NULL DEFAULT 'media',
  status status_prazo NOT NULL DEFAULT 'pendente',
  responsavel_id UUID REFERENCES public.profiles(id),
  data_cumprimento TIMESTAMPTZ,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.prazos ENABLE ROW LEVEL SECURITY;

-- 10. DOCUMENTOS TABLE
-- =============================================
CREATE TABLE public.documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID REFERENCES public.processos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT,
  url TEXT,
  tamanho_bytes BIGINT,
  uploaded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;

-- =============================================
-- SECURITY DEFINER FUNCTIONS
-- =============================================

-- Function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if user is admin or coordenador
CREATE OR REPLACE FUNCTION public.is_admin_or_coordenador(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'coordenador')
  )
$$;

-- Function to get user's coordenacao
CREATE OR REPLACE FUNCTION public.get_user_coordenacao(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coordenacao_id
  FROM public.membros_coordenacao
  WHERE usuario_id = _user_id
  LIMIT 1
$$;

-- =============================================
-- RLS POLICIES
-- =============================================

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- User roles policies
CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Coordenacoes policies
CREATE POLICY "Anyone can view coordenacoes" ON public.coordenacoes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage coordenacoes" ON public.coordenacoes
  FOR ALL TO authenticated USING (public.is_admin_or_coordenador(auth.uid()));

-- Membros coordenacao policies
CREATE POLICY "Anyone can view membros" ON public.membros_coordenacao
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and coordenadores can manage membros" ON public.membros_coordenacao
  FOR ALL TO authenticated USING (public.is_admin_or_coordenador(auth.uid()));

-- Clientes policies
CREATE POLICY "Authenticated users can view clientes" ON public.clientes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage clientes" ON public.clientes
  FOR ALL TO authenticated USING (true);

-- Processos policies
CREATE POLICY "Users can view processos" ON public.processos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert processos" ON public.processos
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update own processos" ON public.processos
  FOR UPDATE TO authenticated USING (
    advogado_responsavel_id = auth.uid() 
    OR public.is_admin_or_coordenador(auth.uid())
  );

-- Movimentacoes policies
CREATE POLICY "Anyone can view movimentacoes" ON public.movimentacoes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert movimentacoes" ON public.movimentacoes
  FOR INSERT TO authenticated WITH CHECK (true);

-- Prazos policies
CREATE POLICY "Users can view prazos" ON public.prazos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can manage prazos" ON public.prazos
  FOR ALL TO authenticated USING (true);

-- Documentos policies
CREATE POLICY "Users can view documentos" ON public.documentos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can upload documentos" ON public.documentos
  FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid());

-- =============================================
-- TRIGGERS
-- =============================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'nome', NEW.email),
    NEW.email
  );
  
  -- Assign default role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'advogado');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_coordenacoes_updated_at
  BEFORE UPDATE ON public.coordenacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_clientes_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_processos_updated_at
  BEFORE UPDATE ON public.processos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_prazos_updated_at
  BEFORE UPDATE ON public.prazos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
