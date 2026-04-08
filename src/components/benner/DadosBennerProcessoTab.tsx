import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ProcessoDetalhesCompletos } from "@/components/processos/ProcessoDetalhesCompletos";

interface Props {
  processoNumero: string;
}

export function DadosBennerProcessoTab({ processoNumero }: Props) {
  const navigate = useNavigate();
  const [selectedTarefaId, setSelectedTarefaId] = useState<string | null>(null);

  // Find processo by number
  const { data: processo, isLoading: loadingProcesso } = useQuery({
    queryKey: ["processo-by-numero-benner", processoNumero],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos")
        .select(`
          *,
          advogado_responsavel:profiles!processos_advogado_responsavel_id_fkey(id, nome, email),
          cliente:clientes!processos_cliente_id_fkey(id, nome, tipo, cpf_cnpj, email, telefone),
          pasta:pastas!processos_pasta_id_fkey(id, nome)
        `)
        .eq("numero", processoNumero)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!processoNumero,
  });

  const processoId = processo?.id;

  // Responsáveis
  const { data: responsaveisProcesso = [] } = useQuery({
    queryKey: ["processo-responsaveis-benner", processoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos_responsaveis")
        .select(`*, usuario:profiles!processos_responsaveis_usuario_id_fkey(id, nome)`)
        .eq("processo_id", processoId!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!processoId,
  });

  // Movimentações
  const { data: movimentacoes = [] } = useQuery({
    queryKey: ["movimentacoes-processo-benner", processoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movimentacoes")
        .select("*")
        .eq("processo_id", processoId!)
        .order("data_movimentacao", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!processoId,
  });

  // Documentos
  const { data: documentos = [] } = useQuery({
    queryKey: ["documentos-processo-benner", processoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documentos")
        .select("*")
        .eq("processo_id", processoId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!processoId,
  });

  // Tarefas
  const { data: tarefas = [], isLoading: loadingTarefas } = useQuery({
    queryKey: ["tarefas-processo-benner", processoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tarefas")
        .select(`*, responsavel:profiles!tarefas_responsavel_id_fkey(id, nome)`)
        .eq("processo_id", processoId!)
        .order("data_vencimento", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!processoId,
  });

  // Audiências
  const { data: audiencias = [], isLoading: loadingAudiencias } = useQuery({
    queryKey: ["audiencias-processo-benner", processoId, processoNumero],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audiencias_detectadas")
        .select("*")
        .or(`processo_id.eq.${processoId},processo_numero.eq.${processoNumero}`)
        .order("data_audiencia", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!processoId,
  });

  // Intimações
  const { data: intimacoes = [], isLoading: loadingIntimacoes } = useQuery({
    queryKey: ["intimacoes-processo-benner", processoId, processoNumero],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("intimacoes_detectadas")
        .select("*")
        .or(`processo_id.eq.${processoId},processo_numero.eq.${processoNumero}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!processoId,
  });

  const responsaveisParaCards = responsaveisProcesso.map((rp: any) => ({
    id: rp.usuario?.id || rp.usuario_id,
    nome: rp.usuario?.nome || "Sem nome",
    papel: rp.papel || "Membro",
  }));

  const redistribuicoes = movimentacoes.filter(
    (m: any) => m.descricao?.toLowerCase().includes("redistribui")
  );

  if (loadingProcesso) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!processoNumero) {
    return (
      <p className="text-muted-foreground text-center py-8">
        Nenhum número de processo informado.
      </p>
    );
  }

  if (!processo) {
    return (
      <div className="text-center py-8 space-y-3">
        <p className="text-muted-foreground">
          Processo <strong>{processoNumero}</strong> não encontrado na base de Processos Internos.
        </p>
        <p className="text-sm text-muted-foreground">
          Este processo ainda não foi cadastrado no sistema.
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex justify-end mb-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/processos/${processo.id}`)}
        >
          <ExternalLink className="w-4 h-4 mr-1" />
          Abrir em Processos Internos
        </Button>
      </div>
      <ProcessoDetalhesCompletos
        processo={processo}
        responsaveis={responsaveisParaCards}
        movimentacoes={movimentacoes}
        documentos={documentos}
        tarefas={tarefas}
        audiencias={audiencias}
        intimacoes={intimacoes}
        publicacoesDjen={[]}
        redistribuicoes={redistribuicoes}
        alertas360={[]}
        eventosAgenda={[]}
        loadingAudiencias={loadingAudiencias}
        loadingIntimacoes={loadingIntimacoes}
        loadingPublicacoes={false}
        loadingTarefas={loadingTarefas}
        selectedTarefaId={selectedTarefaId}
        onVoltar={() => {}}
        onEditar={() => navigate(`/processos/${processo.id}`)}
        onSelectTarefa={(id) => setSelectedTarefaId(id)}
        onVoltarTarefa={() => setSelectedTarefaId(null)}
      />
    </div>
  );
}
