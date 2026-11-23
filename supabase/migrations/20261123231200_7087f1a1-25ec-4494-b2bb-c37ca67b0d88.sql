CREATE TABLE public.backup_estephany_audiencias_20261123 (id uuid primary key default gen_random_uuid(), origem text not null, linha jsonb not null, created_at timestamptz not null default now());
GRANT ALL ON public.backup_estephany_audiencias_20261123 TO service_role;
ALTER TABLE public.backup_estephany_audiencias_20261123 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins leem backup" ON public.backup_estephany_audiencias_20261123 FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
GRANT SELECT ON public.backup_estephany_audiencias_20261123 TO authenticated;
INSERT INTO public.backup_estephany_audiencias_20261123(origem, linha)
SELECT 'audiencia_envolvidos', to_jsonb(e) FROM audiencia_envolvidos e JOIN audiencias_detectadas a ON a.id=e.audiencia_id
WHERE e.usuario_id='7af108e5-15ab-4142-85bf-a521b3938be2' AND a.coordenacao_id='d997ca10-0012-4a0e-8856-664812366fec';
INSERT INTO public.backup_estephany_audiencias_20261123(origem, linha)
SELECT 'audiencias_advogados', to_jsonb(x) FROM audiencias_advogados x JOIN audiencias_detectadas a ON a.id=x.audiencia_id
WHERE x.advogado_id='7af108e5-15ab-4142-85bf-a521b3938be2' AND a.coordenacao_id='d997ca10-0012-4a0e-8856-664812366fec';