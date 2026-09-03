import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useKurierCredenciais } from "@/hooks/useKurierCredenciais";
import { CheckCircle2, KeyRound, Loader2, Plus, Trash2, XCircle, Users, Waves } from "lucide-react";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useCoordenacoesFull } from "@/hooks/useCoordenacoes";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";


type KurierTrackView = {
  credencialId: string;
  login: string;
  status: string;
  novas: number;
  duplicadas: number;
  descartadas: number;
  confirmadas: number;
  recebidas: number;
  lotes: number;
  mensagem?: string;
  erro?: string | null;
};

/** Acompanhamento inline da drenagem: lê a execução e mostra progresso na mesma tela. */
function DrenagemProgresso({ execId, login, onFechar }: { execId: string; login: string; onFechar: () => void }) {
  const { data } = useQuery({
    queryKey: ["kurier-drenagem", execId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("execucoes_agendadas")
        .select("id, status, detalhes, ultimo_erro, iniciado_em, finalizado_em")
        .eq("id", execId)
        .maybeSingle();
      if (error) throw error;
      return data as {
        status: string;
        detalhes: Record<string, unknown> | null;
        ultimo_erro: string | null;
        iniciado_em: string | null;
        finalizado_em: string | null;
      } | null;
    },
    refetchInterval: (query) => {
      const st = (query.state.data as { status?: string } | undefined)?.status;
      return st && !["pendente", "executando"].includes(st) ? false : 3000;
    },
  });

  const det = (data?.detalhes || {}) as Record<string, any>;
  const track: KurierTrackView | undefined = Array.isArray(det.tracks) ? det.tracks[0] : undefined;
  const emAndamento = !data || ["pendente", "executando"].includes(data.status);
  const lotes = Number(track?.lotes ?? 0);
  const pct = emAndamento ? Math.min(92, 6 + lotes * 6) : 100;

  return (
    <div className="rounded-md border bg-muted/40 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          {emAndamento ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 text-primary" />}
          Drenagem da fila — {login}
          <Badge variant={emAndamento ? "secondary" : data?.status === "concluido" ? "default" : "destructive"}>
            {emAndamento ? "em andamento" : data?.status}
          </Badge>
        </div>
        <Button size="sm" variant="ghost" onClick={onFechar}>Ocultar</Button>
      </div>
      <Progress value={pct} className="h-2" />
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>Lotes: <strong className="text-foreground">{lotes}</strong></span>
        <span>Recebidas: <strong className="text-foreground">{Number(det.recebidas ?? track?.recebidas ?? 0)}</strong></span>
        <span>Novas: <strong className="text-foreground">{Number(det.novas ?? track?.novas ?? 0)}</strong></span>
        <span>Duplicadas: <strong className="text-foreground">{Number(det.duplicadas ?? track?.duplicadas ?? 0)}</strong></span>
        <span>Confirmadas: <strong className="text-foreground">{Number(det.confirmadas ?? track?.confirmadas ?? 0)}</strong></span>
        <span>Descartadas: <strong className="text-foreground">{Number(det.descartadas ?? track?.descartadas ?? 0)}</strong></span>
      </div>
      {(track?.mensagem || data?.ultimo_erro) && (
        <p className={`text-xs ${data?.ultimo_erro ? "text-destructive" : "text-muted-foreground"}`}>
          {data?.ultimo_erro || track?.mensagem}
        </p>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <Badge variant="outline">—</Badge>;
  const ok = status.toLowerCase().startsWith("ok");
  const Icon = ok ? CheckCircle2 : XCircle;
  return (
    <Badge variant={ok ? "default" : "destructive"} className="gap-1">
      <Icon className="h-3 w-3" />
      <span className="truncate max-w-[180px]">{status}</span>
    </Badge>
  );
}

function SenhaInline({ id, hasSenha, onSave }: { id: string; hasSenha: boolean; onSave: (s: string) => Promise<void> }) {
  const [val, setVal] = useState("");
  const [saving, setSaving] = useState(false);
  return (
    <div className="flex items-center gap-1">
      <Input
        type="password"
        placeholder={hasSenha ? "•••••••• (alterar)" : "Digite a senha"}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="h-8 w-44"
      />
      <Button
        size="sm"
        variant={val ? "default" : "ghost"}
        disabled={!val || saving}
        onClick={async () => {
          setSaving(true);
          try { await onSave(val); setVal(""); } finally { setSaving(false); }
        }}
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
      </Button>
    </div>
  );
}

export function KurierCredenciaisPanel() {
  const { data: creds = [], isLoading, update, create, remove, salvarSenha, testar } = useKurierCredenciais();
  const [novoLogin, setNovoLogin] = useState("");
  const [testandoId, setTestandoId] = useState<string | null>(null);
  const [drenandoId, setDrenandoId] = useState<string | null>(null);
  const [drenagemAtiva, setDrenagemAtiva] = useState<{ execId: string; login: string } | null>(null);

  async function drenarFila(id: string, login: string) {
    if (!confirm(`Drenar a fila acumulada do login ${login}?\n\nO sistema vai consultar esse login em etapas até a fila esvaziar, processando tudo normalmente.`)) return;
    setDrenandoId(id);
    try {
      const { data, error } = await supabase.functions.invoke("executar-kurier-agendado", {
        body: { force: true, manual: true, credencial_id: id, drenagem: true },
      });
      if (error) throw error;
      const skipped = (data as { skipped?: string } | null)?.skipped;
      if (skipped) {
        toast.warning(`Drenagem não iniciada: ${skipped}`);
      } else {
        const execId = (data as { exec_id?: string } | null)?.exec_id;
        if (execId) setDrenagemAtiva({ execId, login });
        toast.success(`Drenagem iniciada para ${login}. Acompanhe o progresso abaixo.`);
      }
    } catch (e) {
      toast.error(`Falha ao iniciar drenagem: ${(e as Error)?.message ?? e}`);
    } finally {
      setDrenandoId(null);
    }
  }

  const { data: coordenacoes = [] } = useCoordenacoesFull();
  const qc = useQueryClient();
  const { data: vinculos = [] } = useQuery({
    queryKey: ["kurier-cred-coord-vinculos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("kurier_credencial_coordenacoes")
        .select("credencial_id, coordenacao_id, captura_total, somente_kurier_only, somente_djen_only");
      if (error) throw error;
      return data as {
        credencial_id: string;
        coordenacao_id: string;
        captura_total: boolean;
        somente_kurier_only: boolean;
        somente_djen_only: boolean;
      }[];
    },
  });

  type VincFlags = { capturaTotal: boolean; somenteKurierOnly: boolean; somenteDjenOnly: boolean };
  const vinculosPorCred = new Map<string, Map<string, VincFlags>>();
  for (const v of vinculos) {
    if (!vinculosPorCred.has(v.credencial_id)) vinculosPorCred.set(v.credencial_id, new Map());
    vinculosPorCred.get(v.credencial_id)!.set(v.coordenacao_id, {
      capturaTotal: !!v.captura_total,
      somenteKurierOnly: !!v.somente_kurier_only,
      somenteDjenOnly: !!v.somente_djen_only,
    });
  }

  async function toggleVinculo(credencialId: string, coordenacaoId: string, marcar: boolean) {
    try {
      if (marcar) {
        const { error } = await (supabase as any)
          .from("kurier_credencial_coordenacoes")
          .insert({ credencial_id: credencialId, coordenacao_id: coordenacaoId });
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("kurier_credencial_coordenacoes")
          .delete()
          .eq("credencial_id", credencialId)
          .eq("coordenacao_id", coordenacaoId);
        if (error) throw error;
      }
      await qc.invalidateQueries({ queryKey: ["kurier-cred-coord-vinculos"] });
    } catch (e: any) {
      toast.error(`Falha ao atualizar vínculo: ${e?.message ?? e}`);
    }
  }

  async function toggleCapturaTotalVinculo(credencialId: string, coordenacaoId: string, valor: boolean) {
    try {
      const patch: any = { captura_total: valor };
      if (valor) { patch.somente_kurier_only = false; patch.somente_djen_only = false; }
      const { error } = await (supabase as any)
        .from("kurier_credencial_coordenacoes")
        .update(patch)
        .eq("credencial_id", credencialId)
        .eq("coordenacao_id", coordenacaoId);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["kurier-cred-coord-vinculos"] });
    } catch (e: any) {
      toast.error(`Falha ao atualizar captura total: ${e?.message ?? e}`);
    }
  }

  async function toggleSomenteKurierOnlyVinculo(credencialId: string, coordenacaoId: string, valor: boolean) {
    try {
      const patch: any = { somente_kurier_only: valor };
      if (valor) { patch.captura_total = false; patch.somente_djen_only = false; }
      const { error } = await (supabase as any)
        .from("kurier_credencial_coordenacoes")
        .update(patch)
        .eq("credencial_id", credencialId)
        .eq("coordenacao_id", coordenacaoId);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["kurier-cred-coord-vinculos"] });
    } catch (e: any) {
      toast.error(`Falha ao atualizar "Só Kurier": ${e?.message ?? e}`);
    }
  }

  async function toggleSomenteDjenOnlyVinculo(credencialId: string, coordenacaoId: string, valor: boolean) {
    try {
      const patch: any = { somente_djen_only: valor };
      if (valor) { patch.captura_total = false; patch.somente_kurier_only = false; }
      const { error } = await (supabase as any)
        .from("kurier_credencial_coordenacoes")
        .update(patch)
        .eq("credencial_id", credencialId)
        .eq("coordenacao_id", coordenacaoId);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["kurier-cred-coord-vinculos"] });
    } catch (e: any) {
      toast.error(`Falha ao atualizar "Termos DJEN": ${e?.message ?? e}`);
    }
  }

  const ativos = creds.filter((c) => c.ativo).length;
  const comSenha = creds.filter((c) => !!c.senha_encrypted).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> Logins Kurier
            <Badge variant="secondary">{creds.length} cadastrados</Badge>
            <Badge variant="default">{ativos} ativos</Badge>
            <Badge variant="outline">{comSenha} com senha</Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Input
              value={novoLogin}
              onChange={(e) => setNovoLogin(e.target.value)}
              placeholder="novo login"
              className="h-8 w-40"
            />
            <Button
              size="sm"
              disabled={!novoLogin.trim() || create.isPending}
              onClick={async () => { await create.mutateAsync(novoLogin.trim()); setNovoLogin(""); }}
            >
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {drenagemAtiva && (
        <DrenagemProgresso
          execId={drenagemAtiva.execId}
          login={drenagemAtiva.login}
          onFechar={() => setDrenagemAtiva(null)}
        />
      )}
      {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Login</TableHead>
                <TableHead>Senha</TableHead>
                <TableHead className="w-24">Prioridade</TableHead>
                <TableHead className="w-20">Ativo</TableHead>
                <TableHead>Coordenações</TableHead>
                <TableHead>Último uso</TableHead>
                <TableHead>Último status</TableHead>
                <TableHead className="text-right sticky right-0 bg-background shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.2)]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {creds.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.login}</TableCell>
                  <TableCell>
                    <SenhaInline
                      id={c.id}
                      hasSenha={!!c.senha_encrypted}
                      onSave={async (s) => { await salvarSenha.mutateAsync({ id: c.id, senha: s }); }}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={c.prioridade}
                      onChange={(e) => update.mutate({ id: c.id, patch: { prioridade: Number(e.target.value) || 0 } })}
                      className="h-8 w-20"
                    />
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={c.ativo}
                      onCheckedChange={(v) => update.mutate({ id: c.id, patch: { ativo: v } })}
                    />
                  </TableCell>
                  <TableCell>
                    {(() => {
                       const selected = vinculosPorCred.get(c.id) ?? new Map<string, VincFlags>();
                       const count = selected.size;
                       const totalCount = Array.from(selected.values()).filter((f) => f.capturaTotal).length;
                       const soKurierCount = Array.from(selected.values()).filter((f) => f.somenteKurierOnly).length;
                       const soDjenCount = Array.from(selected.values()).filter((f) => f.somenteDjenOnly).length;
                      return (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button size="sm" variant="outline" className="h-8 gap-1">
                              <Users className="h-3 w-3" />
                              {count === 0 ? "Nenhuma" : `${count} coord.`}
                              {totalCount > 0 && (
                                <Badge variant="default" className="h-4 px-1 text-[10px]">
                                  {totalCount} total
                                </Badge>
                              )}
                              {soKurierCount > 0 && (
                                <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                                  {soKurierCount} só K
                                </Badge>
                              )}
                              {soDjenCount > 0 && (
                                <Badge variant="outline" className="h-4 px-1 text-[10px]">
                                  {soDjenCount} só DJEN
                                </Badge>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[42rem] max-h-[36rem] overflow-auto" align="start">
                            <div className="text-xs font-medium mb-1 text-muted-foreground">
                              Coordenações que usam este login
                            </div>
                            <div className="text-[10px] text-muted-foreground mb-2 leading-tight">
                              Marque <strong>Vincular</strong> para o login buscar publicações da coordenação.
                              Ligue <strong>Captura total</strong> para entregar à coord <em>todas</em> as publicações
                              trazidas por este login, sem aplicar termos.
                              Ligue <strong>Só Kurier</strong> para usar somente os termos cadastrados como
                              <em>"Termo só Kurier"</em> nessa coord.
                              Ligue <strong>Termos DJEN</strong> para usar somente os termos comuns
                              (Termos DJEN normais), ignorando os marcados como <em>"só Kurier"</em>.
                              As três opções são mutuamente exclusivas.
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-medium text-muted-foreground border-b pb-1 mb-1">
                              <span className="flex-1">Coordenação</span>
                              <span className="w-14 text-center">Vincular</span>
                              <span className="w-20 text-center">Captura total</span>
                              <span className="w-16 text-center">Só Kurier</span>
                              <span className="w-20 text-center">Termos DJEN</span>
                            </div>
                            {coordenacoes.length === 0 ? (
                              <div className="text-xs text-muted-foreground">Nenhuma coordenação disponível.</div>
                            ) : (
                              <div className="space-y-1.5">
                                {coordenacoes.map((coord: any) => {
                                  const vinculado = selected.has(coord.id);
                                  const flags = selected.get(coord.id);
                                  const capturaTotal = !!flags?.capturaTotal;
                                  const somenteKurierOnly = !!flags?.somenteKurierOnly;
                                  const somenteDjenOnly = !!flags?.somenteDjenOnly;
                                  return (
                                    <div key={coord.id} className="flex items-center gap-2 text-sm hover:bg-muted/50 rounded p-1">
                                      <span className="flex-1 truncate" title={coord.nome}>{coord.nome}</span>
                                      <div className="w-14 flex justify-center">
                                        <Checkbox
                                          checked={vinculado}
                                          onCheckedChange={(v) => toggleVinculo(c.id, coord.id, !!v)}
                                        />
                                      </div>
                                      <div className="w-20 flex justify-center">
                                        <Switch
                                          checked={capturaTotal}
                                          disabled={!vinculado}
                                          onCheckedChange={(v) => toggleCapturaTotalVinculo(c.id, coord.id, v)}
                                        />
                                      </div>
                                      <div className="w-16 flex justify-center">
                                        <Switch
                                          checked={somenteKurierOnly}
                                          disabled={!vinculado || capturaTotal}
                                          onCheckedChange={(v) => toggleSomenteKurierOnlyVinculo(c.id, coord.id, v)}
                                        />
                                      </div>
                                      <div className="w-20 flex justify-center">
                                        <Switch
                                          checked={somenteDjenOnly}
                                          disabled={!vinculado || capturaTotal || somenteKurierOnly}
                                          onCheckedChange={(v) => toggleSomenteDjenOnlyVinculo(c.id, coord.id, v)}
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </PopoverContent>
                        </Popover>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {c.ultimo_uso ? new Date(c.ultimo_uso).toLocaleString("pt-BR") : "—"}
                  </TableCell>
                  <TableCell><StatusBadge status={c.ultimo_status} /></TableCell>
                  <TableCell className="text-right sticky right-0 bg-background shadow-[-6px_0_6px_-6px_rgba(0,0,0,0.2)]">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!c.senha_encrypted || testandoId === c.id}
                        onClick={async () => {
                          setTestandoId(c.id);
                          try { await testar.mutateAsync(c.id); } finally { setTestandoId(null); }
                        }}
                      >
                        {testandoId === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Testar"}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="gap-1"
                        title="Roda somente este login, em etapas, até a fila da Kurier esvaziar"
                        disabled={!c.senha_encrypted || !c.ativo || drenandoId === c.id}
                        onClick={() => drenarFila(c.id, c.login)}
                      >
                        {drenandoId === c.id
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <Waves className="h-3 w-3" />}
                        Drenar fila
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Remover login ${c.login}?`)) remove.mutate(c.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}