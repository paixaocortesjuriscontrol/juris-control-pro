import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Bell, CalendarClock, Loader2, Mail, MessageSquare, Save } from "lucide-react";
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
}

const DEFAULT: Config = {
  canal_email: true, canal_whatsapp: true, canal_in_app: true,
  evento_mudanca_situacao: true, evento_prazo_perdido: true, evento_tarefa_nova: true,
  evento_comentario: true, evento_reagendamento: true,
  janela_hora_inicio: 8, janela_hora_fim: 20,
  resumo_diario_ativo: false, resumo_diario_hora: 7,
};

export function ConfigNotificacoesUsuarioCard() {
  const { user } = useAuth();
  const [cfg, setCfg] = useState<Config>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from("config_notificacoes_usuario")
        .select("*")
        .eq("usuario_id", user.id)
        .maybeSingle();
      if (data) setCfg({ ...DEFAULT, ...data });
      setLoading(false);
    })();
  }, [user?.id]);

  async function salvar() {
    if (!user?.id) return;
    setSaving(true);
    const { error } = await supabase
      .from("config_notificacoes_usuario")
      .upsert({ usuario_id: user.id, ...cfg }, { onConflict: "usuario_id" });
    setSaving(false);
    if (error) return toast.error("Erro ao salvar: " + error.message);
    toast.success("Preferências salvas");
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

        </div>
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