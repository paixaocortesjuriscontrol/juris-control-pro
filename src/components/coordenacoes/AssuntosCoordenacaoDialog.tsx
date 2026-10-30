import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "@/hooks/use-toast";
import { FileSpreadsheet, Loader2, Plus, X } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coordenacaoId: string;
  coordenacaoNome?: string;
}

export function AssuntosCoordenacaoDialog({ open, onOpenChange, coordenacaoId, coordenacaoNome }: Props) {
  const qc = useQueryClient();
  const [novo, setNovo] = useState("");
  const [busca, setBusca] = useState("");
  const [salvando, setSalvando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const key = ["assuntos-coordenacao", coordenacaoId];

  const { data: assuntos = [], isLoading } = useQuery({
    queryKey: key,
    enabled: open && !!coordenacaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assuntos_coordenacao" as any)
        .select("id, nome")
        .eq("coordenacao_id", coordenacaoId)
        .order("nome");
      if (error) throw error;
      return (data || []) as unknown as { id: string; nome: string }[];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["assuntos-coordenacao"] });

  const inserir = async (nomes: string[]) => {
    const existentes = new Set(assuntos.map((a) => a.nome.trim().toUpperCase()));
    const vistos = new Set<string>();
    const linhas = nomes
      .map((n) => n.trim())
      .filter((n) => {
        const k = n.toUpperCase();
        if (!n || existentes.has(k) || vistos.has(k)) return false;
        vistos.add(k);
        return true;
      })
      .map((nome) => ({ coordenacao_id: coordenacaoId, nome }));
    if (!linhas.length) {
      toast({ title: "Nada novo para incluir" });
      return;
    }
    setSalvando(true);
    try {
      for (let i = 0; i < linhas.length; i += 200) {
        const { data, error } = await supabase.from("assuntos_coordenacao" as any).insert(linhas.slice(i, i + 200)).select("id");
        if (error) throw error;
        if (!data?.length) throw new Error("Sem permissão para alterar os assuntos desta coordenação.");
      }
      await refresh();
      toast({ title: `${linhas.length} assunto(s) incluído(s)` });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (id: string) => {
    const { data, error } = await supabase.from("assuntos_coordenacao" as any).delete().eq("id", id).select("id");
    if (error || !data?.length) {
      toast({ title: "Não foi possível excluir", description: error?.message || "Sem permissão.", variant: "destructive" });
      return;
    }
    await refresh();
  };

  const importar = async (file: File) => {
    const wb = XLSX.read(await file.arrayBuffer());
    const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
    const nomes = rows.slice(1).map((r) => String(r[0] ?? "")).filter(Boolean);
    await inserir(nomes);
  };

  const filtrados = assuntos.filter((a) => a.nome.toLowerCase().includes(busca.toLowerCase()));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Assuntos (objeto da ação)</DialogTitle>
          <DialogDescription>{coordenacaoNome} — {assuntos.length} assunto(s)</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input
            placeholder="Novo assunto e Enter"
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === "Enter" && novo.trim()) {
                await inserir([novo]);
                setNovo("");
              }
            }}
          />
          <Button disabled={!novo.trim() || salvando} onClick={async () => { await inserir([novo]); setNovo(""); }}>
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </Button>
          <Button variant="outline" disabled={salvando} onClick={() => fileRef.current?.click()} title="Importar planilha (1ª coluna)">
            <FileSpreadsheet className="w-4 h-4 mr-1" /> Planilha
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importar(f);
              e.target.value = "";
            }}
          />
        </div>
        <Input placeholder="Buscar..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        <ScrollArea className="h-[400px] border rounded-md">
          {isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">Carregando...</div>
          ) : filtrados.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">Nenhum assunto.</div>
          ) : (
            filtrados.map((a) => (
              <div key={a.id} className="group flex items-center justify-between px-3 py-1.5 text-sm border-b last:border-0">
                <span>{a.nome}</span>
                <button className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive" onClick={() => remover(a.id)}>
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
