import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useKurierCredenciais } from "@/hooks/useKurierCredenciais";
import { Cloud, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

/**
 * Distribui as credenciais Kurier ativas entre N VPS workers.
 * Cada VPS recebe uma URL `/worker-kurier-vps?credenciais=...` com seu subconjunto.
 */
export function KurierVpsDistribuidorCard() {
  const { data: credenciais } = useKurierCredenciais();
  const [numVps, setNumVps] = useState(3);
  const [concurrency, setConcurrency] = useState(3);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");

  const ativas = useMemo<any[]>(
    () => (credenciais || []).filter((c: any) => c.ativo && (c.senha_encrypted || c.tem_senha)),
    [credenciais],
  );

  const grupos = useMemo(() => {
    const n = Math.max(1, Math.min(20, numVps));
    const out: any[][] = Array.from({ length: n }, () => [] as any[]);
    ativas.forEach((c, i) => out[i % n].push(c));
    return out;
  }, [ativas, numVps]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  function urlFor(group: any[]) {
    const params = new URLSearchParams();
    params.set("credenciais", group.map((c) => c.id).join(","));
    params.set("autostart", "true");
    params.set("concurrency", String(concurrency));
    if (dataInicio) params.set("data_inicio", dataInicio);
    if (dataFim) params.set("data_fim", dataFim);
    return `${origin}/worker-kurier-vps?${params.toString()}`;
  }

  function copiar(url: string) {
    navigator.clipboard.writeText(url);
    toast.success("URL copiada");
  }

  function copiarTodas() {
    const linhas = grupos
      .filter((g) => g.length > 0)
      .map((g, i) => `# VPS ${i + 1} (${g.length} credenciais)\n${urlFor(g)}`)
      .join("\n\n");
    navigator.clipboard.writeText(linhas);
    toast.success("Todas as URLs copiadas");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Cloud className="h-5 w-5" /> Distribuir busca Kurier em VPS
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Divide as {ativas.length} credenciais Kurier ativas entre N workers VPS, cada um com seu próprio IP.
          Cada URL roda em paralelo e processa apenas seu subconjunto.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Nº de VPS</Label>
            <Input type="number" min={1} max={20} value={numVps}
              onChange={(e) => setNumVps(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
              className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Concorrência por VPS</Label>
            <Input type="number" min={1} max={10} value={concurrency}
              onChange={(e) => setConcurrency(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
              className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Data início</Label>
            <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Data fim</Label>
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="h-9" />
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={copiarTodas} disabled={ativas.length === 0}>
            <Copy className="h-4 w-4 mr-2" /> Copiar todas as URLs
          </Button>
        </div>

        <div className="space-y-2">
          {grupos.map((g, i) => (
            <div key={i} className="flex items-center justify-between gap-2 p-2 border rounded-md text-sm">
              <div className="flex items-center gap-2 min-w-0">
                <Badge variant="outline">VPS {i + 1}</Badge>
                <span className="text-muted-foreground">
                  {g.length} credenciais
                  {g.length > 0 && `: ${g.slice(0, 3).map((c: any) => c.login).join(", ")}${g.length > 3 ? "…" : ""}`}
                </span>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="outline" onClick={() => copiar(urlFor(g))} disabled={g.length === 0}>
                  <Copy className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="outline" asChild disabled={g.length === 0}>
                  <a href={urlFor(g)} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </Button>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          Abra cada URL em uma VPS diferente (ou aba/janela diferente). O <code>autostart=true</code> faz a
          execução começar automaticamente. Mantenha as janelas abertas durante a busca.
        </p>
      </CardContent>
    </Card>
  );
}