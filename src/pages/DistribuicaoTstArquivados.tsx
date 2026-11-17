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
import { RestaurarLoteArquivadosDialog } from "@/components/distribuicao-tst/RestaurarLoteArquivadosDialog";
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
  const [loteOpen, setLoteOpen] = useState(false);
  const [pagina, setPagina] = useState(0);
  const [total, setTotal] = useState(0);
  const [arqDe, setArqDe] = useState("");
  const [arqAte, setArqAte] = useState("");
  const [soDossie, setSoDossie] = useState(false);
  const [origem, setOrigem] = useState("");
  const POR_PAGINA = 200;

  const fetchDados = async (pg = pagina) => {
    setLoading(true);
    let query = (supabase as any)
      .from("dados_benner_arquivados")
      .select("*", { count: "exact" })
      .order("arquivado_em", { ascending: false })
      .range(pg * POR_PAGINA, pg * POR_PAGINA + POR_PAGINA - 1);
    if (busca.trim()) {
      const b = busca.trim();
      query = query.or(`processo.ilike.%${b}%,dossie.ilike.%${b}%`);
    }
    if (arqDe) query = query.gte("arquivado_em", `${arqDe}T00:00:00-03:00`);
    if (arqAte) query = query.lte("arquivado_em", `${arqAte}T23:59:59-03:00`);
    if (soDossie) query = query.not("dossie", "is", null).neq("dossie", "");
    if (origem.trim()) query = query.ilike("aba_origem", `%${origem.trim()}%`);
    const { data, error, count } = await query;
    if (error) toast.error("Erro ao carregar: " + error.message);
    else { setDados((data as any[]) || []); setTotal(count ?? 0); }
    setLoading(false);
  };
  const buscar = () => { setPagina(0); fetchDados(0); };
  const irPara = (pg: number) => { setPagina(pg); fetchDados(pg); };
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  useEffect(() => { fetchDados(0); /* eslint-disable-next-line */ }, []);

  const handleRestaurar = async (id: string) => {
    setProcessing(true);
    const { error } = await supabase.rpc("restaurar_dados_benner_arquivado" as any, { _id: id });
    setProcessing(false);
    setAcao(null);
    if (error) { toast.error("Erro ao restaurar: " + error.message); return; }
    toast.success("Registro restaurado para a Distribuição TST!");
    fetchDados(pagina);
  };

  const handleExcluirDef = async (id: string) => {
    setProcessing(true);
    const { error } = await supabase.from("dados_benner_arquivados" as any).delete().eq("id", id);
    setProcessing(false);
    setAcao(null);
    if (error) { toast.error("Erro ao excluir definitivamente: " + error.message); return; }
    toast.success("Registro excluído definitivamente.");
    fetchDados(pagina);
  };

  const fmt = (d: string) => { try { return new Date(d).toLocaleString("pt-BR"); } catch { return d; } };

  return (
    <MainLayout title="Distribuição TST — Arquivados">
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Distribuições Arquivadas</h1>
            <p className="text-sm text-muted-foreground">Apenas administradores e coordenadores podem consultar e restaurar registros arquivados.</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setLoteOpen(true)}><RotateCcw className="w-4 h-4 mr-2" /> Restaurar em lote</Button>
            <Link to="/distribuicao-tst">
              <Button variant="outline"><ArrowLeft className="w-4 h-4 mr-2" /> Voltar</Button>
            </Link>
          </div>
          <RestaurarLoteArquivadosDialog open={loteOpen} onOpenChange={setLoteOpen} onDone={() => fetchDados(pagina)} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por processo ou dossiê..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && buscar()}
              className="pl-8"
            />
          </div>
          <div className="flex items-center gap-1 text-sm">
            <span className="text-muted-foreground">Arquivado de</span>
            <Input type="date" value={arqDe} onChange={(e) => setArqDe(e.target.value)} className="w-36" />
            <span className="text-muted-foreground">até</span>
            <Input type="date" value={arqAte} onChange={(e) => setArqAte(e.target.value)} className="w-36" />
          </div>
          <Input placeholder="Origem (ex.: Base PCA)" value={origem} onChange={(e) => setOrigem(e.target.value)} className="w-44" onKeyDown={(e) => e.key === "Enter" && buscar()} />
          <label className="flex items-center gap-1 text-sm whitespace-nowrap">
            <input type="checkbox" checked={soDossie} onChange={(e) => setSoDossie(e.target.checked)} /> Só com dossiê
          </label>
          <Button variant="outline" onClick={buscar}>Buscar</Button>
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{total.toLocaleString("pt-BR")} arquivado(s) · página {pagina + 1} de {totalPaginas}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={loading || pagina === 0} onClick={() => irPara(pagina - 1)}>Anterior</Button>
            <Button size="sm" variant="outline" disabled={loading || pagina + 1 >= totalPaginas} onClick={() => irPara(pagina + 1)}>Próxima</Button>
          </div>
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