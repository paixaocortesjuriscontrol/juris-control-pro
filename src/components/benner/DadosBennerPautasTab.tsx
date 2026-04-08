import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface Props {
  processoNumero: string;
}

interface PautaTst {
  id: string;
  processo_numero: string | null;
  dossie: string | null;
  data_julgamento: string | null;
  horario: string | null;
  modalidade: string | null;
  orgao: string | null;
  relator: string | null;
  reclamante: string | null;
  reclamada: string | null;
  parte_recorrente: string | null;
  tipo_recurso: string | null;
  equipe: string | null;
  aparelhamento_banco: string | null;
  aparelhamento_reclamante: string | null;
  chance_exito_banco: string | null;
  chance_exito_reclamante: string | null;
  materia_recurso_banco: string | null;
  materia_recurso_reclamante: string | null;
  honra: string | null;
  midia_negativa: string | null;
  sustentacao_oral: string | null;
  entrega_memoriais: string | null;
  decisao: string | null;
  advogado_interno: string | null;
  comentarios_advogado: string | null;
  desistencia_recurso: string | null;
  resultado_proxima_sessao: string | null;
  retorno_esclarecimentos: string | null;
  solicitacao_providencias_banco: string | null;
  solicitacao_rosa_oliveira: string | null;
  link_acesso: string | null;
  aba_origem: string | null;
  created_at: string;
}

const fieldLabels: Record<string, string> = {
  processo_numero: "Nº Processo",
  dossie: "Dossiê",
  data_julgamento: "Data Julgamento",
  horario: "Horário",
  modalidade: "Modalidade",
  orgao: "Órgão",
  relator: "Relator",
  reclamante: "Reclamante",
  reclamada: "Reclamada",
  parte_recorrente: "Parte Recorrente",
  tipo_recurso: "Tipo Recurso",
  equipe: "Equipe",
  aparelhamento_banco: "Aparelhamento (Banco)",
  aparelhamento_reclamante: "Aparelhamento (Reclamante)",
  chance_exito_banco: "Chance Êxito (Banco)",
  chance_exito_reclamante: "Chance Êxito (Reclamante)",
  materia_recurso_banco: "Matéria Recurso (Banco)",
  materia_recurso_reclamante: "Matéria Recurso (Reclamante)",
  honra: "Honra",
  midia_negativa: "Mídia Negativa",
  sustentacao_oral: "Sustentação Oral",
  entrega_memoriais: "Entrega Memoriais",
  decisao: "Decisão",
  advogado_interno: "Advogado Interno",
  comentarios_advogado: "Comentários Advogado",
  desistencia_recurso: "Desistência Recurso",
  resultado_proxima_sessao: "Resultado Próxima Sessão",
  retorno_esclarecimentos: "Retorno Esclarecimentos",
  solicitacao_providencias_banco: "Solicitação Providências Banco",
  solicitacao_rosa_oliveira: "Solicitação Rosa Oliveira",
  link_acesso: "Link Acesso",
  aba_origem: "Aba Origem",
};

const displayFields = Object.keys(fieldLabels);

export function DadosBennerPautasTab({ processoNumero }: Props) {
  const [dados, setDados] = useState<PautaTst[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      if (!processoNumero) { setLoading(false); return; }
      setLoading(true);
      const { data } = await supabase
        .from("pautas_tst" as any)
        .select("*")
        .ilike("processo_numero", `%${processoNumero}%`)
        .order("data_julgamento", { ascending: false, nullsFirst: false });
      setDados((data as any[]) || []);
      setLoading(false);
    };
    fetch();
  }, [processoNumero]);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  if (!processoNumero) return <p className="text-muted-foreground text-center py-8">Nenhum número de processo informado para buscar pautas.</p>;

  if (dados.length === 0) return <p className="text-muted-foreground text-center py-8">Nenhuma pauta encontrada para este processo.</p>;

  return (
    <div className="space-y-6">
      {dados.map((pauta, idx) => (
        <div key={pauta.id} className="border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground">Pauta {dados.length > 1 ? `#${idx + 1}` : ""}</h3>
            {pauta.aba_origem && <Badge variant="outline">{pauta.aba_origem}</Badge>}
            {pauta.data_julgamento && (
              <Badge variant="secondary">
                {(() => { try { return format(new Date(pauta.data_julgamento), "dd/MM/yyyy"); } catch { return pauta.data_julgamento; } })()}
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {displayFields.map(field => {
              const value = (pauta as any)[field];
              if (value === null || value === undefined || value === "") return null;
              let display: string;
              if (field === "data_julgamento" && value) {
                try { display = format(new Date(value), "dd/MM/yyyy"); } catch { display = value; }
              } else if (field === "link_acesso" && value) {
                display = value;
              } else display = String(value);

              return (
                <div key={field} className="space-y-0.5">
                  <p className="text-xs text-muted-foreground">{fieldLabels[field]}</p>
                  {field === "link_acesso" && value ? (
                    <a href={value} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">{value}</a>
                  ) : (
                    <p className="text-sm text-foreground">{display}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
