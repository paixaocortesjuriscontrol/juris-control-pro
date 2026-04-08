import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface Props {
  processoNumero: string;
}

interface DistribuicaoTst {
  id: string;
  processo_numero: string;
  dossie: string | null;
  data_distribuicao: string | null;
  relator: string | null;
  turma: string | null;
  equipe: string | null;
  reclamante: string | null;
  reclamada: string | null;
  parte_recorrente: string | null;
  tipo_recurso_banco: string | null;
  tipo_recurso_reclamante: string | null;
  aparelhamento_banco: string | null;
  aparelhamento_reclamante: string | null;
  chance_exito_banco: string | null;
  chance_exito_reclamante: string | null;
  materias_recurso_banco: string | null;
  materias_recurso_reclamante: string | null;
  relator_favorabilidade: string | null;
  turma_favorabilidade: string | null;
  decisao_quarteirizado: string | null;
  honra: string | null;
  midia_negativa: string | null;
  execucao: string | null;
  recurso_terceiros: string | null;
  tema: string | null;
  transito_julgado: boolean | null;
  benner_atualizado: boolean | null;
  aba_origem: string | null;
  created_at: string;
}

const fieldLabels: Record<string, string> = {
  processo_numero: "Nº Processo",
  dossie: "Dossiê",
  data_distribuicao: "Data Distribuição",
  relator: "Relator",
  turma: "Turma",
  equipe: "Equipe",
  reclamante: "Reclamante",
  reclamada: "Reclamada",
  parte_recorrente: "Parte Recorrente",
  tipo_recurso_banco: "Tipo Recurso (Banco)",
  tipo_recurso_reclamante: "Tipo Recurso (Reclamante)",
  aparelhamento_banco: "Aparelhamento (Banco)",
  aparelhamento_reclamante: "Aparelhamento (Reclamante)",
  chance_exito_banco: "Chance Êxito (Banco)",
  chance_exito_reclamante: "Chance Êxito (Reclamante)",
  materias_recurso_banco: "Matérias Recurso (Banco)",
  materias_recurso_reclamante: "Matérias Recurso (Reclamante)",
  relator_favorabilidade: "Favorabilidade Relator",
  turma_favorabilidade: "Favorabilidade Turma",
  decisao_quarteirizado: "Decisão Quarteirizado",
  honra: "Honra",
  midia_negativa: "Mídia Negativa",
  execucao: "Execução",
  recurso_terceiros: "Recurso Terceiros",
  tema: "Tema",
  transito_julgado: "Trânsito em Julgado",
  benner_atualizado: "Benner Atualizado",
  aba_origem: "Aba Origem",
};

const displayFields = Object.keys(fieldLabels);

export function DadosBennerDistribuicaoTab({ processoNumero }: Props) {
  const [dados, setDados] = useState<DistribuicaoTst[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      if (!processoNumero) { setLoading(false); return; }
      setLoading(true);
      const { data } = await supabase
        .from("distribuicoes_tst" as any)
        .select("*")
        .ilike("processo_numero", `%${processoNumero}%`)
        .order("created_at", { ascending: false });
      setDados((data as any[]) || []);
      setLoading(false);
    };
    fetch();
  }, [processoNumero]);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  if (!processoNumero) return <p className="text-muted-foreground text-center py-8">Nenhum número de processo informado para buscar distribuições.</p>;

  if (dados.length === 0) return <p className="text-muted-foreground text-center py-8">Nenhuma distribuição encontrada para este processo.</p>;

  return (
    <div className="space-y-6">
      {dados.map((dist, idx) => (
        <div key={dist.id} className="border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground">Distribuição {dados.length > 1 ? `#${idx + 1}` : ""}</h3>
            {dist.aba_origem && <Badge variant="outline">{dist.aba_origem}</Badge>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {displayFields.map(field => {
              const value = (dist as any)[field];
              if (value === null || value === undefined || value === "") return null;
              let display: string;
              if (typeof value === "boolean") display = value ? "Sim" : "Não";
              else if (field === "data_distribuicao" && value) {
                try { display = format(new Date(value), "dd/MM/yyyy"); } catch { display = value; }
              } else display = String(value);

              return (
                <div key={field} className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">{fieldLabels[field]}</p>
                  <p className="text-sm text-foreground">{display}</p>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
