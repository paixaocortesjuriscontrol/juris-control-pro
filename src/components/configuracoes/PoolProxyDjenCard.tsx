import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Server, Trash2, RefreshCw, FlaskConical, CheckCircle2, XCircle, BarChart3, RotateCcw, ShieldAlert, ShieldCheck, Loader2 } from "lucide-react";
import {
  useSaudePoolDjen,
  useChecarSaudePoolDjen,
  nivelSaude,
  type SaudeSlot,
} from "@/hooks/useSaudePoolDjen";
import {
  loadDjenProxyPool,
  saveDjenProxyPool,
  isDjenProxyPoolEnabled,
  checkDjenProxyHealth,
  getDjenProxySlotsRuntime,
  clearDjenProxyOfflineMark,
  generateProxySlotId,
  getDjenProxyPoolStats,
  resetDjenProxyPoolStats,
  syncDjenProxyPoolFromSupabase,
  addProxySlotRemote,
  updateProxySlotRemote,
  removeProxySlotRemote,
  setPoolEnabledRemote,
  type PoolSessionStats,
  type ProxySlotConfig,
} from "@/utils/djenProxyPool";

interface SlotState extends ProxySlotConfig {
  online: boolean;
  lastError: string | null;
  ip?: string | null;
  uptime?: number;
}

const fmtData = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";

