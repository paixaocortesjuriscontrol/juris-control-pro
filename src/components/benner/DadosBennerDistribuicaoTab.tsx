import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { DistribuicaoTst, distribuicaoToBenner, bennerToDistribuicao } from "@/hooks/useDistribuicoesTst";
import { DistribuicaoTstForm } from "@/components/distribuicao-tst/DistribuicaoTstForm";

interface Props {
  processoNumero: string;
}

const bennerRowToDist = (b: any): DistribuicaoTst => bennerToDistribuicao(b);

export function DadosBennerDistribuicaoTab({ processoNumero }: Props) {
  const [dados, setDados] = useState<DistribuicaoTst[]>([]);
  const [raws, setRaws] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    const fetch = async () => {
      if (!processoNumero) { setLoading(false); return; }
      setLoading(true);
      const { data } = await supabase
        .from("dados_benner" as any)
        .select("*")
        .ilike("processo", `%${processoNumero}%`)
        .not("aba_origem", "is", null)
        .order("created_at", { ascending: false });
      setRaws((data as any[]) || []);
      const results = ((data as any[]) || []).map(bennerRowToDist);
      setDados(results);
      if (results.length === 1) setSelectedIndex(0);
      setLoading(false);
    };
    fetch();
  }, [processoNumero]);

  const handleSave = async (dado: any, id?: string) => {
    if (id) {
      const payload = distribuicaoToBenner(dado);
      const processo = String((payload as any).processo || "").trim();
      const dossie = String((payload as any).dossie || "").trim();
      const { data: updatedById, error: idError } = await supabase
        .from("dados_benner" as any)
        .update(payload as any)
        .eq("id", id)
        .select("id");
      if (idError) return false;
      if ((!updatedById || (updatedById as any[]).length === 0) && processo) {
        // UPDATE pelo par (processo, dossie) — só atinge linhas ativas em
        // dados_benner (arquivados ficam em tabela separada).
        let upd: any = supabase.from("dados_benner" as any).update(payload as any).eq("processo", processo);
        upd = dossie ? upd.eq("dossie", dossie) : upd.or("dossie.is.null,dossie.eq.");
        const { data: updated, error } = await upd.select("id");
        if (error) return false;
        if (!updated || (updated as any[]).length === 0) return false;
      }
    }
    const { data } = await supabase
      .from("dados_benner" as any)
      .select("*")
      .ilike("processo", `%${processoNumero}%`)
      .not("aba_origem", "is", null)
      .order("created_at", { ascending: false });
    setRaws((data as any[]) || []);
    setDados(((data as any[]) || []).map(bennerRowToDist));
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
        bennerDado={raws.find((r) => r.id === dados[selectedIndex]?.id) || null}
        onSaveBennerExtra={async (patch: any, id?: string) => {
          const targetId = id || dados[selectedIndex]?.id;
          if (!targetId) return false;
          const { data: upd, error } = await supabase
            .from("dados_benner" as any)
            .update(patch)
            .eq("id", targetId)
            .select("*");
          if (error || !upd || (upd as any[]).length === 0) return false;
          const row = (upd as any[])[0];
          setRaws((prev) => prev.map((r) => (r.id === row.id ? row : r)));
          return true;
        }}
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
