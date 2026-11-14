import { gerarRelatorioImportacaoExcel } from "@/lib/relatorioImportacaoExcel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, AlertTriangle, FileDown, Loader2, XCircle, Copy, Wrench, Ban } from "lucide-react";
import type { ResultadoCliente, ResultadoLinha } from "@/lib/importacaoPlanilhaCompleta";

export interface RelatorioImportacao {
  totalLinhas: number;
  invalidas: { linha: number; numero: string; motivo: string }[];
  repetidas: number;
  resultados: ResultadoLinha[];
  corrigidos: number;
  etiquetasAcrescentadas: number;
  errosEtiqueta: number;
  avisos: string[];
  falhasEtiqueta: { numero: string; etiqueta: string; motivo: string }[];
  clientesNaoEncontrados: { nome: string; processos: number }[];
  clientesDetalhes: ResultadoCliente[];
  clientesCriados: number;
  coordenacao: string;
  usuario: string;
  cancelado: boolean;
  inicio: Date;
  fim: Date;
}

export function ProgressoImportacao({ pct, etapa, stats, cancelando, onCancelar }: {
  pct: number; etapa: string; stats: { novos: number; corrigidos: number; erros: number };
  cancelando: boolean; onCancelar: () => void;
}) {
  return (
    <Card className="border-primary/30">
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div>
              <p className="font-medium">{cancelando ? "Cancelando… terminando o lote atual" : "Importando processos"}</p>
              <p className="text-sm text-muted-foreground">{etapa || "Preparando"}</p>
            </div>
          </div>
          <Button variant="destructive" size="sm" onClick={onCancelar} disabled={cancelando}>
            <XCircle className="h-4 w-4 mr-2" />{cancelando ? "Cancelando…" : "Cancelar"}
          </Button>
        </div>
        <Progress value={pct} />
        <div className="grid grid-cols-3 gap-3 text-center">
          <Num titulo="Novos" valor={stats.novos} />
          <Num titulo="Corrigidos" valor={stats.corrigidos} />
          <Num titulo="Erros" valor={stats.erros} destaque={stats.erros > 0} />
        </div>
        <p className="text-xs text-muted-foreground">Pode continuar usando esta aba; não feche até terminar.</p>
      </CardContent>
    </Card>
  );
}

const Num = ({ titulo, valor, destaque }: { titulo: string; valor: number; destaque?: boolean }) => (
  <div className="rounded-lg border bg-muted/30 p-3">
    <p className={`text-2xl font-semibold ${destaque ? "text-destructive" : ""}`}>{valor.toLocaleString("pt-BR")}</p>
    <p className="text-xs text-muted-foreground">{titulo}</p>
  </div>
);

const fmt = (d: Date) => d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

export function RelatorioFinalImportacao({ r, onFechar }: { r: RelatorioImportacao; onFechar: () => void }) {
  const novos = r.resultados.filter(x => x.status === "importado");
  const existentes = r.resultados.filter(x => x.status === "ja_existia");
  const erros = r.resultados.filter(x => x.status === "erro");
  const ok = !r.cancelado && erros.length === 0 && r.errosEtiqueta === 0 && r.clientesNaoEncontrados.length === 0;

  const vinculados = r.resultados.filter(x => x.status === "vinculado_outra");
  const baixar = async () => {
    const blob = await gerarRelatorioImportacaoExcel({ ...r, situacao: r.cancelado ? "CANCELADA" : ok ? "CONCLUÍDA SEM ERROS" : "CONCLUÍDA COM PENDÊNCIAS" });
    const url = URL.createObjectURL(blob);
    const el = document.createElement("a");
    el.href = url; el.download = `relatorio_importacao_${new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" })}.xlsx`;
    el.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <Card className={ok ? "border-primary/40" : "border-destructive/40"}>
      <CardContent className="pt-6 space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            {ok ? <CheckCircle2 className="h-7 w-7 text-primary" /> : r.cancelado ? <Ban className="h-7 w-7 text-destructive" /> : <AlertTriangle className="h-7 w-7 text-destructive" />}
            <div>
              <p className="text-lg font-semibold">{r.cancelado ? "Importação cancelada" : ok ? "Importação concluída sem erros" : "Importação concluída com pendências"}</p>
              <p className="text-sm text-muted-foreground">{fmt(r.inicio)} até {fmt(r.fim)} (Brasília)</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={baixar}><FileDown className="h-4 w-4 mr-2" />Baixar relatório completo</Button>
            <Button variant="outline" onClick={onFechar}>Fechar</Button>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
          <Num titulo="Linhas na planilha" valor={r.totalLinhas} />
          <Num titulo="Novos cadastrados" valor={novos.length} />
          <Num titulo="Já existiam" valor={existentes.length} />
          <Num titulo="Vinculados de outra coordenação" valor={vinculados.length} />
          <Num titulo="Erros" valor={erros.length} destaque={erros.length > 0} />
        </div>
        <div className="grid md:grid-cols-3 gap-3 text-sm">
          <Linha icone={<Wrench className="h-4 w-4" />} texto={`${r.corrigidos.toLocaleString("pt-BR")} existentes corrigidos, ${r.etiquetasAcrescentadas.toLocaleString("pt-BR")} etiquetas acrescentadas`} />
          <Linha icone={<Copy className="h-4 w-4" />} texto={`${r.repetidas} linhas repetidas juntadas em um só processo`} />
          <Linha icone={<Ban className="h-4 w-4" />} texto={`${r.invalidas.length} linhas sem número de processo ignoradas`} />
          <Linha icone={<CheckCircle2 className="h-4 w-4" />} texto={`${r.clientesCriados} clientes novos cadastrados e vinculados; ${r.clientesNaoEncontrados.length} com pendência`} />
        </div>
        {(erros.length > 0 || r.avisos.length > 0) && (
          <div className="rounded-lg border p-3 max-h-60 overflow-auto text-sm space-y-1">
            {r.avisos.map((a, i) => <p key={`a${i}`} className="text-muted-foreground">• {a}</p>)}
            {erros.slice(0, 50).map((e, i) => <p key={`e${i}`} className="text-destructive">Linha {e.linhaOriginal} – {e.numero}: {e.mensagem}</p>)}
            {erros.length > 50 && <p className="text-muted-foreground">… e mais {erros.length - 50} no relatório.</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
const Linha = ({ icone, texto }: { icone: React.ReactNode; texto: string }) => (
  <div className="flex items-center gap-2 rounded-lg border p-3 text-muted-foreground">{icone}<span>{texto}</span></div>
);
