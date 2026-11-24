import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface PublicacaoTst {
  id: string;
  data_publicacao: string | null;
  data_disponibilizacao: string | null;
  tribunal: string | null;
  tipo_comunicacao: string | null;
  orgao: string | null;
  conteudo: string | null;
  dedup_conteudo_key: string | null;
  id_djen: string | null;
}

const fmt = (d: string | null) => {
  if (!d) return "—";
  const m = d.slice(0, 10).split("-");
  return m.length === 3 ? `${m[2]}/${m[1]}/${m[0]}` : d;
};

/** Remove cópias do mesmo aviso (mesmo id do DJEN ou mesma chave de conteúdo). */
export function deduplicarPublicacoesTst(lista: PublicacaoTst[]): PublicacaoTst[] {
  const vistos = new Set<string>();
  const out: PublicacaoTst[] = [];
  for (const p of lista) {
    const chave = p.id_djen ? `djen:${p.id_djen}` : p.dedup_conteudo_key ? `c:${p.dedup_conteudo_key}` : `id:${p.id}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    out.push(p);
  }
  return out;
}

export function usePublicacoesProcessoTst(processoNumero: string | null | undefined) {
  const digitos = (processoNumero || "").replace(/\D/g, "");
  return useQuery({
    queryKey: ["publicacoes-processo-tst", digitos],
    enabled: digitos.length >= 15,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("publicacoes_djen")
        .select("id,data_publicacao,data_disponibilizacao,tribunal,tipo_comunicacao,orgao,conteudo,dedup_conteudo_key,id_djen")
        .eq("dedup_processo_digits", digitos)
        .order("data_disponibilizacao", { ascending: false, nullsFirst: false })
        .limit(200);
      if (error) throw error;
      return deduplicarPublicacoesTst((data || []) as PublicacaoTst[]);
    },
  });
}

function ItemPublicacao({ p }: { p: PublicacaoTst }) {
  const [aberto, setAberto] = useState(false);
  const texto = (p.conteudo || "").trim();
  return (
    <div className="rounded-md border bg-card p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold">Disponibilização: {fmt(p.data_disponibilizacao)}</span>
        <span className="text-muted-foreground">Publicação: {fmt(p.data_publicacao)}</span>
        {p.tribunal && <Badge variant="secondary">{p.tribunal}</Badge>}
        {p.tipo_comunicacao && <Badge variant="outline">{p.tipo_comunicacao}</Badge>}
      </div>
      {p.orgao && <div className="text-xs text-muted-foreground">{p.orgao}</div>}
      <p className={`text-sm whitespace-pre-wrap ${aberto ? "" : "line-clamp-4"}`}>{texto || "Sem texto."}</p>
      {texto.length > 300 && (
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setAberto((v) => !v)}>
          {aberto ? <><ChevronUp className="mr-1 h-3.5 w-3.5" /> Mostrar menos</> : <><ChevronDown className="mr-1 h-3.5 w-3.5" /> Ver texto completo</>}
        </Button>
      )}
    </div>
  );
}

export function PublicacoesProcessoTst({ processoNumero }: { processoNumero: string | null | undefined }) {
  const { data = [], isLoading, error } = usePublicacoesProcessoTst(processoNumero);
  if (isLoading) return <div className="flex items-center gap-2 text-sm text-muted-foreground p-3"><Loader2 className="h-4 w-4 animate-spin" /> Carregando publicações...</div>;
  if (error) return <div className="text-sm text-destructive p-3">Não foi possível carregar as publicações.</div>;
  if (data.length === 0) return <div className="text-sm text-muted-foreground p-3">Nenhuma publicação encontrada para este processo.</div>;
  return <div className="space-y-2">{data.map((p) => <ItemPublicacao key={p.id} p={p} />)}</div>;
}
