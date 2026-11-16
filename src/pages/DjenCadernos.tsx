import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Download, Search } from "lucide-react";
import { toast } from "sonner";

const TRIBUNAIS = ["TST", ...Array.from({ length: 24 }, (_, i) => `TRT${i + 1}`), "STJ", "TJSP", "TJMG", "TJRJ", "TJDFT", "TJGO", "TRF1"];
const db = supabase as any;
const brt = (s: string) => new Date(s).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
const hojeBrt = () => new Date(Date.now() - 27 * 3600_000).toISOString().slice(0, 10);

export default function DjenCadernos() {
  const qc = useQueryClient();
  const [selecionados, setSelecionados] = useState<string[]>(["TST"]);
  const [data, setData] = useState(hojeBrt());
  const [baixando, setBaixando] = useState<string | null>(null);
  const [cadernoAtivo, setCadernoAtivo] = useState<string | null>(null);
  const [campo, setCampo] = useState<"partes" | "advogados" | "numero_digitos">("partes");
  const [termo, setTermo] = useState("");
  const [busca, setBusca] = useState("");

  const cadernos = useQuery({
    queryKey: ["djen-cadernos", data],
    queryFn: async () => {
      const { data: r, error } = await db.from("djen_cadernos").select("*").eq("data", data).order("tribunal");
      if (error) throw error;
      return r as any[];
    },
  });

  const comparacao = useQuery({
    queryKey: ["djen-cadernos-comparacao", data],
    queryFn: async () => {
      const ini = `${data}T00:00:00-03:00`, fim = `${data}T23:59:59-03:00`;
      const kurier = await db.from("publicacoes_djen").select("id", { count: "exact", head: true })
        .gte("created_at", ini).lte("created_at", fim).not("kurier_login", "is", null);
      const total = await db.from("publicacoes_djen").select("id", { count: "exact", head: true })
        .gte("created_at", ini).lte("created_at", fim);
      return { kurier: kurier.count ?? null, total: total.count ?? null };
    },
  });

  const tentativas = useQuery({
    queryKey: ["djen-cadernos-tent", cadernoAtivo],
    enabled: !!cadernoAtivo,
    queryFn: async () => {
      const { data: r } = await db.from("djen_cadernos_tentativas").select("*").eq("caderno_id", cadernoAtivo).order("created_at");
      return r as any[];
    },
  });

  const resultados = useQuery({
    queryKey: ["djen-cadernos-busca", cadernoAtivo, campo, busca],
    enabled: !!cadernoAtivo && busca.length >= 3,
    queryFn: async () => {
      const v = campo === "numero_digitos" ? busca.replace(/\D/g, "") : busca;
      const { data: r, error } = await db.from("djen_cadernos_comunicacoes")
        .select("id,numero_processo,partes,advogados,orgao,tipo,texto")
        .eq("caderno_id", cadernoAtivo).ilike(campo, `%${v}%`).limit(200);
      if (error) throw error;
      return r as any[];
    },
  });

  const baixar = async () => {
    for (const t of selecionados) {
      setBaixando(t);
      const { data: r, error } = await supabase.functions.invoke("djen-cadernos-baixar", { body: { tribunal: t, data } });
      if (error || !r?.ok) toast.error(`${t}: ${r?.erro || error?.message || "falha"}`);
      else toast.success(`${t}: ${r.total} comunicações`);
      await qc.invalidateQueries({ queryKey: ["djen-cadernos"] });
    }
    setBaixando(null);
  };

  const ativo = cadernos.data?.find((c) => c.id === cadernoAtivo);

  return (
    <MainLayout title="DJEN Cadernos" subtitle="Experimental: caderno completo do dia pela API do Comunica, separado do DJEN Servidor.">
      <div className="p-4 lg:p-6 space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Baixar caderno</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-1">
              {TRIBUNAIS.map((t) => (
                <Badge key={t} variant={selecionados.includes(t) ? "default" : "outline"} className="cursor-pointer"
                  onClick={() => setSelecionados((s) => s.includes(t) ? s.filter((x) => x !== t) : [...s, t])}>{t}</Badge>
              ))}
            </div>
            <div className="flex gap-2 items-center">
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} className="w-44" />
              <Button onClick={baixar} disabled={!!baixando || !selecionados.length}>
                {baixando ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Baixando {baixando}…</> : <><Download className="h-4 w-4 mr-2" />Baixar</>}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Nada é gravado nas coordenações. Publicações gravadas no sistema neste dia: {comparacao.data?.total ?? "…"} (Kurier: {comparacao.data?.kurier ?? "…"}).
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Cadernos de {data.split("-").reverse().join("/")}</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-muted-foreground"><th>Tribunal</th><th>Situação</th><th>Comunicações</th><th>Tamanho</th><th>Tempo</th><th>Tentativas</th><th>Atualizado (BRT)</th></tr></thead>
              <tbody>
                {(cadernos.data || []).map((c) => (
                  <tr key={c.id} className={`border-t cursor-pointer ${c.id === cadernoAtivo ? "bg-muted" : ""}`} onClick={() => setCadernoAtivo(c.id)}>
                    <td className="py-1 font-medium">{c.tribunal}</td>
                    <td><Badge variant={c.status === "ok" ? "default" : c.status === "erro" ? "destructive" : "secondary"}>{c.status}</Badge></td>
                    <td>{c.total_comunicacoes ?? "—"}</td>
                    <td>{c.tamanho_bytes ? `${(c.tamanho_bytes / 1048576).toFixed(1)} MB` : "—"}</td>
                    <td>{c.duracao_ms ? `${(c.duracao_ms / 1000).toFixed(0)} s` : "—"}</td>
                    <td>{c.tentativas}</td>
                    <td>{brt(c.updated_at)}</td>
                  </tr>
                ))}
                {!cadernos.data?.length && <tr><td colSpan={7} className="py-3 text-muted-foreground">Nenhum caderno baixado nesta data.</td></tr>}
              </tbody>
            </table>
            {ativo?.erro && <p className="text-sm text-destructive mt-2">{ativo.erro}</p>}
          </CardContent>
        </Card>

        {cadernoAtivo && (
          <div className="grid lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Tentativas — {ativo?.tribunal}</CardTitle></CardHeader>
              <CardContent className="space-y-1 text-xs">
                {(tentativas.data || []).map((t) => (
                  <div key={t.id} className="border-b pb-1">
                    <span className={t.sucesso ? "text-primary" : "text-destructive"}>{t.sucesso ? "OK" : "Falha"}</span>{" "}
                    {brt(t.created_at)} · {t.via} · {t.http_status ?? "sem resposta"}
                    {!t.sucesso && <div className="text-muted-foreground truncate">{t.mensagem}</div>}
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-base">Buscar no caderno</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <Select value={campo} onValueChange={(v: any) => setCampo(v)}>
                    <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="partes">Parte</SelectItem>
                      <SelectItem value="advogados">Advogado / OAB</SelectItem>
                      <SelectItem value="numero_digitos">Nº do processo</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input value={termo} onChange={(e) => setTermo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && setBusca(termo.trim())} placeholder="Mínimo 3 caracteres" />
                  <Button onClick={() => setBusca(termo.trim())}><Search className="h-4 w-4" /></Button>
                </div>
                {resultados.isFetching && <Loader2 className="h-4 w-4 animate-spin" />}
                {resultados.data && <p className="text-xs text-muted-foreground">{resultados.data.length} resultado(s){resultados.data.length === 200 ? " (limite)" : ""}</p>}
                <div className="space-y-2">
                  {(resultados.data || []).map((r) => (
                    <div key={r.id} className="border rounded p-2 text-sm">
                      <div className="font-medium">{r.numero_processo} · {r.tipo} · {r.orgao}</div>
                      <div className="text-xs"><b>Partes:</b> {r.partes}</div>
                      <div className="text-xs"><b>Advogados:</b> {r.advogados}</div>
                      <details className="text-xs mt-1"><summary className="cursor-pointer">Texto</summary><div className="whitespace-pre-wrap">{r.texto}</div></details>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
