import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, CalendarClock, Loader2, Mail, MessageSquare, RotateCcw, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Config {
  canal_email: boolean;
  canal_whatsapp: boolean;
  canal_in_app: boolean;
  evento_mudanca_situacao: boolean;
  evento_prazo_perdido: boolean;
  evento_tarefa_nova: boolean;
  evento_comentario: boolean;
  evento_reagendamento: boolean;
  janela_hora_inicio: number;
  janela_hora_fim: number;
  resumo_diario_ativo: boolean;
  resumo_diario_hora: number;
  ativo: boolean;
}

const DEFAULT: Config = {
  canal_email: true, canal_whatsapp: true, canal_in_app: true,
  evento_mudanca_situacao: true, evento_prazo_perdido: true, evento_tarefa_nova: true,
  evento_comentario: true, evento_reagendamento: true,
  janela_hora_inicio: 8, janela_hora_fim: 20,
  resumo_diario_ativo: false, resumo_diario_hora: 7,
  ativo: true,
};

const CAMPOS = Object.keys(DEFAULT) as (keyof Config)[];
const PADRAO = "__padrao__";

function pick(row: any): Config {
  const c: any = { ...DEFAULT };
  for (const k of CAMPOS) if (row?.[k] !== undefined && row?.[k] !== null) c[k] = row[k];
  return c;
}

