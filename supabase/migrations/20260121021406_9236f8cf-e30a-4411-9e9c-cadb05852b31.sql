-- Criar tabela de auditoria para rastrear tentativas de criação de tarefas
CREATE TABLE public.auditoria_tarefas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  usuario_id UUID REFERENCES auth.users(id),
  acao TEXT NOT NULL, -- 'criar', 'atualizar', 'deletar', 'erro_criar'
  sucesso BOOLEAN NOT NULL DEFAULT false,
  dados_entrada JSONB, -- dados que foram tentados salvar
  dados_saida JSONB, -- dados resultantes (se sucesso)
  erro_mensagem TEXT, -- mensagem de erro (se falha)
  erro_detalhes JSONB, -- detalhes técnicos do erro
  origem TEXT, -- 'form_nova_tarefa', 'delegar_dialog', 'monitoramento_djen', etc.
  processo_id UUID,
  tarefa_id UUID,
  ip_address TEXT,
  user_agent TEXT
);

-- Habilitar RLS
ALTER TABLE public.auditoria_tarefas ENABLE ROW LEVEL SECURITY;

-- Política para admins verem tudo
CREATE POLICY "Admins podem ver auditoria" 
ON public.auditoria_tarefas 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

-- Política para usuários verem suas próprias ações
CREATE POLICY "Usuários podem ver própria auditoria" 
ON public.auditoria_tarefas 
FOR SELECT 
USING (auth.uid() = usuario_id);

-- Política para inserção (qualquer usuário autenticado)
CREATE POLICY "Usuários podem inserir auditoria" 
ON public.auditoria_tarefas 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Índices para consultas rápidas
CREATE INDEX idx_auditoria_tarefas_usuario ON public.auditoria_tarefas(usuario_id);
CREATE INDEX idx_auditoria_tarefas_acao ON public.auditoria_tarefas(acao);
CREATE INDEX idx_auditoria_tarefas_sucesso ON public.auditoria_tarefas(sucesso);
CREATE INDEX idx_auditoria_tarefas_created ON public.auditoria_tarefas(created_at DESC);
CREATE INDEX idx_auditoria_tarefas_origem ON public.auditoria_tarefas(origem);