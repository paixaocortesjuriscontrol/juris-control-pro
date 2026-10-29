CREATE TABLE public.checklist_modelos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 coordenacao_id uuid REFERENCES public.coordenacoes(id) ON DELETE SET NULL,
 nome text NOT NULL, descricao text, ativo boolean NOT NULL DEFAULT true,
 chave_externa text UNIQUE, criado_por uuid,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.checklist_modelo_itens (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 modelo_id uuid NOT NULL REFERENCES public.checklist_modelos(id) ON DELETE CASCADE,
 titulo text NOT NULL, ordem int NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE public.checklist_itens (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tipo_item text NOT NULL, item_id uuid NOT NULL,
 titulo text NOT NULL, ordem int NOT NULL DEFAULT 0,
 marcado boolean NOT NULL DEFAULT false, marcado_por uuid, marcado_em timestamptz,
 modelo_id uuid REFERENCES public.checklist_modelos(id) ON DELETE SET NULL,
 chave_externa text UNIQUE, criado_por uuid,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX idx_checklist_itens_item ON public.checklist_itens(tipo_item, item_id, ordem);
CREATE INDEX idx_checklist_modelo_itens ON public.checklist_modelo_itens(modelo_id, ordem);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.checklist_modelos, public.checklist_modelo_itens, public.checklist_itens TO authenticated;
GRANT ALL ON public.checklist_modelos, public.checklist_modelo_itens, public.checklist_itens TO service_role;

ALTER TABLE public.checklist_modelos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_modelo_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY checklist_modelos_select ON public.checklist_modelos FOR SELECT TO authenticated USING (true);
CREATE POLICY checklist_modelos_gestao ON public.checklist_modelos FOR ALL TO authenticated
 USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'coordenador') OR has_role(auth.uid(),'assistente_coordenador'))
 WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'coordenador') OR has_role(auth.uid(),'assistente_coordenador'));
CREATE POLICY checklist_modelo_itens_select ON public.checklist_modelo_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY checklist_modelo_itens_gestao ON public.checklist_modelo_itens FOR ALL TO authenticated
 USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'coordenador') OR has_role(auth.uid(),'assistente_coordenador'))
 WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'coordenador') OR has_role(auth.uid(),'assistente_coordenador'));

CREATE POLICY checklist_itens_select ON public.checklist_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY checklist_itens_insert ON public.checklist_itens FOR INSERT TO authenticated WITH CHECK (criado_por = auth.uid());
CREATE POLICY checklist_itens_update ON public.checklist_itens FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY checklist_itens_delete ON public.checklist_itens FOR DELETE TO authenticated
 USING (criado_por = auth.uid() OR has_role(auth.uid(),'admin') OR has_role(auth.uid(),'coordenador') OR has_role(auth.uid(),'assistente_coordenador'));

CREATE TRIGGER trg_checklist_modelos_upd BEFORE UPDATE ON public.checklist_modelos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_checklist_itens_upd BEFORE UPDATE ON public.checklist_itens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.workflow_etapas ADD COLUMN IF NOT EXISTS checklist_modelo_id uuid REFERENCES public.checklist_modelos(id) ON DELETE SET NULL;