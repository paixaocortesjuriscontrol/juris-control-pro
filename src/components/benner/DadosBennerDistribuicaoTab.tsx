import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { DistribuicaoTst } from "@/hooks/useDistribuicoesTst";
import { DistribuicaoTstForm } from "@/components/distribuicao-tst/DistribuicaoTstForm";

interface Props {
  processoNumero: string;
}

export function DadosBennerDistribuicaoTab({ processoNumero }: Props) {
  const [dados, setDados] = useState<DistribuicaoTst[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    const fetch = async () => {
      if (!processoNumero) { setLoading(false); return; }
      setLoading(true);
      const { data } = await supabase
        .from("distribuicoes_tst" as any)
        .select("*")
        .ilike("processo_numero", `%${processoNumero}%`)
        .order("created_at", { ascending: false });
      const results = (data as any[]) || [];
      setDados(results);
      if (results.length === 1) setSelectedIndex(0);
      setLoading(false);
    };
    fetch();
  }, [processoNumero]);

  const handleSave = async (dado: any, id?: string) => {
    if (id) {
      const { error } = await supabase.from("distribuicoes_tst" as any).update(dado as any).eq("id", id);
      if (error) return false;
    }
    // Refresh
    const { data } = await supabase
      .from("distribuicoes_tst" as any)
      .select("*")
      .ilike("processo_numero", `%${processoNumero}%`)
      .order("created_at", { ascending: false });
    setDados((data as any[]) || []);
    return true;
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  if (!processoNumero) return <p className="text-muted-foreground text-center py-8">Nenhum número de processo informado para buscar distribuições.</p>;

  if (dados.length === 0) return <p className="text-muted-foreground text-center py-8">Nenhuma distribuição encontrada para este processo.</p>;

  if (selectedIndex !== null) {
    return (
      <DistribuicaoTstForm
        dado={dados[selectedIndex]}
        onSave={handleSave}
        onCancel={() => {
          if (dados.length === 1) {
            // Only one, no list to go back to
          } else {
            setSelectedIndex(null);
          }
        }}
      />
    );
  }

  // Multiple results - show list to pick
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{dados.length} distribuições encontradas. Clique para visualizar:</p>
      {dados.map((dist, idx) => (
        <div
          key={dist.id}
          className="border border-border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setSelectedIndex(idx)}
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="font-medium text-foreground">Distribuição #{idx + 1}</span>
              {dist.aba_origem && <span className="ml-2 text-xs text-muted-foreground">({dist.aba_origem})</span>}
            </div>
            <div className="text-sm text-muted-foreground">
              {dist.relator && <span className="mr-4">Relator: {dist.relator}</span>}
              {dist.turma && <span>Turma: {dist.turma}</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
