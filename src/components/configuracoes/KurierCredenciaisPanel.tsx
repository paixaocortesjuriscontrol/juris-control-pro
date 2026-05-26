import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useKurierCredenciais } from "@/hooks/useKurierCredenciais";
import { CheckCircle2, KeyRound, Loader2, Plus, Trash2, XCircle, Users } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useCoordenacoesFull } from "@/hooks/useCoordenacoes";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  const { data: coordenacoes = [] } = useCoordenacoesFull();
  const qc = useQueryClient();
  const { data: vinculos = [] } = useQuery({
    queryKey: ["kurier-cred-coord-vinculos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("kurier_credencial_coordenacoes")
        .select("credencial_id, coordenacao_id");
      if (error) throw error;
      return data as { credencial_id: string; coordenacao_id: string }[];
    },
  });

  const vinculosPorCred = new Map<string, Set<string>>();
  for (const v of vinculos) {
    if (!vinculosPorCred.has(v.credencial_id)) vinculosPorCred.set(v.credencial_id, new Set());
    vinculosPorCred.get(v.credencial_id)!.add(v.coordenacao_id);
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
                <TableHead className="text-right">Ações</TableHead>
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
                      onCheckedChange={(v) => {
                        if (v && !c.senha_encrypted) {
                          toast.error("Cadastre a senha antes de ativar");
                          return;
                        }
                        update.mutate({ id: c.id, patch: { ativo: v } });
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const selected = vinculosPorCred.get(c.id) ?? new Set<string>();
                      const count = selected.size;
                      return (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button size="sm" variant="outline" className="h-8 gap-1">
                              <Users className="h-3 w-3" />
                              {count === 0 ? "Nenhuma" : `${count} coord.`}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-72 max-h-80 overflow-auto" align="start">
                            <div className="text-xs font-medium mb-2 text-muted-foreground">
                              Coordenações que usam este login
                            </div>
                            {coordenacoes.length === 0 ? (
                              <div className="text-xs text-muted-foreground">Nenhuma coordenação disponível.</div>
                            ) : (
                              <div className="space-y-1.5">
                                {coordenacoes.map((coord: any) => {
                                  const checked = selected.has(coord.id);
                                  return (
                                    <label key={coord.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded p-1">
                                      <Checkbox
                                        checked={checked}
                                        onCheckedChange={(v) => toggleVinculo(c.id, coord.id, !!v)}
                                      />
                                      <span className="truncate">{coord.nome}</span>
                                    </label>
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
                  <TableCell className="text-right">
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