function SeloSaude({ saude }: { saude?: SaudeSlot }) {
  const nivel = nivelSaude(saude);
  if (nivel === "desconhecido") {
    return (
      <Badge variant="outline" className="gap-1">
        sem checagem
      </Badge>
    );
  }
  if (nivel === "critico") {
    return (
      <Badge variant="destructive" className="gap-1" title={saude?.saude_motivo || undefined}>
        <ShieldAlert className="h-3 w-3" />
        {saude?.saude_status === "cert_expirado" || saude?.saude_status === "cert_invalido"
          ? "certificado"
          : saude?.saude_status === "auth_invalido"
            ? "token 401"
            : "offline"}
      </Badge>
    );
  }
  if (nivel === "atencao") {
    return (
      <Badge variant="outline" className="gap-1 border-amber-500 text-amber-600">
        <ShieldAlert className="h-3 w-3" />
        cert. vence em {saude?.cert_dias_restantes}d
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 border-green-600 text-green-700">
      <ShieldCheck className="h-3 w-3" />
      ok{saude?.latencia_ms ? ` • ${saude.latencia_ms}ms` : ""}
    </Badge>
  );
}

export default function PoolProxyDjenCard() {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState<boolean>(false);
  const [slots, setSlots] = useState<SlotState[]>([]);
  const [form, setForm] = useState({ label: "", baseUrl: "", token: "" });
  const [testing, setTesting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<PoolSessionStats>(() => getDjenProxyPoolStats());
  const { data: saude = [] } = useSaudePoolDjen();
  const checar = useChecarSaudePoolDjen();
  const saudePorUrl = new Map(
    saude.map((s) => [String(s.base_url).replace(/\/$/, ""), s]),
  );
  const ultimaChecagem = saude
    .map((s) => s.ultima_checagem_em)
    .filter(Boolean)
    .sort()
    .pop();

  function refreshFromStorage() {
    const runtime = getDjenProxySlotsRuntime();
    setSlots(runtime.map((r) => ({ ...r })));
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await syncDjenProxyPoolFromSupabase();
      } finally {
        if (!alive) return;
        setEnabled(isDjenProxyPoolEnabled());
        refreshFromStorage();
        setLoading(false);
      }
    })();
    const id = window.setInterval(() => {
      setStats(getDjenProxyPoolStats());
    }, 1500);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  async function handleToggle(value: boolean) {
    await setPoolEnabledRemote(value);
    setEnabled(value);
    toast({
      title: value ? "Pool de proxies ativado" : "Pool de proxies desativado",
      description: value
        ? "As próximas execuções de DJEN Paralela usarão round-robin entre as VPS cadastradas e a chamada direta."
        : "Voltando ao comportamento padrão (chamada direta apenas).",
    });
  }

  async function handleAddSlot() {
    const label = form.label.trim();
    const baseUrl = form.baseUrl.trim().replace(/\/$/, "");
    const token = form.token.trim();

    if (!label || !baseUrl || !token) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha label, URL base e token antes de salvar.",
        variant: "destructive",
      });
      return;
    }

    if (!/^https?:\/\//.test(baseUrl)) {
      toast({
        title: "URL inválida",
        description: "A URL base deve começar com http:// ou https://",
        variant: "destructive",
      });
      return;
    }

    setTesting(true);
    try {
      const health = await checkDjenProxyHealth(baseUrl);
      if (!health.ok) {
        toast({
          title: "Proxy não respondeu",
          description: health.error || "GET /health falhou. Verifique URL e Nginx.",
          variant: "destructive",
        });
        return;
      }

      try {
        await addProxySlotRemote({ label, baseUrl, token });
      } catch (e: any) {
        const msg = e?.message || String(e);
        const isDup = /duplicate|already exists|unique/i.test(msg);
        toast({
          title: isDup ? "VPS já cadastrada" : "Erro ao salvar no Supabase",
          description: isDup
            ? "Essa URL base já existe no pool — edite a VPS atual em vez de duplicar."
            : msg,
          variant: "destructive",
        });
        return;
      }
      setForm({ label: "", baseUrl: "", token: "" });
      refreshFromStorage();
      toast({
        title: "VPS cadastrada",
        description: `Proxy ${label} respondeu OK${health.ip ? ` (IP ${health.ip})` : ""}.`,
      });
    } finally {
      setTesting(false);
    }
  }

  async function handleRemove(id: string) {
    try {
      await removeProxySlotRemote(id);
      refreshFromStorage();
    } catch (e: any) {
      toast({
        title: "Erro ao remover VPS",
        description: e?.message || String(e),
        variant: "destructive",
      });
    }
  }

  async function handleToggleSlot(id: string, value: boolean) {
    try {
      await updateProxySlotRemote(id, { enabled: value });
      refreshFromStorage();
    } catch (e: any) {
      toast({
        title: "Erro ao atualizar VPS",
        description: e?.message || String(e),
        variant: "destructive",
      });
    }
  }

  async function handleRecheck(slot: SlotState) {
    clearDjenProxyOfflineMark(slot.id);
    const health = await checkDjenProxyHealth(slot.baseUrl);
    if (!health.ok) {
      toast({
        title: `${slot.label}: offline`,
        description: health.error || "GET /health falhou.",
        variant: "destructive",
      });
    } else {
      toast({
        title: `${slot.label}: online`,
        description: health.ip ? `IP de saída: ${health.ip}` : "OK",
      });
    }
    refreshFromStorage();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Server className="h-5 w-5" />
          Pool de Proxies DJEN (POC)
          <Badge variant="outline" className="ml-2 gap-1">
            <FlaskConical className="h-3 w-3" />
            experimental
          </Badge>
        </CardTitle>
        <CardDescription>
          Roteia chamadas do motor <strong>DJEN Termos Paralela</strong> por VPS externas
          em round-robin para evitar erros 429 (Too Many Attempts) da API PJE Comunica.
          Não afeta DJEN Pro, Flash, STF Flash nem qualquer outro motor.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Toggle global */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="pool-toggle" className="text-base">
              Usar pool nas próximas execuções da Paralela
            </Label>
            <p className="text-sm text-muted-foreground">
              Quando desligado, todas as chamadas saem do navegador (comportamento atual).
            </p>
          </div>
          <Switch id="pool-toggle" checked={enabled} onCheckedChange={handleToggle} />
        </div>

        {/* Estatísticas da sessão */}
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Estatísticas da sessão
            </h4>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                resetDjenProxyPoolStats();
                setStats(getDjenProxyPoolStats());
              }}
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Zerar
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Total de chamadas</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Diretas (navegador)</p>
              <p className="text-2xl font-bold">{stats.direct}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Via proxy (VPS)</p>
              <p className="text-2xl font-bold text-green-600">
                {Object.values(stats.byProxy).reduce((a, b) => a + b, 0)}
              </p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">429 via proxy</p>
              <p className="text-2xl font-bold text-amber-600">
                {Object.values(stats.rateLimitsByProxy).reduce((a, b) => a + b, 0)}
              </p>
            </div>
          </div>
          {slots.length > 0 && (
            <div className="space-y-1 pt-2 border-t">
              <p className="text-xs font-medium text-muted-foreground">Por VPS:</p>
              {slots.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-xs">
                  <span className="font-medium">{s.label}</span>
                  <span className="text-muted-foreground">
                    {stats.byProxy[s.id] || 0} chamadas •{" "}
                    <span className="text-amber-600">{stats.rateLimitsByProxy[s.id] || 0} × 429</span> •{" "}
                    <span className="text-destructive">{stats.errorsByProxy[s.id] || 0} erros</span>
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            Atualiza a cada 1.5s. Os contadores zeram ao recarregar a página.
          </p>
        </div>

        {/* Lista de slots */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">VPS cadastradas</h4>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Última checagem: {ultimaChecagem ? new Date(ultimaChecagem).toLocaleString("pt-BR") : "—"}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={checar.isPending}
                onClick={() =>
                  checar.mutate(undefined, {
                    onSuccess: () =>
                      toast({
                        title: "Checagem concluída",
                        description: "Status e validade dos certificados atualizados.",
                      }),
                    onError: (e: any) =>
                      toast({
                        title: "Erro na checagem",
                        description: e?.message || String(e),
                        variant: "destructive",
                      }),
                  })
                }
              >
                {checar.isPending ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3 mr-1" />
                )}
                Testar todas agora
              </Button>
            </div>
          </div>
          {slots.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              Nenhuma VPS cadastrada. Adicione abaixo para começar a testar.
            </p>
          ) : (
            <div className="space-y-2">
              {slots.map((slot) => {
                const s = saudePorUrl.get(slot.baseUrl.replace(/\/$/, ""));
                return (
                <div
                  key={slot.id}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  {slot.online ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 text-destructive shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{slot.label}</span>
                      <Badge variant={slot.enabled ? "default" : "outline"}>
                        {slot.enabled ? "ativo" : "pausado"}
                      </Badge>
                      <SeloSaude saude={s} />
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {slot.baseUrl}
                    </p>
                    {s?.cert_expira_em && (
                      <p className="text-xs text-muted-foreground">
                        Certificado válido até {fmtData(s.cert_expira_em)}
                        {s.cert_dias_restantes !== null &&
                          ` (${s.cert_dias_restantes < 0 ? `vencido há ${Math.abs(s.cert_dias_restantes)}` : s.cert_dias_restantes} dia${Math.abs(s.cert_dias_restantes) === 1 ? "" : "s"}${s.cert_dias_restantes < 0 ? "" : " restantes"})`}
                      </p>
                    )}
                    {s?.saude_motivo && (
                      <p className="text-xs text-destructive">{s.saude_motivo}</p>
                    )}
                    {slot.lastError && !slot.online && (
                      <p className="text-xs text-destructive truncate">
                        Último erro: {slot.lastError}
                      </p>
                    )}
                  </div>
                  <Switch
                    checked={slot.enabled}
                    onCheckedChange={(v) => handleToggleSlot(slot.id, v)}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRecheck(slot)}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemove(slot.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Form de cadastro */}
        <div className="space-y-3 rounded-lg border p-4">
          <h4 className="text-sm font-semibold">Adicionar VPS</h4>
          {/* autoComplete="off" + name aleatório evitam o Chrome preencher
              esses campos com email/senha salvos do gerenciador. */}
          <form autoComplete="off" onSubmit={(e) => { e.preventDefault(); handleAddSlot(); }}>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="slot-label">Label</Label>
              <Input
                id="slot-label"
                name="proxy-label-no-autofill"
                autoComplete="off"
                placeholder="Hostinger #1"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="slot-url">URL base</Label>
              <Input
                id="slot-url"
                name="proxy-url-no-autofill"
                autoComplete="off"
                type="url"
                inputMode="url"
                placeholder="https://meudominio.com/djen-proxy"
                value={form.baseUrl}
                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="slot-token">Token (PROXY_TOKEN do setup.sh)</Label>
            <Input
              id="slot-token"
              name="proxy-token-no-autofill"
              autoComplete="new-password"
              type="password"
              placeholder="cole aqui o token impresso no setup.sh"
              value={form.token}
              onChange={(e) => setForm({ ...form, token: e.target.value })}
            />
          </div>
          <div className="flex justify-end pt-3">
            <Button type="submit" disabled={testing}>
              {testing ? "Testando..." : "Testar e salvar"}
            </Button>
          </div>
          </form>
        </div>

        <p className="text-xs text-muted-foreground">
          Dica: rode <code>bash setup.sh</code> da pasta <code>djen-proxy/</code> na
          sua VPS Hostinger e exponha em <code>/djen-proxy/</code> via Nginx (instruções
          em <code>djen-proxy/README.md</code>). Se a VPS sair do ar, o motor cai
          automaticamente para chamada direta sem interromper a execução.
        </p>
        <p className="text-xs text-muted-foreground">
          A checagem automática roda todos os dias às 8h (BRT) e envia e-mail aos
          administradores quando um certificado está a 30, 15, 7 ou 1 dia do vencimento,
          quando já venceu ou quando a VPS está fora do ar.
        </p>
      </CardContent>
    </Card>
  );
}