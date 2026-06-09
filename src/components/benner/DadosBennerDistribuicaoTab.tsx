import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { DistribuicaoTst, distribuicaoToBenner } from "@/hooks/useDistribuicoesTst";
import { DistribuicaoTstForm } from "@/components/distribuicao-tst/DistribuicaoTstForm";

interface Props {
  processoNumero: string;
}

function bennerRowToDist(b: any): DistribuicaoTst {
  return {
    id: b.id,
    processo_id: "",
    processo_numero: b.processo || "",
    aba_origem: b.aba_origem ?? null,
    data_distribuicao_planilha: b.data_distribuicao_planilha ?? b.data_distribuicao ?? null,
    data_distribuicao_real: b.data_distribuicao_real ?? null,
    coordenacao_id: b.coordenacao_id ?? null,
    dossie: b.dossie ?? null,
    equipe: b.equipe ?? null,
    reclamante: b.reclamante ?? null,
    reclamada: b.reclamada ?? null,
    relator: b.relator ?? null,
    relator_favorabilidade: b.posicao_relator_favoravel ? "POSITIVO" : b.posicao_relator_desfavoravel ? "NEGATIVO" : null,
    turma: b.turma ?? null,
    turma_favorabilidade: b.posicao_turma_favoravel ? "POSITIVA" : b.posicao_turma_desfavoravel ? "NEGATIVA" : null,
    parte_recorrente: b.recorrente ?? null,
    tipo_recurso_reclamante: b.tipo_recurso_reclamante ?? null,
    materias_recurso_reclamante: b.materias_recurso_reclamante ?? null,
    aparelhamento_reclamante: b.aparelhamento_reclamante ?? null,
    chance_exito_reclamante: b.chance_exito_reclamante ?? null,
    tipo_recurso_banco: b.tipo_recurso_banco ?? null,
    materias_recurso_banco: b.materias_recurso_banco ?? null,
    aparelhamento_banco: b.aparelhamento_banco ?? null,
    chance_exito_banco: b.chance_exito_banco ?? null,
    tipo_recurso_terceiro: b.tipo_recurso_terceiro ?? null,
    materias_recurso_terceiro: b.materias_recurso_terceiro ?? null,
    aparelhamento_terceiro: b.aparelhamento_terceiro ?? null,
    chance_exito_terceiro: b.chance_exito_terceiro ?? null,
    tipo_recurso: b.tipo_recurso ?? null,
    honra: b.honra ?? null,
    tema: b.tema ?? null,
    execucao: b.execucao ?? null,
    midia_negativa: b.midia_negativa ?? null,
    decisao_quarteirizado: b.decisao_quarteirizado ?? null,
    recurso_terceiros: b.recurso_terceiros ?? null,
    transito_julgado: b.transito_julgado ?? null,
    benner_atualizado: b.benner_atualizado ?? null,
    judit_preenchido: !!b.judit_preenchido,
    judit_preenchido_em: b.judit_preenchido_em ?? null,
    judit_preenchido_por: b.judit_preenchido_por ?? null,
    created_at: b.created_at,
    updated_at: b.updated_at,
  };
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
        .from("dados_benner" as any)
        .select("*")
        .ilike("processo", `%${processoNumero}%`)
        .not("aba_origem", "is", null)
        .order("created_at", { ascending: false });
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
      if (processo) {
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
