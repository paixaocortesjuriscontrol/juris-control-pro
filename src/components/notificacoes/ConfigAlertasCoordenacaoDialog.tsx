import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PeoplePicker } from "@/components/shared/PeoplePicker";
import { useConfigEnvioAlertas } from "@/hooks/useConfigEnvioAlertas";
import {
  Mail,
  MessageCircle,
  MessageSquare,
  Clock,
  Calendar,
  Loader2,
  AlertTriangle,
  Users,
  Info,
  Save,
  Trash2,
  BellRing,
  ClipboardList,
  X,
} from "lucide-react";
import {
  useConfigAlertasCoordenacao,
  TIPOS_ALERTA,
  DIAS_SEMANA,
} from "@/hooks/useConfigAlertasCoordenacao";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Props {
  coordenacaoId: string;
  coordenacaoNome: string;
  onClose: () => void;
}

const TIPOS_ENVIO = ["PRAZO", "TAREFA EQUIPE", "AUDIÊNCIA", "PARCELAMENTO RECORRENTE"] as const;
const TIPOS_ENVIO_LABELS: Record<string, string> = {
  "PRAZO": "Prazo",
  "TAREFA EQUIPE": "Tarefa",
  "AUDIÊNCIA": "Audiência",
  "PARCELAMENTO RECORRENTE": "Parcelamento Recorrente",
};
const DIAS_PRESET = [0, 1, 2, 3, 5, 7];
const DIA_LABEL: Record<number, string> = {
  0: "No dia",
  1: "1 dia antes",
  2: "2 dias antes",
  3: "3 dias antes",
  5: "5 dias antes",
  7: "7 dias antes",
};

