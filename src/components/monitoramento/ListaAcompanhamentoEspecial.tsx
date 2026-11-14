import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const POR_PAGINA = 100;

/** Lista os processos em Acompanhamento Especial que o usuário pode ver, por coordenação. */
export function ListaAcompanhamentoEspecial() {
  const [coord, setCoord] = useState("todas");
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(0);

  const { data: coords = [] } = useQuery({
    queryKey: ["acomp-esp-coordenacoes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("coordenacoes").select("id, nome").order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["acomp-esp-lista", coord, busca, pagina],
    queryFn: async () => {
      let q = supabase
        .from("processos")
        .select("id, numero, polo_ativo, polo_passivo, tribunal, coordenacao_id, coordenacao:coordenacoes(nome)", { count: "exact" })
        .eq("acompanhamento_especial", true)
        .order("numero")
        .range(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA - 1);
      if (coord !== "todas") q = q.eq("coordenacao_id", coord);
      const t = busca.trim();
      if (t) q = q.or(`numero.ilike.%${t}%,polo_ativo.ilike.%${t}%,polo_passivo.ilike.%${t}%`);
      const { data, error, count } = await q;
      if (error) throw error;
      return { linhas: (data || []) as any[], total: count ?? 0 };
    },
  });

  const total = data?.total ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <div className="flex flex-col">
      <div className="px-4 md:px-6 py-3 border-b border-border bg-card flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(0); }} placeholder="Buscar por número do processo ou parte…" className="pl-8 h-9" />
        </div>
        <Select value={coord} onValueChange={(v) => { setCoord(v); setPagina(0); }}>
          <SelectTrigger className="h-9 w-[260px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as coordenações</SelectItem>
            {coords.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{total.toLocaleString("pt-BR")} processo(s) em acompanhamento especial</span>
      </div>
      {isLoading ? (
        <div className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Processo</TableHead>
              <TableHead>Partes</TableHead>
              <TableHead>Tribunal</TableHead>
              <TableHead>Coordenação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.linhas ?? []).map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs"><Link className="text-primary hover:underline" to={`/processos/${p.id}`}>{p.numero}</Link></TableCell>
                <TableCell className="text-xs">{[p.polo_ativo, p.polo_passivo].filter(Boolean).join(" × ") || "—"}</TableCell>
                <TableCell className="text-xs">{p.tribunal || "—"}</TableCell>
                <TableCell className="text-xs">{p.coordenacao?.nome || "—"}</TableCell>
              </TableRow>
            ))}
            {!data?.linhas.length && (
              <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">Nenhum processo encontrado.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      )}
      {paginas > 1 && (
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t">
          <Button size="sm" variant="outline" disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>Anterior</Button>
          <span className="text-xs">Página {pagina + 1} de {paginas}</span>
          <Button size="sm" variant="outline" disabled={pagina + 1 >= paginas} onClick={() => setPagina(pagina + 1)}>Próxima</Button>
        </div>
      )}
    </div>
  );
}
