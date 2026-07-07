import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { PeoplePicker } from "@/components/shared/PeoplePicker";
import { TIPOS_TAREFA, TIPOS_TAREFA_LABELS } from "@/constants/tiposTarefa";
import { useConfigEnvioAlertas } from "@/hooks/useConfigEnvioAlertas";
import { Mail, MessageSquare, Loader2, Save, Trash2 } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  coordenacaoId: string;
  coordenacaoNome: string;
}

const DIAS_PRESET = [0, 1, 2, 3, 5, 7];
const DIA_LABEL: Record<number, string> = { 0: "No dia", 1: "1 dia antes", 2: "2 dias antes", 3: "3 dias antes", 5: "5 dias antes", 7: "7 dias antes" };

export function ConfigAlertasEnvioDialog({ open, onClose, coordenacaoId, coordenacaoNome }: Props) {
  const { configs, isLoading, salvar, remover } = useConfigEnvioAlertas(coordenacaoId);
  const [tipoSelecionado, setTipoSelecionado] = useState<string>(TIPOS_TAREFA[0]);
  const [canalEmail, setCanalEmail] = useState(false);
  const [canalWhatsApp, setCanalWhatsApp] = useState(false);
  const [diasSelecionados, setDiasSelecionados] = useState<number[]>([0]);
  const [diasCustom, setDiasCustom] = useState("");
  const [destinatarios, setDestinatarios] = useState<string[]>([]);
  const [ativo, setAtivo] = useState(true);

  const configAtual = useMemo(
    () => configs.find((c) => c.tipo_tarefa === tipoSelecionado),
    [configs, tipoSelecionado],
  );

  useEffect(() => {
    if (configAtual) {
      setCanalEmail(configAtual.canal_email);
      setCanalWhatsApp(configAtual.canal_whatsapp);
      const preset = configAtual.dias_antes.filter((d) => DIAS_PRESET.includes(d));
      const extras = configAtual.dias_antes.filter((d) => !DIAS_PRESET.includes(d));
      setDiasSelecionados(preset);
      setDiasCustom(extras.join(", "));
      setDestinatarios(configAtual.destinatarios_ids || []);
      setAtivo(configAtual.ativo);
    } else {
      setCanalEmail(false);
      setCanalWhatsApp(false);
      setDiasSelecionados([0]);
      setDiasCustom("");
      setDestinatarios([]);
      setAtivo(true);
    }
  }, [tipoSelecionado, configAtual]);

  const toggleDia = (dia: number) => {
    setDiasSelecionados((prev) => (prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia]));
  };

  const parseCustomDias = (): number[] => {
    return diasCustom
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n >= 0 && n <= 365);
  };

  const handleSalvar = async () => {
    const dias = Array.from(new Set([...diasSelecionados, ...parseCustomDias()])).sort((a, b) => a - b);
    await salvar.mutateAsync({
      coordenacao_id: coordenacaoId,
      tipo_tarefa: tipoSelecionado,
      canal_email: canalEmail,
      canal_whatsapp: canalWhatsApp,
      dias_antes: dias.length > 0 ? dias : [0],
      destinatarios_ids: destinatarios,
      ativo,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar Alertas de Envio</DialogTitle>
          <DialogDescription>
            {coordenacaoNome} — envio automático de alertas por e-mail e WhatsApp para tarefas, prazos, audiências e eventos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de tarefa</Label>
            <Select value={tipoSelecionado} onValueChange={setTipoSelecionado}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_TAREFA.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TIPOS_TAREFA_LABELS[t] || t}
                    {configs.some((c) => c.tipo_tarefa === t && c.ativo) && (
                      <Badge variant="secondary" className="ml-2 text-[10px]">configurado</Badge>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-semibold">Ativar envio para este tipo</Label>
                  <p className="text-xs text-muted-foreground">Se desativado, nenhum alerta será enviado</p>
                </div>
                <Switch checked={ativo} onCheckedChange={setAtivo} />
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Canais</Label>
                <div className="flex gap-3 flex-wrap">
                  <label className="flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer hover:bg-muted/30">
                    <Checkbox checked={canalEmail} onCheckedChange={(c) => setCanalEmail(!!c)} />
                    <Mail className="w-4 h-4" /> E-mail
                  </label>
                  <label className="flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer hover:bg-muted/30">
                    <Checkbox checked={canalWhatsApp} onCheckedChange={(c) => setCanalWhatsApp(!!c)} />
                    <MessageSquare className="w-4 h-4" /> WhatsApp
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Quando enviar</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {DIAS_PRESET.map((d) => (
                    <label key={d} className="flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer hover:bg-muted/30">
                      <Checkbox checked={diasSelecionados.includes(d)} onCheckedChange={() => toggleDia(d)} />
                      <span className="text-sm">{DIA_LABEL[d]}</span>
                    </label>
                  ))}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Personalizado (dias antes, separados por vírgula)</Label>
                  <Input
                    placeholder="Ex.: 10, 15, 30"
                    value={diasCustom}
                    onChange={(e) => setDiasCustom(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Destinatários</Label>
                <PeoplePicker
                  selectedIds={destinatarios}
                  onChange={setDestinatarios}
                  placeholder="Selecione os membros que receberão alertas"
                  icon="users"
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between pt-2 border-t">
            <div>
              {configAtual && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => remover.mutate(configAtual.id)}
                  disabled={remover.isPending}
                  className="text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4 mr-1" /> Remover configuração
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Fechar</Button>
              <Button onClick={handleSalvar} disabled={salvar.isPending || isLoading}>
                {salvar.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                Salvar
              </Button>
            </div>
          </div>

          {configs.length > 0 && (
            <div className="pt-2">
              <Label className="text-xs text-muted-foreground">Configurações existentes ({configs.length})</Label>
              <ScrollArea className="max-h-32 mt-1">
                <div className="flex flex-wrap gap-1">
                  {configs.map((c) => (
                    <Badge
                      key={c.id}
                      variant={c.tipo_tarefa === tipoSelecionado ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => setTipoSelecionado(c.tipo_tarefa)}
                    >
                      {TIPOS_TAREFA_LABELS[c.tipo_tarefa] || c.tipo_tarefa}
                      {c.ativo ? " ✓" : " ✗"}
                    </Badge>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
