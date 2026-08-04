CREATE TABLE public.auditoria_lotes_admin_tst (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo_operacao text NOT NULL,
  ferramenta text,
  rota text,
  arquivo_nome text,
  usuario_id uuid,
  usuario_nome text,
  usuario_email text,
  coordenacao_id uuid,
  status text NOT NULL DEFAULT 'em_andamento',
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  finalizado_em timestamptz,
  duracao_ms integer,
  total_linhas integer NOT NULL DEFAULT 0,
  total_criados integer NOT NULL DEFAULT 0,
  total_atualizados integer NOT NULL DEFAULT 0,
  total_ignorados integer NOT NULL DEFAULT 0,
  total_erros integer NOT NULL DEFAULT 0,
  itens jsonb NOT NULL DEFAULT '[]'::jsonb,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  resumo text,
  erro_mensagem text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.auditoria_lotes_admin_tst TO authenticated;
GRANT ALL ON public.auditoria_lotes_admin_tst TO service_role;

ALTER TABLE public.auditoria_lotes_admin_tst ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins e coordenadores consultam auditoria de lotes"
ON public.auditoria_lotes_admin_tst FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'coordenador')
  OR public.has_role(auth.uid(), 'assistente_coordenador')
  OR usuario_id = auth.uid()
);

CREATE POLICY "Usuarios registram suas execucoes em lote"
ON public.auditoria_lotes_admin_tst FOR INSERT TO authenticated
WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "Usuarios atualizam suas execucoes em lote"
ON public.auditoria_lotes_admin_tst FOR UPDATE TO authenticated
USING (usuario_id = auth.uid())
WITH CHECK (usuario_id = auth.uid());

CREATE INDEX idx_aud_lotes_tst_tipo ON public.auditoria_lotes_admin_tst (tipo_operacao);
CREATE INDEX idx_aud_lotes_tst_created ON public.auditoria_lotes_admin_tst (created_at DESC);
CREATE INDEX idx_aud_lotes_tst_usuario ON public.auditoria_lotes_admin_tst (usuario_id);
CREATE INDEX idx_aud_lotes_tst_coord ON public.auditoria_lotes_admin_tst (coordenacao_id);

CREATE TRIGGER update_auditoria_lotes_admin_tst_updated_at
BEFORE UPDATE ON public.auditoria_lotes_admin_tst
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();