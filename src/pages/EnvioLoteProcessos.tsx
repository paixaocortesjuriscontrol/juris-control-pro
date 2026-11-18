import { useEffect, useMemo, useState } from "react";
import { Download, Upload } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EnvioLoteProcessosSheet } from "@/components/coordenacoes/EnvioLoteProcessosSheet";
import { useCoordenacoesDoUsuario } from "@/hooks/useCoordenacoesDoUsuario";

export default function EnvioLoteProcessos() {
  const { coordenacoes, isAdmin, isLoading } = useCoordenacoesDoUsuario();
  const opcoes = useMemo(
    () => (coordenacoes as { id: string; nome: string }[]),
    [coordenacoes],
  );
  const [coordId, setCoordId] = useState("");
  const [aberto, setAberto] = useState(false);
  useEffect(() => { if (!coordId && opcoes.length === 1) setCoordId(opcoes[0].id); }, [opcoes, coordId]);
  const mostrarSelecao = isAdmin || opcoes.length > 1;
  const coord = opcoes.find((c) => c.id === coordId);

  return (
    <MainLayout title="Envio em lote de processos" subtitle="Cadastra vários processos a partir da planilha modelo.">
      <div className="max-w-xl space-y-4 rounded-lg border border-border bg-card p-5">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando coordenações...</p>
        ) : opcoes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Você não está vinculado a nenhuma coordenação.</p>
        ) : (
          <>
            {mostrarSelecao ? <div className="space-y-1">
              <label className="text-sm font-medium">Coordenação</label>
              <Select value={coordId} onValueChange={setCoordId}>
                <SelectTrigger><SelectValue placeholder="Escolha a coordenação" /></SelectTrigger>
                <SelectContent>
                  {opcoes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div> : <p className="text-sm">Coordenação: <strong>{coord?.nome}</strong></p>}
            <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <a href="/modelos/MODELO_IMPORTACAO_PROCESSO_PADRAO.xlsx" download="MODELO_IMPORTACAO_PROCESSO_PADRAO.xlsx">
                <Download className="mr-2 h-4 w-4" /> Baixar planilha modelo
              </a>
            </Button>
            <Button disabled={!coord} onClick={() => setAberto(true)}>
              <Upload className="mr-2 h-4 w-4" /> Abrir envio em lote
            </Button>
            </div>
          </>
        )}
      </div>
      {coord && (
        <EnvioLoteProcessosSheet open={aberto} onOpenChange={setAberto} coordenacaoId={coord.id} coordenacaoNome={coord.nome} />
      )}
    </MainLayout>
  );
}
