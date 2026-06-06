import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { VoltarAdminTstButton } from "@/components/admin-tst/VoltarAdminTstButton";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Trash2, ExternalLink } from "lucide-react";
import { usePautasTst, PautaTst } from "@/hooks/usePautasTst";
import { PautasTstForm } from "@/components/pautas-tst/PautasTstForm";
import { PautasTstImport } from "@/components/pautas-tst/PautasTstImport";
import { Link } from "react-router-dom";

export default function PautasTstPage() {
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<PautaTst | null>(null);
  const { dados, loading, fetchDados, saveDado, deleteDado } = usePautasTst();

  const handleDelete = async (id: string) => {
    if (confirm("Excluir esta pauta?")) {
      await deleteDado(id);
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    try { return new Date(d + "T12:00:00").toLocaleDateString("pt-BR"); } catch { return d; }
  };

  if (showForm || editando) {
    return (
      <MainLayout title="Pautas TST" headerActions={<VoltarAdminTstButton />}>
        <div className="max-w-4xl mx-auto">
          <PautasTstForm
            dado={editando}
            onSave={saveDado}
            onCancel={() => { setShowForm(false); setEditando(null); }}
          />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Pautas TST">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h1 className="text-2xl font-bold text-foreground">Pautas de Julgamento TST</h1>
          <div className="flex gap-2">
            <PautasTstImport onImported={fetchDados} />
            <Button onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-2" /> Nova Pauta
            </Button>
            <Link to="/distribuicao-tst">
              <Button variant="outline">
                <ExternalLink className="w-4 h-4 mr-2" /> Distribuição TST
              </Button>
            </Link>
          </div>
        </div>

        <div className="border border-border rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data Julg.</TableHead>
                <TableHead>Processo</TableHead>
                <TableHead>Dossiê</TableHead>
                <TableHead>Equipe</TableHead>
                <TableHead>Advogado</TableHead>
                <TableHead>Órgão</TableHead>
                <TableHead>Relator</TableHead>
                <TableHead>Modalidade</TableHead>
                <TableHead>Decisão</TableHead>
                <TableHead>Aba</TableHead>
                <TableHead className="w-20">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={11} className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : dados.length === 0 ? (
                <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Nenhuma pauta encontrada</TableCell></TableRow>
              ) : dados.map(d => (
                <TableRow key={d.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setEditando(d)}>
                  <TableCell className="text-sm">{formatDate(d.data_julgamento)}</TableCell>
                  <TableCell className="font-mono text-xs">{d.processo_numero || "—"}</TableCell>
                  <TableCell className="text-sm">{d.dossie || "—"}</TableCell>
                  <TableCell className="text-sm">{d.equipe || "—"}</TableCell>
                  <TableCell className="text-sm">{d.advogado_interno || "—"}</TableCell>
                  <TableCell className="text-sm">{d.orgao || "—"}</TableCell>
                  <TableCell className="text-sm">{d.relator || "—"}</TableCell>
                  <TableCell className="text-sm">{d.modalidade || "—"}</TableCell>
                  <TableCell className="text-sm max-w-[200px] truncate">{d.decisao || "—"}</TableCell>
                  <TableCell>
                    {d.aba_origem && <Badge variant="outline" className="text-xs">{d.aba_origem}</Badge>}
                  </TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(d.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </MainLayout>
  );
}
