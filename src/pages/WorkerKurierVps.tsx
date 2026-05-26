/**
 * Worker VPS Kurier — página headless para paralelizar a busca Kurier em N VPS.
 *
 * URL: /worker-kurier-vps?credenciais=ID1,ID2&autostart=true&concurrency=3
 *      &data_inicio=YYYY-MM-DD&data_fim=YYYY-MM-DD
 *
 * Cada instância processa apenas o subconjunto de credenciais informado,
 * chamando a edge function `kurier-consultar-publicacoes` em paralelo.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Play, Square, Wifi, WifiOff, Copy, Loader2 } from "lucide-react";

type TrackStatus = "pendente" | "executando" | "concluido" | "erro" | "cancelado";
interface Track {
  credencialId: string;
  login: string;
  status: TrackStatus;
  novas: number;
  duplicadas: number;
  confirmadas: number;
  lotes: number;
  mensagem: string;
}

const MAX_CALLS = 200;

export default function WorkerKurierVps() {
  const [searchParams] = useSearchParams();
  const credIdsParam = (searchParams.get("credenciais") || "").trim();
  const autoStart = searchParams.get("autostart") === "true";
  const concurrency = Math.max(1, Math.min(10, Number(searchParams.get("concurrency") || "3")));
  const dataInicio = searchParams.get("data_inicio") || undefined;
  const dataFim = searchParams.get("data_fim") || undefined;
  const coordenacaoId = searchParams.get("coordenacao_id") || undefined;
  const monitoramentoIdsParam = (searchParams.get("monitoramento_ids") || "").trim();
  const monitoramentoIds = useMemo(
    () => monitoramentoIdsParam.split(",").map((s) => s.trim()).filter(Boolean),
    [monitoramentoIdsParam],
  );

  const credenciaisFiltro = useMemo(
    () => credIdsParam.split(",").map((s) => s.trim()).filter(Boolean),
    [credIdsParam],
  );

  const [isAuth, setIsAuth] = useState<boolean | null>(null);
  const [ip, setIp] = useState<string | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [running, setRunning] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [iniciadoEm, setIniciadoEm] = useState<number | null>(null);
  const [tempo, setTempo] = useState(0);
  const abortRef = useRef<{ cancel: boolean }>({ cancel: false });

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setIsAuth(!!session));
  }, []);

  // IP
  useEffect(() => {
    fetch("https://api.ipify.org?format=json")
      .then((r) => r.json())
      .then((d) => setIp(d.ip))
      .catch(() => setIp(null));
  }, []);

  // Cronômetro
  useEffect(() => {
    if (!iniciadoEm || !running) return;
    const t = setInterval(() => setTempo(Math.floor((Date.now() - iniciadoEm) / 1000)), 1000);
    return () => clearInterval(t);
  }, [iniciadoEm, running]);

  const totais = useMemo(() => {
    const novas = tracks.reduce((s, t) => s + t.novas, 0);
    const duplicadas = tracks.reduce((s, t) => s + t.duplicadas, 0);
    const confirmadas = tracks.reduce((s, t) => s + t.confirmadas, 0);
    const concluidas = tracks.filter((t) => ["concluido", "erro", "cancelado"].includes(t.status)).length;
    const pct = tracks.length > 0 ? Math.floor((concluidas / tracks.length) * 100) : 0;
    return { novas, duplicadas, confirmadas, concluidas, pct };
  }, [tracks]);

  const updateTrack = (id: string, patch: Partial<Track>) => {
    setTracks((prev) => prev.map((t) => (t.credencialId === id ? { ...t, ...patch } : t)));
  };

  async function processar(track: Track) {
    updateTrack(track.credencialId, { status: "executando", mensagem: "Consultando lote 1…" });
    let novas = 0, duplicadas = 0, confirmadas = 0, lotes = 0;
    try {
      for (let i = 1; i <= MAX_CALLS && !abortRef.current.cancel; i++) {
        updateTrack(track.credencialId, { mensagem: `Consultando lote ${i}…` });
        const { data, error } = await supabase.functions.invoke("kurier-consultar-publicacoes", {
          body: {
            credencial_id: track.credencialId,
            max_lotes: 1,
            data_inicio: dataInicio,
            data_fim: dataFim,
            coordenacao_id: coordenacaoId,
            monitoramento_ids: monitoramentoIds.length ? monitoramentoIds : undefined,
          },
        });
        if (error) throw error;
        const r = data as any;
        if (r?.error) throw new Error(r.error);
        const recebidas = Number(r?.total_recebidas ?? 0);
        novas += Number(r?.total_novas ?? 0);
        duplicadas += Number(r?.total_duplicadas ?? 0);
        confirmadas += Number(r?.total_confirmadas ?? 0);
        lotes += Number(r?.lotes_processados ?? 0);
        updateTrack(track.credencialId, {
          novas, duplicadas, confirmadas, lotes,
          mensagem: `${novas} novas / ${duplicadas} dup / ${confirmadas} conf em ${lotes} lote(s)`,
        });
        if (r?.ok === false) throw new Error(r?.erro || "Erro Kurier");
        if (recebidas < 50 || Number(r?.lotes_processados ?? 0) === 0) break;
      }
      updateTrack(track.credencialId, {
        status: abortRef.current.cancel ? "cancelado" : "concluido",
      });
    } catch (e: any) {
      updateTrack(track.credencialId, {
        status: "erro",
        mensagem: `Erro: ${String(e?.message ?? e).slice(0, 100)}`,
      });
    }
  }

  async function executar() {
    if (running) return;
    abortRef.current.cancel = false;
    setRunning(true);
    setMensagem("Carregando credenciais…");
    setIniciadoEm(Date.now());

    try {
      let query = (supabase as any)
        .from("kurier_credenciais")
        .select("id, login, senha_encrypted")
        .eq("ativo", true)
        .not("senha_encrypted", "is", null);
      if (credenciaisFiltro.length > 0) {
        query = query.in("id", credenciaisFiltro);
      }
      const { data: creds, error } = await query;
      if (error) throw error;

      const initial: Track[] = (creds ?? []).map((c: any) => ({
        credencialId: c.id,
        login: c.login,
        status: "pendente",
        novas: 0, duplicadas: 0, confirmadas: 0, lotes: 0,
        mensagem: "Aguardando…",
      }));
      setTracks(initial);

      if (initial.length === 0) {
        setMensagem("Nenhuma credencial Kurier ativa encontrada para este worker.");
        setRunning(false);
        return;
      }

      setMensagem(`Processando ${initial.length} credencial(is) com concorrência ${concurrency}…`);

      // Pool de paralelismo
      let idx = 0;
      const workers = Array.from({ length: Math.min(concurrency, initial.length) }, async () => {
        while (!abortRef.current.cancel) {
          const i = idx++;
          if (i >= initial.length) return;
          await processar(initial[i]);
        }
      });
      await Promise.all(workers);

      setMensagem(abortRef.current.cancel ? "Execução cancelada" : "Concluído");
    } catch (e: any) {
      setMensagem(`Erro: ${String(e?.message ?? e)}`);
    } finally {
      setRunning(false);
    }
  }

  function cancelar() {
    abortRef.current.cancel = true;
    setMensagem("Cancelando…");
  }

  // Auto-start
  useEffect(() => {
    if (autoStart && isAuth) {
      executar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, isAuth]);

  function copiarUrl() {
    navigator.clipboard.writeText(window.location.href);
  }

  if (isAuth === false) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader><CardTitle className="text-yellow-500">Autenticação necessária</CardTitle></CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Você precisa estar logado para executar o worker Kurier.</p>
            <Button className="mt-4 w-full" onClick={() => (window.location.href = "/auth")}>Fazer Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatTempo = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">VPS Worker Kurier</h1>
            <p className="text-muted-foreground text-sm">
              {credenciaisFiltro.length > 0
                ? `${credenciaisFiltro.length} credencial(is) atribuída(s)`
                : "Todas as credenciais ativas"}
              {" · "}concorrência {concurrency}
              {dataInicio || dataFim ? ` · ${dataInicio || "?"} → ${dataFim || "?"}` : ""}
              {coordenacaoId ? ` · coord ${coordenacaoId.slice(0, 8)}` : ""}
              {monitoramentoIds.length ? ` · ${monitoramentoIds.length} termo(s)` : ""}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={copiarUrl}>
            <Copy className="h-4 w-4 mr-2" /> Copiar URL
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Status</CardTitle>
              <div className="flex items-center gap-2">
                {ip ? (
                  <Badge variant="outline" className="gap-1"><Wifi className="h-3 w-3 text-green-500" />{ip}</Badge>
                ) : (
                  <Badge variant="outline" className="gap-1"><WifiOff className="h-3 w-3 text-muted-foreground" />Detectando…</Badge>
                )}
                <Badge variant={running ? "secondary" : "default"}>
                  {running ? "EXECUTANDO" : tracks.length === 0 ? "IDLE" : "PARADO"}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>{totais.concluidas}/{tracks.length} credenciais</span>
                <span>{totais.pct}%</span>
              </div>
              <Progress value={totais.pct} className="h-2" />
            </div>

            <p className="text-sm text-muted-foreground min-h-[20px]">{mensagem || "Aguardando…"}</p>

            <div className="grid grid-cols-4 gap-3">
              <Stat label="Novas" value={totais.novas} />
              <Stat label="Duplicadas" value={totais.duplicadas} />
              <Stat label="Confirmadas" value={totais.confirmadas} />
              <Stat label="Tempo" value={formatTempo(tempo)} />
            </div>

            <div className="flex gap-2">
              {running ? (
                <Button variant="destructive" className="flex-1" onClick={cancelar}>
                  <Square className="h-4 w-4 mr-2" /> Parar
                </Button>
              ) : (
                <Button className="flex-1" onClick={executar}>
                  <Play className="h-4 w-4 mr-2" /> {tracks.length === 0 ? "Iniciar" : "Executar Novamente"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {tracks.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Credenciais</CardTitle></CardHeader>
            <CardContent>
              <div className="divide-y border rounded-md max-h-96 overflow-auto">
                {tracks.map((t) => (
                  <div key={t.credencialId} className="flex items-center justify-between gap-2 p-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      {t.status === "executando" && <Loader2 className="h-3 w-3 animate-spin shrink-0" />}
                      <span className="font-mono shrink-0">{t.login}</span>
                      <span className="text-muted-foreground truncate">{t.mensagem}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge variant="outline" className="h-5">+{t.novas}</Badge>
                      <Badge variant="secondary" className="h-5">dup {t.duplicadas}</Badge>
                      <Badge variant={
                        t.status === "concluido" ? "default" :
                        t.status === "erro" ? "destructive" :
                        t.status === "executando" ? "secondary" : "outline"
                      } className="h-5">{t.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-muted-foreground text-center">
          Mantenha esta janela aberta durante a execução. Abra a mesma URL em outras VPS para paralelizar.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="text-center p-3 bg-muted rounded-lg">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}