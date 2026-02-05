// ============================================================================
// TASK FUNCTIONS for monitorar-djen
// ============================================================================

// Gera hash para deduplicação de tarefas
export function generateTaskDedupKey(processoId: string, titulo: string, dataVencimento: string): string {
  const tituloNorm = titulo.toLowerCase().replace(/\s+/g, ' ').trim();
  const dataNorm = dataVencimento?.split('T')[0] || '';
  return `${processoId}|${tituloNorm}|${dataNorm}`;
}

// Verifica se já existe tarefa similar para evitar duplicatas
export async function verificarTarefaExistente(
  supabase: any,
  processoId: string,
  responsavelId: string,
  titulo: string,
  dataVencimento: string
): Promise<boolean> {
  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - 30);
  
  const tituloBase = titulo.toLowerCase().replace(/\s+/g, ' ').trim();
  
  const { data: existentes } = await supabase
    .from('tarefas')
    .select('id, titulo')
    .eq('processo_id', processoId)
    .eq('responsavel_id', responsavelId)
    .gte('created_at', dataLimite.toISOString())
    .limit(50);
  
  if (!existentes || existentes.length === 0) return false;
  
  for (const t of existentes) {
    const tituloExistente = (t.titulo || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (tituloExistente === tituloBase) {
      console.log(`[DEDUP] Tarefa duplicada detectada: "${titulo}" já existe para processo ${processoId}`);
      return true;
    }
    if (tituloBase.startsWith('[djen]') && tituloExistente.startsWith('[djen]')) {
      const numMatch = tituloBase.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/);
      const numExistenteMatch = tituloExistente.match(/\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/);
      if (numMatch && numExistenteMatch && numMatch[0] === numExistenteMatch[0]) {
        const tipoMatch = tituloBase.match(/\[(djen|andamento)\]\s*(\w+)/i);
        const tipoExistenteMatch = tituloExistente.match(/\[(djen|andamento)\]\s*(\w+)/i);
        if (tipoMatch && tipoExistenteMatch && tipoMatch[2] === tipoExistenteMatch[2]) {
          console.log(`[DEDUP] Tarefa DJEN duplicada: tipo "${tipoMatch[2]}" já existe para processo`);
          return true;
        }
      }
    }
  }
  
  return false;
}

export async function criarTarefasParaResponsaveis(
  supabase: any,
  processoNumero: string,
  titulo: string,
  descricao: string,
  dataVencimento: string,
  prioridade: string,
  origem: string,
  tipoTarefa: string,
  publicacaoId?: string
): Promise<string[]> {
  const { data: processo } = await supabase
    .from('processos')
    .select('id, advogado_responsavel_id')
    .eq('numero', processoNumero)
    .single();

  if (!processo) {
    console.log(`Process not found for number ${processoNumero}, cannot create task`);
    return [];
  }

  const { data: responsaveis } = await supabase
    .from('processos_responsaveis')
    .select('responsavel_id')
    .eq('processo_id', processo.id);

  if (!responsaveis || responsaveis.length === 0) {
    if (processo.advogado_responsavel_id) {
      const jáExiste = await verificarTarefaExistente(
        supabase, processo.id, processo.advogado_responsavel_id, titulo, dataVencimento
      );
      if (jáExiste) {
        console.log(`[DEDUP] Pulando criação de tarefa duplicada para ${processoNumero}`);
        return [];
      }
      
      const { data: tarefa, error } = await supabase
        .from('tarefas')
        .insert({
          processo_id: processo.id,
          responsavel_id: processo.advogado_responsavel_id,
          criado_por: processo.advogado_responsavel_id,
          titulo,
          descricao,
          data_vencimento: dataVencimento,
          prioridade,
          status: 'pendente',
          origem,
          tipo_tarefa: tipoTarefa,
        })
        .select('id')
        .single();

      if (!error && tarefa) {
        console.log(`Created task ${tarefa.id} for legacy responsible`);
        
        if (publicacaoId) {
          await supabase
            .from('tarefas_publicacoes')
            .insert({
              tarefa_id: tarefa.id,
              publicacao_id: publicacaoId,
            });
        }
        
        return [tarefa.id];
      }
    }
    return [];
  }

  const tarefaIds: string[] = [];
  for (const resp of responsaveis) {
    const jáExiste = await verificarTarefaExistente(
      supabase, processo.id, resp.responsavel_id, titulo, dataVencimento
    );
    if (jáExiste) {
      console.log(`[DEDUP] Pulando tarefa duplicada para responsável ${resp.responsavel_id}`);
      continue;
    }
    
    const { data: tarefa, error } = await supabase
      .from('tarefas')
      .insert({
        processo_id: processo.id,
        responsavel_id: resp.responsavel_id,
        criado_por: resp.responsavel_id,
        titulo,
        descricao,
        data_vencimento: dataVencimento,
        prioridade,
        status: 'pendente',
        origem,
        tipo_tarefa: tipoTarefa,
      })
      .select('id')
      .single();

    if (!error && tarefa) {
      tarefaIds.push(tarefa.id);
      
      if (publicacaoId) {
        await supabase
          .from('tarefas_publicacoes')
          .insert({
            tarefa_id: tarefa.id,
            publicacao_id: publicacaoId,
          });
      }
    }
  }

  if (tarefaIds.length > 0) {
    console.log(`Created ${tarefaIds.length} tasks for process ${processoNumero}`);
  }
  return tarefaIds;
}
