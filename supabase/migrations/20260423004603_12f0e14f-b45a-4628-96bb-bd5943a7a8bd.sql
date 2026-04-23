-- Criar tabela temporária de backup com cópia dos registros preenchidos pela Judit
CREATE TABLE IF NOT EXISTS public.dados_benner_judit_temp AS
SELECT * FROM public.dados_benner WHERE judit_preenchido = true;

-- Criar tabela auxiliar de backup dos responsáveis vinculados
CREATE TABLE IF NOT EXISTS public.dados_benner_judit_temp_responsaveis AS
SELECT r.* FROM public.dados_benner_responsaveis r
WHERE r.dados_benner_id IN (SELECT id FROM public.dados_benner WHERE judit_preenchido = true);

-- Habilitar RLS (somente admins poderão acessar via policy abaixo)
ALTER TABLE public.dados_benner_judit_temp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dados_benner_judit_temp_responsaveis ENABLE ROW LEVEL SECURITY;

-- Policies restritivas: apenas admins
DROP POLICY IF EXISTS "Admins can manage judit temp" ON public.dados_benner_judit_temp;
CREATE POLICY "Admins can manage judit temp"
ON public.dados_benner_judit_temp
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can manage judit temp resp" ON public.dados_benner_judit_temp_responsaveis;
CREATE POLICY "Admins can manage judit temp resp"
ON public.dados_benner_judit_temp_responsaveis
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));