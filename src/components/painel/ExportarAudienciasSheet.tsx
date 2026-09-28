import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Download, Loader2, Search } from "lucide-react";
import { useCoordenacoesDoUsuario } from "@/hooks/useCoordenacoesDoUsuario";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Período inicial sugerido (filtros do painel ou mês exibido). */
  periodoInicio: string;
  periodoFim: string;
  /** Coordenação já filtrada no painel (opcional). */
  coordenacaoId?: string;
  exportando: boolean;
  onContar: (inicio: string, fim: string, coordId?: string) => Promise<number>;
  onExportar: (inicio: string, fim: string, coordId?: string) => Promise<void>;
}

const TODAS = "__todas__";

export function ExportarAudienciasSheet({
  open,
  onOpenChange,
  periodoInicio,
  periodoFim,
  coordenacaoId,
  exportando,
  onContar,
  onExportar,
}: Props) {
  const { coordenacoes, unicaCoordenacaoId, precisaSelecionar } = useCoordenacoesDoUsuario();
  const [dataDe, setDataDe] = useState(periodoInicio);
  const [dataAte, setDataAte] = useState(periodoFim);
  const [coordSel, setCoordSel] = useState<string>(coordenacaoId ?? TODAS);
  const [contando, setContando] = useState(false);
  const [contagem, setContagem] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setDataDe(periodoInicio);
      setDataAte(periodoFim);
      setCoordSel(coordenacaoId ?? (precisaSelecionar ? TODAS : (unicaCoordenacaoId ?? TODAS)));
      setContagem(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const periodoValido = !!dataDe && !!dataAte && dataDe <= dataAte;
  const coordEfetiva = coordSel === TODAS ? undefined : coordSel;

  const contar = async () => {
    if (!periodoValido) return;
    setContando(true);
    try {
      const n = await onContar(dataDe, dataAte, coordEfetiva);
      setContagem(n);
    } finally {
      setContando(false);
    }
  };

  const exportar = async () => {
    await onExportar(dataDe, dataAte, coordEfetiva);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => onOpenChange(false)}
        aria-hidden
      />
      <aside className="absolute right-0 top-0 h-full w-full max-w-md bg-card border-l border-border shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold">Exportar Audiências</h2>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)} aria-label="Fechar">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <div className="space-y-2">
            <p className="text-sm font-medium">Período</p>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">De</label>
                <Input
                  type="date"
                  value={dataDe}
                  onChange={(e) => { setDataDe(e.target.value); setContagem(null); }}
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">Até</label>
                <Input
                  type="date"
                  value={dataAte}
                  onChange={(e) => { setDataAte(e.target.value); setContagem(null); }}
                />
              </div>
            </div>
            {dataDe && dataAte && dataDe > dataAte && (
              <p className="text-xs text-destructive">A data inicial está depois da final.</p>
            )}
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Coordenação</p>
            <Select value={coordSel} onValueChange={(v) => { setCoordSel(v); setContagem(null); }}>
              <SelectTrigger>
                <SelectValue placeholder="Coordenação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODAS}>Todas as minhas coordenações</SelectItem>
                {coordenacoes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={contar}
            disabled={!periodoValido || contando || exportando}
          >
            {contando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
            Verificar audiências encontradas
          </Button>

          {contagem !== null && (
            <div
              className={
                contagem > 0
                  ? "rounded-md border border-green-300 bg-green-50 dark:bg-green-950/40 dark:border-green-800 px-4 py-3 text-sm text-green-800 dark:text-green-300"
                  : "rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300"
              }
            >
              {contagem > 0
                ? `${contagem} audiência(s) encontrada(s) no período.`
                : "Nenhuma audiência encontrada com esses filtros."}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border">
          <Button
            className="w-full bg-green-700 hover:bg-green-800 text-white"
            onClick={exportar}
            disabled={!periodoValido || exportando || contando || contagem === null || contagem === 0}
          >
            {exportando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            {contagem !== null && contagem > 0
              ? `Exportar planilha (${contagem} audiências)`
              : "Exportar planilha"}
          </Button>
          {contagem === null && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Verifique as audiências encontradas antes de exportar.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
