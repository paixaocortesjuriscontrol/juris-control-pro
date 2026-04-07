import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Trash2, ExternalLink } from "lucide-react";
import { useDistribuicoesTst, DistribuicaoTst as DistTst } from "@/hooks/useDistribuicoesTst";
import { DistribuicaoTstForm } from "@/components/distribuicao-tst/DistribuicaoTstForm";
import { DistribuicaoTstImport } from "@/components/distribuicao-tst/DistribuicaoTstImport";
import { toast } from "sonner";
import { format } from "date-fns";
import { Link } from "react-router-dom";

const favorabilidadeColor = (val: string | null) => {
  if (!val) return "secondary";
  const l = val.toLowerCase();
  if (l.includes("positiv")) return "default";
  if (l.includes("negativ")) return "destructive";
  return "secondary";
};

export default function DistribuicaoTst() {
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState<DistTst | null>(null);
  const { dados, loading, fetchDados, saveDado, deleteDado } = useDistribuicoesTst();

  const handleDelete = async (id: string) => {
    if (confirm("Excluir esta distribuição?")) {
      await deleteDado(id);
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    try { return new Date(d + "T12:00:00").toLocaleDateString("pt-BR"); } catch { return d; }
  };

  if (showForm || editando) {
    return (
      <MainLayout title="Distribuição TST">
        <div className="max-w-4xl mx-auto">
          <DistribuicaoTstForm
            dado={editando}
            onSave={saveDado}
            onCancel={() => { setShowForm(false); setEditando(null); }}
          />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Distribuição TST">
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h1 className="text-2xl font-bold text-foreground">Distribuição TST</h1>
          <div className="flex gap-2">
            <DistribuicaoTstImport onImported={fetchDados} />
            <Button onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-2" /> Nova Distribuição
            </Button>
            <Link to="/dados-benner">
              <Button variant="outline">
                <ExternalLink className="w-4 h-4 mr-2" /> Dados Benner
              </Button>
            </Link>
          </div>
        </div>

        <div className="border border-border rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Processo</TableHead>
                <TableHead>Dossiê</TableHead>
                <TableHead>Equipe</TableHead>
                <TableHead>Relator</TableHead>
                <TableHead>Relator +/-</TableHead>
                <TableHead>Turma</TableHead>
                <TableHead>Turma +/-</TableHead>
                <TableHead>Parte Recorrente</TableHead>
                <TableHead>Aba</TableHead>
                <TableHead className="w-20">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={11} className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : dados.length === 0 ? (
                <TableRow><TableCell colSpan={11} className="text-center py-8 text-muted-foreground">Nenhuma distribuição encontrada</TableCell></TableRow>
              ) : dados.map(d => (
                <TableRow key={d.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setEditando(d)}>
                  <TableCell className="text-sm">{formatDate(d.data_distribuicao)}</TableCell>
                  <TableCell className="font-mono text-xs">{d.processo_numero}</TableCell>
                  <TableCell className="text-sm">{d.dossie || "—"}</TableCell>
                  <TableCell className="text-sm">{d.equipe || "—"}</TableCell>
                  <TableCell className="text-sm">{d.relator || "—"}</TableCell>
                  <TableCell>
                    {d.relator_favorabilidade && (
                      <Badge variant={favorabilidadeColor(d.relator_favorabilidade) as any} className="text-xs">
                        {d.relator_favorabilidade}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{d.turma || "—"}</TableCell>
                  <TableCell>
                    {d.turma_favorabilidade && (
                      <Badge variant={favorabilidadeColor(d.turma_favorabilidade) as any} className="text-xs">
                        {d.turma_favorabilidade}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{d.parte_recorrente || "—"}</TableCell>
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