export function ConfigAlertasCoordenacaoPanel({
  coordenacaoId,
  coordenacaoNome,
  onClose,
}: Props) {
  const { getConfigByCoordenacao, salvarConfig } = useConfigAlertasCoordenacao();

  // ---------------- Aba "Notificações do Painel" ----------------
  const [emailHabilitado, setEmailHabilitado] = useState(false);
  const [whatsappHabilitado, setWhatsappHabilitado] = useState(false);
  const [tiposAlerta, setTiposAlerta] = useState<string[]>([]);
  const [apenasUrgentes, setApenasUrgentes] = useState(false);
  const [horarioInicio, setHorarioInicio] = useState("08:00");
  const [horarioFim, setHorarioFim] = useState("18:00");
  const [diasSemana, setDiasSemana] = useState<number[]>([1, 2, 3, 4, 5]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  useEffect(() => {
    if (loadedFor === coordenacaoId) return;
    const config = getConfigByCoordenacao(coordenacaoId);
    if (config) {
      setEmailHabilitado(config.email_habilitado);
      setWhatsappHabilitado(config.whatsapp_habilitado);
      setTiposAlerta(config.tipos_alerta || []);
      setApenasUrgentes(config.apenas_urgentes);
      setHorarioInicio(config.horario_inicio || "08:00");
      setHorarioFim(config.horario_fim || "18:00");
      setDiasSemana(config.dias_semana || [1, 2, 3, 4, 5]);
    } else {
      setEmailHabilitado(false);
      setWhatsappHabilitado(false);
      setTiposAlerta(["alertas360", "prazos", "redistribuicoes"]);
      setApenasUrgentes(false);
      setHorarioInicio("08:00");
      setHorarioFim("18:00");
      setDiasSemana([1, 2, 3, 4, 5]);
    }
    setLoadedFor(coordenacaoId);
  }, [coordenacaoId, getConfigByCoordenacao, loadedFor]);

  const toggleTipoAlerta = (tipo: string) => {
    setTiposAlerta((prev) =>
      prev.includes(tipo) ? prev.filter((t) => t !== tipo) : [...prev, tipo]
    );
  };
  const toggleDiaSemana = (dia: number) => {
    setDiasSemana((prev) =>
      prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia].sort()
    );
  };
  const handleSalvarPainel = () => {
    salvarConfig.mutate(
      {
        coordenacao_id: coordenacaoId,
        email_habilitado: emailHabilitado,
        whatsapp_habilitado: whatsappHabilitado,
        tipos_alerta: tiposAlerta,
        apenas_urgentes: apenasUrgentes,
        horario_inicio: horarioInicio,
        horario_fim: horarioFim,
        dias_semana: diasSemana,
      },
      { onSuccess: () => onClose() }
    );
  };

  // ---------------- Aba "Envios (Prazos / Tarefas / Audiências)" ----------------
  const {
    configs: configsEnvio,
    isLoading: loadingEnvio,
    salvar: salvarEnvio,
    remover: removerEnvio,
  } = useConfigEnvioAlertas(coordenacaoId);
  const [tipoSelecionado, setTipoSelecionado] = useState<string>(TIPOS_ENVIO[0]);
  const [envioCanalEmail, setEnvioCanalEmail] = useState(false);
  const [envioCanalWhats, setEnvioCanalWhats] = useState(false);
  const [diasSelecionados, setDiasSelecionados] = useState<number[]>([0]);
  const [diasCustom, setDiasCustom] = useState("");
  const [destinatarios, setDestinatarios] = useState<string[]>([]);
  const [envioAtivo, setEnvioAtivo] = useState(true);

  const configEnvioAtual = useMemo(
    () => configsEnvio.find((c) => c.tipo_tarefa === tipoSelecionado),
    [configsEnvio, tipoSelecionado]
  );

  useEffect(() => {
    if (configEnvioAtual) {
      setEnvioCanalEmail(configEnvioAtual.canal_email);
      setEnvioCanalWhats(configEnvioAtual.canal_whatsapp);
      const preset = configEnvioAtual.dias_antes.filter((d: number) => DIAS_PRESET.includes(d));
      const extras = configEnvioAtual.dias_antes.filter((d: number) => !DIAS_PRESET.includes(d));
      setDiasSelecionados(preset);
      setDiasCustom(extras.join(", "));
      setDestinatarios(configEnvioAtual.destinatarios_ids || []);
      setEnvioAtivo(configEnvioAtual.ativo);
    } else {
      setEnvioCanalEmail(false);
      setEnvioCanalWhats(false);
      setDiasSelecionados([0]);
      setDiasCustom("");
      setDestinatarios([]);
      setEnvioAtivo(true);
    }
  }, [tipoSelecionado, configEnvioAtual]);

  const toggleDia = (dia: number) => {
    setDiasSelecionados((prev) =>
      prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia]
    );
  };
  const parseCustomDias = (): number[] =>
    diasCustom
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n >= 0 && n <= 365);

  const handleSalvarEnvio = async () => {
    const dias = Array.from(new Set([...diasSelecionados, ...parseCustomDias()])).sort(
      (a, b) => a - b
    );
    await salvarEnvio.mutateAsync({
      coordenacao_id: coordenacaoId,
      tipo_tarefa: tipoSelecionado,
      canal_email: envioCanalEmail,
      canal_whatsapp: envioCanalWhats,
      dias_antes: dias.length > 0 ? dias : [0],
      destinatarios_ids: destinatarios,
      ativo: envioAtivo,
    });
  };

  return (
    <Card className="flex flex-col overflow-hidden shadow-lg border-primary/30">
      <CardHeader className="pb-3 shrink-0 bg-muted/30 border-b">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5 text-primary shrink-0" />
              <span className="truncate">Configurar Alertas — {coordenacaoNome}</span>
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Notificações do painel e envios automáticos de prazos, tarefas e audiências.
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose} aria-label="Fechar">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

        <Tabs defaultValue="painel" className="w-full flex-1 min-h-0 flex flex-col">
          <TabsList className="grid grid-cols-2 mx-4 mt-3 mb-2 shrink-0">
            <TabsTrigger value="painel" className="gap-2">
              <BellRing className="h-4 w-4" /> Notificações do Painel
            </TabsTrigger>
            <TabsTrigger value="envios" className="gap-2">
              <ClipboardList className="h-4 w-4" /> Prazos / Tarefas / Audiências
            </TabsTrigger>
          </TabsList>

          {/* ========= ABA 1: NOTIFICAÇÕES DO PAINEL ========= */}
          <TabsContent value="painel" className="flex-1 min-h-0 flex flex-col mt-0">
            <ScrollArea className="flex-1 min-h-0 px-4 max-h-[60vh]">
              <div className="space-y-6 pt-2 pb-4 pr-4">
                <Alert>
                  <Users className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Destinatários:</strong> alertas enviados para todos os{" "}
                    <strong>membros da coordenação</strong> com e-mail e/ou telefone cadastrados.
                  </AlertDescription>
                </Alert>

                {/* Canais */}
                <div className="space-y-4">
                  <h4 className="font-medium">Canais de Notificação</h4>
                  <div
                    className={`space-y-3 p-4 rounded-lg border transition-all cursor-pointer ${
                      emailHabilitado ? "border-primary/50 bg-primary/5" : "bg-muted/30 hover:bg-muted/50"
                    }`}
                    onClick={() => !emailHabilitado && setEmailHabilitado(true)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Mail
                          className={`h-4 w-4 ${emailHabilitado ? "text-primary" : "text-muted-foreground"}`}
                        />
                        <span className="font-medium">E-mail</span>
                      </div>
                      <Switch
                        checked={emailHabilitado}
                        onCheckedChange={setEmailHabilitado}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    {emailHabilitado && (
                      <div
                        className="pt-2 border-t border-primary/20"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                          <Info className="h-4 w-4" />
                          Será enviado para os e-mails cadastrados nos perfis dos membros
                        </p>
                      </div>
                    )}
                  </div>

                  <div
                    className={`space-y-3 p-4 rounded-lg border transition-all cursor-pointer ${
                      whatsappHabilitado ? "border-primary/50 bg-primary/5" : "bg-muted/30 hover:bg-muted/50"
                    }`}
                    onClick={() => !whatsappHabilitado && setWhatsappHabilitado(true)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MessageCircle
                          className={`h-4 w-4 ${whatsappHabilitado ? "text-primary" : "text-muted-foreground"}`}
                        />
                        <span className="font-medium">WhatsApp</span>
                      </div>
                      <Switch
                        checked={whatsappHabilitado}
                        onCheckedChange={setWhatsappHabilitado}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    {whatsappHabilitado && (
                      <div
                        className="pt-2 border-t border-primary/20"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                          <Info className="h-4 w-4" />
                          Será enviado para os telefones cadastrados nos perfis dos membros
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Tipos */}
                <div className="space-y-3">
                  <h4 className="font-medium">Tipos de Alertas</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {TIPOS_ALERTA.map((tipo) => (
                      <Label
                        key={tipo.value}
                        htmlFor={`tipo-alerta-${tipo.value}`}
                        className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                          tiposAlerta.includes(tipo.value)
                            ? "border-primary bg-primary/10"
                            : "border-muted hover:border-muted-foreground/50"
                        }`}
                      >
                        <Checkbox
                          id={`tipo-alerta-${tipo.value}`}
                          checked={tiposAlerta.includes(tipo.value)}
                          onCheckedChange={() => toggleTipoAlerta(tipo.value)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="text-lg">{tipo.icon}</span>
                        <span className="text-sm">{tipo.label}</span>
                      </Label>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <Checkbox
                      id="apenas-urgentes"
                      checked={apenasUrgentes}
                      onCheckedChange={(checked) => setApenasUrgentes(!!checked)}
                    />
                    <Label htmlFor="apenas-urgentes" className="text-sm cursor-pointer">
                      Enviar apenas alertas com prioridade <strong>Urgente</strong> ou{" "}
                      <strong>Alta</strong>
                    </Label>
                  </div>
                </div>

                <Separator />

                {/* Janela */}
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Janela de Envio
                  </h4>
                  <div className="flex items-center gap-4">
                    <div className="space-y-1">
                      <Label className="text-sm">Início</Label>
                      <Input
                        type="time"
                        value={horarioInicio}
                        onChange={(e) => setHorarioInicio(e.target.value)}
                        className="w-32"
                      />
                    </div>
                    <span className="text-muted-foreground mt-6">até</span>
                    <div className="space-y-1">
                      <Label className="text-sm">Fim</Label>
                      <Input
                        type="time"
                        value={horarioFim}
                        onChange={(e) => setHorarioFim(e.target.value)}
                        className="w-32"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Dias da Semana
                    </Label>
                    <div className="flex gap-1">
                      {DIAS_SEMANA.map((dia) => (
                        <Button
                          key={dia.value}
                          type="button"
                          variant={diasSemana.includes(dia.value) ? "default" : "outline"}
                          size="sm"
                          className="w-10"
                          onClick={() => toggleDiaSemana(dia.value)}
                        >
                          {dia.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
            <div className="flex justify-end gap-2 p-3 border-t shrink-0 bg-background">
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button onClick={handleSalvarPainel} disabled={salvarConfig.isPending}>
                {salvarConfig.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar Notificações do Painel
              </Button>
            </div>
          </TabsContent>

          {/* ========= ABA 2: ENVIOS ========= */}
          <TabsContent value="envios" className="flex-1 min-h-0 flex flex-col mt-0">
            <ScrollArea className="flex-1 min-h-0 px-4 max-h-[60vh]">
              <div className="space-y-4 pt-2 pb-4 pr-4">
                <Alert>
                  <Users className="h-4 w-4" />
                  <AlertDescription>
                    Envio automático de e-mail/WhatsApp para <strong>prazos, tarefas, audiências e
                    parcelamentos</strong>. Escolha o tipo, os canais, quando disparar e quem recebe.
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select value={tipoSelecionado} onValueChange={setTipoSelecionado}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS_ENVIO.map((t) => (
                        <SelectItem key={t} value={t}>
                          {TIPOS_ENVIO_LABELS[t] || t}
                          {configsEnvio.some((c) => c.tipo_tarefa === t && c.ativo) && (
                            <Badge variant="secondary" className="ml-2 text-[10px]">
                              configurado
                            </Badge>
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
                        <p className="text-xs text-muted-foreground">
                          Se desativado, nenhum alerta será enviado
                        </p>
                      </div>
                      <Switch checked={envioAtivo} onCheckedChange={setEnvioAtivo} />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm">Canais</Label>
                      <div className="flex gap-3 flex-wrap">
                        <label className="flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer hover:bg-muted/30">
                          <Checkbox
                            checked={envioCanalEmail}
                            onCheckedChange={(c) => setEnvioCanalEmail(!!c)}
                          />
                          <Mail className="w-4 h-4" /> E-mail
                        </label>
                        <label className="flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer hover:bg-muted/30">
                          <Checkbox
                            checked={envioCanalWhats}
                            onCheckedChange={(c) => setEnvioCanalWhats(!!c)}
                          />
                          <MessageSquare className="w-4 h-4" /> WhatsApp
                        </label>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm">Quando enviar</Label>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {DIAS_PRESET.map((d) => (
                          <label
                            key={d}
                            className="flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer hover:bg-muted/30"
                          >
                            <Checkbox
                              checked={diasSelecionados.includes(d)}
                              onCheckedChange={() => toggleDia(d)}
                            />
                            <span className="text-sm">{DIA_LABEL[d]}</span>
                          </label>
                        ))}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">
                          Personalizado (dias antes, separados por vírgula)
                        </Label>
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

                {configsEnvio.length > 0 && (
                  <div className="pt-1">
                    <Label className="text-xs text-muted-foreground">
                      Configurações existentes ({configsEnvio.length})
                    </Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {configsEnvio.map((c) => (
                        <Badge
                          key={c.id}
                          variant={c.tipo_tarefa === tipoSelecionado ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => setTipoSelecionado(c.tipo_tarefa)}
                        >
                          {TIPOS_ENVIO_LABELS[c.tipo_tarefa] || c.tipo_tarefa}
                          {c.ativo ? " ✓" : " ✗"}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
            <div className="flex flex-wrap gap-2 p-3 border-t shrink-0 bg-background justify-between">
              <div>
                {configEnvioAtual && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removerEnvio.mutate(configEnvioAtual.id)}
                    disabled={removerEnvio.isPending}
                    className="text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4 mr-1" /> Remover
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>
                  Fechar
                </Button>
                <Button
                  onClick={handleSalvarEnvio}
                  disabled={salvarEnvio.isPending || loadingEnvio}
                >
                  {salvarEnvio.isPending ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-1" />
                  )}
                  Salvar Alertas
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
    </Card>
  );
}