export function ConfigNotificacoesUsuarioCard() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [coords, setCoords] = useState<{ id: string; nome: string }[]>([]);
  const [sel, setSel] = useState<string>(PADRAO);
  const [cfg, setCfg] = useState<Config>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function carregar() {
    if (!user?.id) return;
    const [{ data: cfgs }, { data: membros }] = await Promise.all([
      supabase.from("config_notificacoes_usuario").select("*").eq("usuario_id", user.id),
      supabase.from("membros_coordenacao").select("coordenacao_id, coordenacao:coordenacoes(id, nome)").eq("usuario_id", user.id),
    ]);
    setRows(cfgs || []);
    const lista = ((membros || []) as any[])
      .map((m) => m.coordenacao)
      .filter(Boolean)
      .filter((c, i, arr) => arr.findIndex((x: any) => x.id === c.id) === i)
      .sort((a: any, b: any) => String(a.nome).localeCompare(String(b.nome)));
    setCoords(lista);
    setLoading(false);
    return cfgs || [];
  }

  useEffect(() => { carregar(); }, [user?.id]);

  const padraoRow = rows.find((r) => !r.coordenacao_id);
  const especifica = sel === PADRAO ? null : rows.find((r) => r.coordenacao_id === sel);
  const multiplas = coords.length > 1;

  useEffect(() => {
    if (sel === PADRAO) setCfg(pick(padraoRow));
    else setCfg(pick(especifica ?? padraoRow));
  }, [sel, JSON.stringify(rows)]);

  async function salvar() {
    if (!user?.id) return;
    setSaving(true);
    const coordenacao_id = sel === PADRAO ? null : sel;
    const existente = sel === PADRAO ? padraoRow : especifica;
    const payload: any = { usuario_id: user.id, coordenacao_id, ...cfg };
    const { error } = existente
      ? await supabase.from("config_notificacoes_usuario").update(payload).eq("id", existente.id)
      : await supabase.from("config_notificacoes_usuario").insert(payload);
    setSaving(false);
    if (error) return toast.error("Erro ao salvar: " + error.message);
    await carregar();
    toast.success("Preferências salvas");
  }

  async function voltarPadrao() {
    if (!especifica) return;
    const { error } = await supabase.from("config_notificacoes_usuario").delete().eq("id", especifica.id);
    if (error) return toast.error("Erro: " + error.message);
    await carregar();
    toast.success("Esta coordenação voltou a seguir o padrão");
  }

  function bind<K extends keyof Config>(k: K) {
    return {
      checked: cfg[k] as boolean,
      onCheckedChange: (v: boolean) => setCfg((c) => ({ ...c, [k]: v })),
    };
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const desligada = sel !== PADRAO && !cfg.ativo;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-4">
        <div className="p-2 rounded-lg bg-primary/10">
          <Bell className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1">
          <CardTitle className="text-lg">Meu perfil de notificações</CardTitle>
          <CardDescription>
            Escolha por quais canais e para quais eventos você quer ser avisado
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {multiplas && (
          <div className="rounded-md border p-3 space-y-3">
            <Label className="text-sm font-semibold">Coordenação</Label>
            <Select value={sel} onValueChange={setSel}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={PADRAO}>Padrão (todas as coordenações)</SelectItem>
                {coords.map((c) => {
                  const pers = rows.some((r) => r.coordenacao_id === c.id);
                  return (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome} {pers ? "· Personalizada" : "· Padrão"}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {sel !== PADRAO && (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Badge variant={especifica ? "default" : "secondary"}>
                    {especifica ? "Personalizada" : "Seguindo o padrão"}
                  </Badge>
                  {especifica && (
                    <Button variant="ghost" size="sm" onClick={voltarPadrao}>
                      <RotateCcw className="h-4 w-4 mr-1" /> Voltar ao padrão
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Label className="font-normal">Receber avisos desta coordenação</Label>
                  <Switch {...bind("ativo")} />
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              O padrão vale para as coordenações sem personalização e para itens sem coordenação.
            </p>
          </div>
        )}

        <div className={desligada ? "opacity-50 pointer-events-none space-y-6" : "space-y-6"}>
          <div>
            <h4 className="text-sm font-semibold mb-3">Canais</h4>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex items-center justify-between rounded-md border p-3">
                <Label className="flex items-center gap-2"><Mail className="h-4 w-4" /> E-mail</Label>
                <Switch {...bind("canal_email")} />
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <Label className="flex items-center gap-2"><MessageSquare className="h-4 w-4" /> WhatsApp</Label>
                <Switch {...bind("canal_whatsapp")} />
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <Label className="flex items-center gap-2"><Bell className="h-4 w-4" /> No sistema</Label>
                <Switch {...bind("canal_in_app")} />
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-3">Tipos de evento</h4>
            <div className="space-y-3">
              {[
                ["evento_mudanca_situacao", "Mudança de situação (tarefa, evento, audiência, parcela)"],
                ["evento_prazo_perdido", "Prazo perdido (lembrete diário)"],
                ["evento_tarefa_nova", "Nova tarefa atribuída a mim"],
                ["evento_comentario", "Novo comentário em item meu"],
                ["evento_reagendamento", "Reagendamento de audiência"],
              ].map(([k, label]) => (
                <div key={k} className="flex items-center justify-between">
                  <Label className="font-normal">{label}</Label>
                  <Switch {...bind(k as keyof Config)} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-3">Janela de envio (horário de Brasília)</h4>
            <div className="flex items-center gap-3">
              <Label className="text-sm">Das</Label>
              <Input type="number" min={0} max={23} value={cfg.janela_hora_inicio}
                onChange={(e) => setCfg((c) => ({ ...c, janela_hora_inicio: Math.max(0, Math.min(23, Number(e.target.value) || 0)) }))}
                className="w-20" />
              <Label className="text-sm">até</Label>
              <Input type="number" min={0} max={23} value={cfg.janela_hora_fim}
                onChange={(e) => setCfg((c) => ({ ...c, janela_hora_fim: Math.max(0, Math.min(23, Number(e.target.value) || 0)) }))}
                className="w-20" />
              <span className="text-sm text-muted-foreground">horas</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Avisos fora dessa janela não são disparados (evita mensagens à noite).
            </p>
          </div>

          <div className="rounded-md border p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Label className="flex items-center gap-2 font-normal">
                <CalendarClock className="h-4 w-4" />
                {sel === PADRAO ? "Resumo diário da minha agenda por e-mail" : "Incluir esta coordenação no resumo diário"}
              </Label>
              <Switch {...bind("resumo_diario_ativo")} />
            </div>
            {sel === PADRAO && (
              <div className="flex items-center gap-3">
                <Label className="text-sm">Enviar às</Label>
                <Input
                  type="number" min={0} max={23}
                  value={cfg.resumo_diario_hora}
                  disabled={!cfg.resumo_diario_ativo}
                  onChange={(e) => setCfg((c) => ({ ...c, resumo_diario_hora: Math.max(0, Math.min(23, Number(e.target.value) || 0)) }))}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">horas (Brasília)</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {sel === PADRAO
                ? "Todo dia você recebe um e-mail com todas as suas atividades do dia (prazos, audiências, eventos, tarefas e parcelas), com processo, partes, cliente, situação, local, horários, responsáveis, envolvidos e observações."
                : "O resumo é um único e-mail, no horário do padrão. Desligue aqui para não incluir os itens desta coordenação."}
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={salvar} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar preferências
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
