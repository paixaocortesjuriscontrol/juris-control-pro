import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Mail, 
  MessageCircle, 
  Clock, 
  Calendar,
  Loader2,
  AlertTriangle,
  Users,
  Info
} from "lucide-react";
import { 
  useConfigAlertasCoordenacao, 
  TIPOS_ALERTA,
  DIAS_SEMANA 
} from "@/hooks/useConfigAlertasCoordenacao";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coordenacaoId: string;
  coordenacaoNome: string;
}

export function ConfigAlertasCoordenacaoDialog({ 
  open, 
  onOpenChange, 
  coordenacaoId, 
  coordenacaoNome 
}: Props) {
  const { getConfigByCoordenacao, salvarConfig } = useConfigAlertasCoordenacao();
  
  const [emailHabilitado, setEmailHabilitado] = useState(false);
  const [whatsappHabilitado, setWhatsappHabilitado] = useState(false);
  const [tiposAlerta, setTiposAlerta] = useState<string[]>([]);
  const [apenasUrgentes, setApenasUrgentes] = useState(false);
  const [horarioInicio, setHorarioInicio] = useState('08:00');
  const [horarioFim, setHorarioFim] = useState('18:00');
  const [diasSemana, setDiasSemana] = useState<number[]>([1, 2, 3, 4, 5]);

  // Evita que refetch/re-render do hook resete o estado enquanto o usuário está editando
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Carregar config existente
  useEffect(() => {
    if (!open) {
      if (loadedFor !== null) setLoadedFor(null);
      return;
    }

    // Carrega apenas 1x por abertura/coordenação (não reseta enquanto edita)
    if (loadedFor === coordenacaoId) return;

    const config = getConfigByCoordenacao(coordenacaoId);
    if (config) {
      setEmailHabilitado(config.email_habilitado);
      setWhatsappHabilitado(config.whatsapp_habilitado);
      setTiposAlerta(config.tipos_alerta || []);
      setApenasUrgentes(config.apenas_urgentes);
      setHorarioInicio(config.horario_inicio || '08:00');
      setHorarioFim(config.horario_fim || '18:00');
      setDiasSemana(config.dias_semana || [1, 2, 3, 4, 5]);
    } else {
      // Reset para defaults
      setEmailHabilitado(false);
      setWhatsappHabilitado(false);
      setTiposAlerta(['alertas360', 'prazos', 'redistribuicoes']);
      setApenasUrgentes(false);
      setHorarioInicio('08:00');
      setHorarioFim('18:00');
      setDiasSemana([1, 2, 3, 4, 5]);
    }

    setLoadedFor(coordenacaoId);
  }, [open, coordenacaoId, getConfigByCoordenacao, loadedFor]);

  const toggleTipoAlerta = (tipo: string) => {
    if (tiposAlerta.includes(tipo)) {
      setTiposAlerta(tiposAlerta.filter(t => t !== tipo));
    } else {
      setTiposAlerta([...tiposAlerta, tipo]);
    }
  };

  const toggleDiaSemana = (dia: number) => {
    if (diasSemana.includes(dia)) {
      setDiasSemana(diasSemana.filter(d => d !== dia));
    } else {
      setDiasSemana([...diasSemana, dia].sort());
    }
  };

  const handleSalvar = () => {
    salvarConfig.mutate({
      coordenacao_id: coordenacaoId,
      email_habilitado: emailHabilitado,
      whatsapp_habilitado: whatsappHabilitado,
      tipos_alerta: tiposAlerta,
      apenas_urgentes: apenasUrgentes,
      horario_inicio: horarioInicio,
      horario_fim: horarioFim,
      dias_semana: diasSemana,
    }, {
      onSuccess: () => onOpenChange(false),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" />
            Configurar Alertas - {coordenacaoNome}
          </DialogTitle>
          <DialogDescription>
            Configure como e quando esta coordenação receberá alertas automáticos
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Informação sobre destinatários */}
            <Alert>
              <Users className="h-4 w-4" />
              <AlertDescription>
                <strong>Destinatários:</strong> Os alertas serão enviados automaticamente para todos os <strong>membros da coordenação</strong> que possuem e-mail e/ou telefone cadastrados no perfil.
              </AlertDescription>
            </Alert>

            {/* Canais */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                Canais de Notificação
              </h4>
              
              {/* Email */}
              <div
                className={`space-y-3 p-4 rounded-lg border transition-all cursor-pointer ${
                  emailHabilitado ? 'border-primary/50 bg-primary/5' : 'bg-muted/30 hover:bg-muted/50'
                }`}
                onClick={() => !emailHabilitado && setEmailHabilitado(true)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className={`h-4 w-4 ${emailHabilitado ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className="font-medium">E-mail</span>
                    {!emailHabilitado && (
                      <span className="text-xs text-muted-foreground">(clique aqui para ativar)</span>
                    )}
                  </div>
                  <Switch 
                    checked={emailHabilitado} 
                    onCheckedChange={(checked) => {
                      setEmailHabilitado(checked);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                
                {emailHabilitado && (
                  <div className="pt-2 border-t border-primary/20" onClick={(e) => e.stopPropagation()}>
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Info className="h-4 w-4" />
                      Será enviado para os e-mails cadastrados nos perfis dos membros
                    </p>
                  </div>
                )}
              </div>

              {/* WhatsApp */}
              <div
                className={`space-y-3 p-4 rounded-lg border transition-all cursor-pointer ${
                  whatsappHabilitado ? 'border-primary/50 bg-primary/5' : 'bg-muted/30 hover:bg-muted/50'
                }`}
                onClick={() => !whatsappHabilitado && setWhatsappHabilitado(true)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageCircle className={`h-4 w-4 ${whatsappHabilitado ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className="font-medium">WhatsApp</span>
                    {!whatsappHabilitado && (
                      <span className="text-xs text-muted-foreground">(clique aqui para ativar)</span>
                    )}
                  </div>
                  <Switch 
                    checked={whatsappHabilitado} 
                    onCheckedChange={(checked) => {
                      setWhatsappHabilitado(checked);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                
                {whatsappHabilitado && (
                  <div className="pt-2 border-t border-primary/20" onClick={(e) => e.stopPropagation()}>
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Info className="h-4 w-4" />
                      Será enviado para os telefones cadastrados nos perfis dos membros
                    </p>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Tipos de Alerta */}
            <div className="space-y-3">
              <h4 className="font-medium">Tipos de Alertas</h4>
              <div className="grid grid-cols-2 gap-2">
                {TIPOS_ALERTA.map((tipo) => (
                  <Label
                    key={tipo.value}
                    htmlFor={`tipo-alerta-${tipo.value}`}
                    className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                      tiposAlerta.includes(tipo.value)
                        ? 'border-primary bg-primary/10'
                        : 'border-muted hover:border-muted-foreground/50'
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
                  Enviar apenas alertas com prioridade <strong>Urgente</strong> ou <strong>Alta</strong>
                </Label>
              </div>
            </div>

            <Separator />

            {/* Horário e Dias */}
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

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSalvar}
            disabled={salvarConfig.isPending || (!emailHabilitado && !whatsappHabilitado)}
          >
            {salvarConfig.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar Configuração
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
