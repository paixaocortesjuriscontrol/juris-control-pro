import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { PautaTst } from "@/hooks/usePautasTst";
import { PautasTstForm } from "@/components/pautas-tst/PautasTstForm";

interface Props {
  processoNumero: string;
}

export function DadosBennerPautasTab({ processoNumero }: Props) {
  const [dados, setDados] = useState<PautaTst[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    const fetch = async () => {
      if (!processoNumero) { setLoading(false); return; }
      setLoading(true);
      const { data } = await supabase
        .from("pautas_tst" as any)
        .select("*")
        .ilike("processo_numero", `%${processoNumero}%`)
        .order("data_julgamento", { ascending: false, nullsFirst: false });
      const results = (data as any[]) || [];
      setDados(results);
      if (results.length === 1) setSelectedIndex(0);
      setLoading(false);
    };
    fetch();
  }, [processoNumero]);

  const handleSave = async (dado: any, id?: string) => {
    if (id) {
      const { error } = await supabase.from("pautas_tst" as any).update(dado as any).eq("id", id);
      if (error) return false;
    }
    const { data } = await supabase
      .from("pautas_tst" as any)
      .select("*")
      .ilike("processo_numero", `%${processoNumero}%`)
      .order("data_julgamento", { ascending: false, nullsFirst: false });
    setDados((data as any[]) || []);
    return true;
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;

  if (!processoNumero) return <p className="text-muted-foreground text-center py-8">Nenhum número de processo informado para buscar pautas.</p>;

  if (dados.length === 0) return <p className="text-muted-foreground text-center py-8">Nenhuma pauta encontrada para este processo.</p>;

  if (selectedIndex !== null) {
    return (
      <PautasTstForm
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

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{dados.length} pautas encontradas. Clique para visualizar:</p>
      {dados.map((pauta, idx) => (
        <div
          key={pauta.id}
          className="border border-border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setSelectedIndex(idx)}
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="font-medium text-foreground">Pauta #{idx + 1}</span>
              {pauta.aba_origem && <span className="ml-2 text-xs text-muted-foreground">({pauta.aba_origem})</span>}
            </div>
            <div className="text-sm text-muted-foreground">
              {pauta.data_julgamento && <span className="mr-4">Julgamento: {pauta.data_julgamento}</span>}
              {pauta.relator && <span>Relator: {pauta.relator}</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
