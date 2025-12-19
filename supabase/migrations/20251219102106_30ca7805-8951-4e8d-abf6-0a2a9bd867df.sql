-- Adicionar coluna coordenacao_id na tabela configuracoes_monitoramento
ALTER TABLE public.configuracoes_monitoramento 
ADD COLUMN coordenacao_id uuid REFERENCES public.coordenacoes(id) ON DELETE CASCADE;

-- Criar índice para melhor performance
CREATE INDEX idx_configuracoes_monitoramento_coordenacao 
ON public.configuracoes_monitoramento(coordenacao_id);

-- Atualizar políticas RLS para considerar coordenação
DROP POLICY IF EXISTS "Admins podem ver configurações" ON public.configuracoes_monitoramento;
DROP POLICY IF EXISTS "Admins podem editar configurações" ON public.configuracoes_monitoramento;

-- Coordenadores podem ver configurações da sua coordenação
CREATE POLICY "Usuários podem ver configurações da sua coordenação" 
ON public.configuracoes_monitoramento 
FOR SELECT 
USING (
  is_admin_or_coordenador(auth.uid()) 
  AND (
    coordenacao_id IS NULL 
    OR coordenacao_id IN (
      SELECT coordenacao_id FROM membros_coordenacao WHERE usuario_id = auth.uid()
    )
    OR has_role(auth.uid(), 'admin')
  )
);

-- Coordenadores podem editar configurações da sua coordenação
CREATE POLICY "Usuários podem editar configurações da sua coordenação" 
ON public.configuracoes_monitoramento 
FOR UPDATE 
USING (
  is_admin_or_coordenador(auth.uid()) 
  AND (
    coordenacao_id IS NULL 
    OR coordenacao_id IN (
      SELECT coordenacao_id FROM membros_coordenacao WHERE usuario_id = auth.uid()
    )
    OR has_role(auth.uid(), 'admin')
  )
);

-- Admins podem inserir configurações
CREATE POLICY "Admins podem inserir configurações" 
ON public.configuracoes_monitoramento 
FOR INSERT 
WITH CHECK (is_admin_or_coordenador(auth.uid()));

-- Admins podem deletar configurações
CREATE POLICY "Admins podem deletar configurações" 
ON public.configuracoes_monitoramento 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'));

-- Inserir configurações para cada coordenação existente
INSERT INTO configuracoes_monitoramento (tipo, frequencia, ativo, coordenacao_id, metadata)
SELECT 
  tipo.tipo,
  '2x_dia',
  true,
  c.id,
  '{}'::jsonb
FROM coordenacoes c
CROSS JOIN (VALUES ('redistribuicoes'), ('andamentos'), ('distribuicoes'), ('djen')) AS tipo(tipo)
ON CONFLICT DO NOTHING;