import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/** Campos vindos dos relatórios do cliente (GOL Operação, Webjet, Sucessão). Edição inline. */
const ROTULOS: Record<string, string> = {
  tipo_de_demanda: "Tipo de demanda", numero_provisoria: "Número provisório", numero_processo_coletivo: "Processo coletivo",
  e_tecnico: "É técnico", populacao: "População", classificacao_aerotech: "Classificação Aerotech", populacao_aj: "População AJ",
  outras_empresas_terceiras: "Outras empresas terceiras", advogado_parte: "Advogado da parte", oab_advogado_parte: "OAB do advogado da parte",
  periculosidade: "Periculosidade", pendente_tst: "Pendente no TST", acordo_sim_ou_nao: "Acordo", data_do_acordo: "Data do acordo",
  data_admissao: "Data de admissão", data_transito_julgado: "Data do trânsito em julgado", data_ultima_atualizacao: "Data da última atualização",
  escritorio: "Escritório", observacoes: "Observações", caso_abra: "Caso ABRA",
};
const rotulo = (k: string) =>
  ROTULOS[k] ||
  (k.charAt(0).toUpperCase() + k.slice(1).toLowerCase()).replace(/_/g, " ");
const exibir = (v: any) => {
  if (v == null) return "";
  const s = String(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
};

function Campo({ chave, valor, onSalvar }: { chave: string; valor: any; onSalvar: (k: string, v: string) => Promise<void> }) {
  const [v, setV] = useState(exibir(valor));
  useEffect(() => setV(exibir(valor)), [valor]);
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{rotulo(chave)}</label>
      <Input
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => { if (v !== exibir(valor)) onSalvar(chave, v); }}
        className="h-8 text-sm"
      />
    </div>
  );
}

export function RelatorioClienteTab({ processoId }: { processoId: string }) {
  const qc = useQueryClient();
  const [novo, setNovo] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["processo-relatorio-cliente", processoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos")
        .select("dados_relatorio_cliente, relatorio_origem")
        .eq("id", processoId)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  const dados: Record<string, any> = data?.dados_relatorio_cliente || {};

  const salvar = async (k: string, v: string) => {
    const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    const val = m ? `${m[3]}-${m[2]}-${m[1]}` : v.trim();
    const novos = { ...dados };
    if (val === "") delete novos[k]; else novos[k] = val;
    const { data: upd, error } = await supabase
      .from("processos")
      .update({ dados_relatorio_cliente: novos } as any)
      .eq("id", processoId)
      .select("id");
    if (error || !upd?.length) { toast.error(error?.message || "Sem permissão para alterar"); return; }
    await qc.invalidateQueries({ queryKey: ["processo-relatorio-cliente", processoId] });
    toast.success("Salvo");
  };

  if (isLoading) return <Loader2 className="w-4 h-4 animate-spin" />;
  const chaves = Object.keys(dados).sort((a, b) => rotulo(a).localeCompare(rotulo(b)));

  return (
    <div className="space-y-4">
      {data?.relatorio_origem && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Relatório de origem:</span>
          {String(data.relatorio_origem).split(" | ").map((o: string) => <Badge key={o} variant="secondary">{o}</Badge>)}
        </div>
      )}
      {chaves.length === 0 && <p className="text-sm text-muted-foreground">Nenhum dado de relatório do cliente para este processo.</p>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {chaves.map((k) => <Campo key={k} chave={k} valor={dados[k]} onSalvar={salvar} />)}
      </div>
      <div className="flex gap-2 max-w-md">
        <Input placeholder="Novo campo (ex.: tese)" value={novo} onChange={(e) => setNovo(e.target.value)} className="h-8 text-sm" />
        <Button size="sm" variant="outline" disabled={!novo.trim()} onClick={async () => { await salvar(novo.trim(), "-"); setNovo(""); }}>
          <Plus className="w-4 h-4 mr-1" /> Adicionar
        </Button>
      </div>
    </div>
  );
}
