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