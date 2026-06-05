import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, RotateCcw, Trash2, Search, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Arquivado {
  id: string;
  dados_benner_id: string;
  processo: string | null;
  dossie: string | null;
  aba_origem: string | null;
  coordenacao_id: string | null;
  arquivado_em: string;
  arquivado_por: string | null;
  motivo: string | null;
}

export default function DistribuicaoTstArquivados() {
  const [dados, setDados] = useState<Arquivado[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [acao, setAcao] = useState<{ tipo: "restaurar" | "excluir"; id: string } | null>(null);
  const [processing, setProcessing] = useState(false);

  const fetchDados = async () => {
    setLoading(true);
    let query = supabase
      .from("dados_benner_arquivados" as any)
      .select("*")
      .order("arquivado_em", { ascending: false })
      .limit(500);
    if (busca.trim()) {
      const b = busca.trim();
      query = query.or(`processo.ilike.%${b}%,dossie.ilike.%${b}%`);
    }
    const { data, error } = await query;
    if (error) toast.error("Erro ao carregar: " + error.message);
    else setDados((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchDados(); /* eslint-disable-next-line */ }, []);

  const handleRestaurar = async (id: string) => {
    setProcessing(true);
    const { error } = await supabase.rpc("restaurar_dados_benner_arquivado" as any, { _id: id });
    setProcessing(false);
    setAcao(null);
    if (error) { toast.error("Erro ao restaurar: " + error.message); return; }
    toast.success("Registro restaurado para a Distribuição TST!");
    fetchDados();
  };

  const handleExcluirDef = async (id: string) => {
    setProcessing(true);
    const { error } = await supabase.from("dados_benner_arquivados" as any).delete().eq("id", id);
    setProcessing(false);
    setAcao(null);
    if (error) { toast.error("Erro ao excluir definitivamente: " + error.message); return; }
    toast.success("Registro excluído definitivamente.");
    fetchDados();
  };

  const fmt = (d: string) => { try { return new Date(d).toLocaleString("pt-BR"); } catch { return d; } };

  return (
    <MainLayout title="Distribuição TST — Arquivados">
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Distribuições Arquivadas</h1>
            <p className="text-sm text-muted-foreground">Apenas administradores podem consultar e restaurar registros arquivados.</p>
          </div>
          <div className="flex gap-2">
            <Link to="/distribuicao-tst">
              <Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" /> Voltar</Button>
            </Link>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por processo ou dossiê..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchDados()}
              className="pl-8"
            />
          </div>
          <Button variant="outline" onClick={fetchDados}>Buscar</Button>
        </div>

        <div className="border border-border rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Arquivado em</TableHead>
                <TableHead>Processo</TableHead>
                <TableHead>Dossiê</TableHead>
                <TableHead>Aba</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead className="w-44 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : dados.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum registro arquivado.</TableCell></TableRow>
              ) : dados.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="text-sm whitespace-nowrap">{fmt(d.arquivado_em)}</TableCell>
                  <TableCell className="font-mono text-xs">{d.processo || "—"}</TableCell>
                  <TableCell className="text-sm">{d.dossie || "—"}</TableCell>
                  <TableCell>{d.aba_origem ? <Badge variant="outline" className="text-xs">{d.aba_origem}</Badge> : "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{d.motivo || "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => setAcao({ tipo: "restaurar", id: d.id })} title="Restaurar">
                        <RotateCcw className="w-4 h-4 mr-1 text-emerald-600" /> Restaurar
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setAcao({ tipo: "excluir", id: d.id })} title="Excluir definitivamente">
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <AlertDialog open={!!acao} onOpenChange={(o) => { if (!o) setAcao(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {acao?.tipo === "restaurar" ? "Restaurar registro?" : "Excluir definitivamente?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {acao?.tipo === "restaurar"
                ? "O registro voltará a aparecer na Distribuição TST com os mesmos dados que tinha antes de ser arquivado."
                : "Esta ação é irreversível: o registro será removido permanentemente dos arquivados."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={processing}
              onClick={() => {
                if (!acao) return;
                if (acao.tipo === "restaurar") handleRestaurar(acao.id);
                else handleExcluirDef(acao.id);
              }}
              className={acao?.tipo === "restaurar" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-destructive text-destructive-foreground hover:bg-destructive/90"}
            >
              {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {acao?.tipo === "restaurar" ? "Restaurar" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}