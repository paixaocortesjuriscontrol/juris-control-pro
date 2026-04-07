
CREATE TABLE public.dados_benner (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  coordenacao_id UUID REFERENCES public.coordenacoes(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'pronto_envio', 'planilhado', 'enviado')),
  
  -- Coluna A: Dossiê
  dossie TEXT,
  -- Campo extra: Contrato
  contrato TEXT,
  -- Coluna B: Tribunal
  tribunal TEXT,
  -- Coluna C: Tipo de Recurso
  tipo_recurso TEXT,
  -- Coluna D: Data Distribuição TST/STF
  data_distribuicao DATE,
  -- Coluna E: Turma
  turma TEXT,
  -- Coluna F: Relator
  relator TEXT,
  -- Coluna G: Análise do Quarteirizado
  analise_quarteirizado TEXT,
  -- Coluna H: Risco de mídia negativa (S/N)
  risco_midia TEXT,
  -- Coluna I: Risco (descrição)
  risco_descricao TEXT,
  -- Coluna J: Provas digitais (S/N)
  provas_digitais TEXT,
  -- Coluna K: Data de Julgamento? (S/N)
  tem_data_julgamento TEXT,
  -- Coluna L: Data Julgamento
  data_julgamento DATE,
  -- Coluna M: Horário
  horario_julgamento TEXT,
  -- Coluna N: Tipo Julgamento
  tipo_julgamento TEXT,
  -- Coluna O: Matéria de Honra (S/N)
  materia_honra TEXT,
  -- Coluna P: Entrega de Memoriais (S/N)
  entrega_memoriais TEXT,
  -- Coluna Q: Sustentação Oral (S/N/Não cabe)
  sustentacao_oral TEXT,
  -- Coluna R: Sem Transcendência
  resultado_sem_transcendencia BOOLEAN DEFAULT FALSE,
  -- Coluna S: Não Conhecido
  resultado_nao_conhecido BOOLEAN DEFAULT FALSE,
  -- Coluna T: Conhecido e Provido
  resultado_conhecido_provido BOOLEAN DEFAULT FALSE,
  -- Coluna U: Conhecido e Não Provido
  resultado_conhecido_nao_provido BOOLEAN DEFAULT FALSE,
  -- Coluna V: Outra
  resultado_outra TEXT,
  -- Coluna W: Observações
  observacoes TEXT,
  -- Coluna X: Ganhamos
  ganhamos BOOLEAN DEFAULT FALSE,
  -- Coluna Y: Perdemos
  perdemos BOOLEAN DEFAULT FALSE,
  -- Coluna Z: Processo Baixado (S/N)
  processo_baixado TEXT,
  -- Coluna AA: Recorrente
  recorrente TEXT,
  -- Coluna AB: Posição Turma Favorável
  posicao_turma_favoravel BOOLEAN DEFAULT FALSE,
  -- Coluna AC: Posição Turma Desfavorável
  posicao_turma_desfavoravel BOOLEAN DEFAULT FALSE,
  -- Coluna AD: Posição Relator Favorável
  posicao_relator_favoravel BOOLEAN DEFAULT FALSE,
  -- Coluna AE: Posição Relator Desfavorável
  posicao_relator_desfavoravel BOOLEAN DEFAULT FALSE,
  -- Coluna AF: Recurso Bem Aparelhado
  recurso_bem_aparelhado BOOLEAN DEFAULT FALSE,
  -- Coluna AG: Recurso Mal Aparelhado
  recurso_mal_aparelhado BOOLEAN DEFAULT FALSE,
  -- Coluna AH: Chance de Êxito
  chance_exito TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger para updated_at
CREATE TRIGGER update_dados_benner_updated_at
  BEFORE UPDATE ON public.dados_benner
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.dados_benner ENABLE ROW LEVEL SECURITY;

-- Usuários autenticados podem ver seus próprios registros ou todos se admin/coordenador
CREATE POLICY "dados_benner_select" ON public.dados_benner
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_admin_or_coordenador(auth.uid())
  );

CREATE POLICY "dados_benner_insert" ON public.dados_benner
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "dados_benner_update" ON public.dados_benner
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_admin_or_coordenador(auth.uid())
  );

CREATE POLICY "dados_benner_delete" ON public.dados_benner
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_admin_or_coordenador(auth.uid())
  );

-- Index para performance
CREATE INDEX idx_dados_benner_status ON public.dados_benner(status);
CREATE INDEX idx_dados_benner_user_id ON public.dados_benner(user_id);
