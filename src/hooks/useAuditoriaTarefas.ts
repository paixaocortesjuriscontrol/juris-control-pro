import { supabase } from "@/integrations/supabase/client";

interface AuditoriaInput {
  acao: 'criar' | 'atualizar' | 'deletar' | 'erro_criar' | 'erro_atualizar' | 'erro_deletar';
  sucesso: boolean;
  dadosEntrada?: Record<string, any>;
  dadosSaida?: Record<string, any>;
  erroMensagem?: string;
  erroDetalhes?: Record<string, any>;
  origem: string;
  processoId?: string;
  tarefaId?: string;
}

export async function registrarAuditoriaTarefa(input: AuditoriaInput): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      console.warn('[Auditoria] Usuário não autenticado, log não registrado');
      return;
    }

    const { error } = await supabase
      .from('auditoria_tarefas')
      .insert({
        usuario_id: user.id,
        acao: input.acao,
        sucesso: input.sucesso,
        dados_entrada: input.dadosEntrada || null,
        dados_saida: input.dadosSaida || null,
        erro_mensagem: input.erroMensagem || null,
        erro_detalhes: input.erroDetalhes || null,
        origem: input.origem,
        processo_id: input.processoId || null,
        tarefa_id: input.tarefaId || null,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      });

    if (error) {
      console.error('[Auditoria] Erro ao registrar auditoria:', error);
    } else {
      console.log(`[Auditoria] Registro ${input.sucesso ? 'sucesso' : 'falha'}: ${input.acao} - ${input.origem}`);
    }
  } catch (err) {
    console.error('[Auditoria] Exceção ao registrar:', err);
  }
}

// Hook para facilitar uso em componentes
export function useAuditoriaTarefas() {
  return {
    registrar: registrarAuditoriaTarefa,
  };
}
