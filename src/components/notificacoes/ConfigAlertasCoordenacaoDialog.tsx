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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Mail, 
  MessageCircle, 
  Plus, 
  X, 
  Clock, 
  Calendar,
  Loader2,
  AlertTriangle
} from "lucide-react";
import { 
  useConfigAlertasCoordenacao, 
  ConfigAlertaCoordenacao,
  TIPOS_ALERTA,
  DIAS_SEMANA 
} from "@/hooks/useConfigAlertasCoordenacao";

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
  const [emails, setEmails] = useState<string[]>([]);
  const [telefones, setTelefones] = useState<string[]>([]);
  const [tiposAlerta, setTiposAlerta] = useState<string[]>([]);
  const [apenasUrgentes, setApenasUrgentes] = useState(false);
  const [horarioInicio, setHorarioInicio] = useState('08:00');
  const [horarioFim, setHorarioFim] = useState('18:00');
  const [diasSemana, setDiasSemana] = useState<number[]>([1, 2, 3, 4, 5]);
  
  const [novoEmail, setNovoEmail] = useState('');
  const [novoTelefone, setNovoTelefone] = useState('');

  // Carregar config existente
  useEffect(() => {
    if (open) {
      const config = getConfigByCoordenacao(coordenacaoId);
      if (config) {
        setEmailHabilitado(config.email_habilitado);
        setWhatsappHabilitado(config.whatsapp_habilitado);
        setEmails(config.emails_destinatarios || []);
        setTelefones(config.telefones_whatsapp || []);
        setTiposAlerta(config.tipos_alerta || []);
        setApenasUrgentes(config.apenas_urgentes);
        setHorarioInicio(config.horario_inicio || '08:00');
        setHorarioFim(config.horario_fim || '18:00');
        setDiasSemana(config.dias_semana || [1, 2, 3, 4, 5]);
      } else {
        // Reset para defaults
        setEmailHabilitado(false);
        setWhatsappHabilitado(false);
        setEmails([]);
        setTelefones([]);
        setTiposAlerta(['alertas360', 'prazos', 'redistribuicoes']);
        setApenasUrgentes(false);
        setHorarioInicio('08:00');
        setHorarioFim('18:00');
        setDiasSemana([1, 2, 3, 4, 5]);
      }
    }
  }, [open, coordenacaoId, getConfigByCoordenacao]);

  const handleAddEmail = () => {
    if (novoEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(novoEmail)) {
      if (!emails.includes(novoEmail)) {
        setEmails([...emails, novoEmail]);
      }
      setNovoEmail('');
    }
  };

  const handleAddTelefone = () => {
    const tel = novoTelefone.replace(/\D/g, '');
    if (tel.length >= 10) {
      if (!telefones.includes(tel)) {
        setTelefones([...telefones, tel]);
      }
      setNovoTelefone('');
    }
  };

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
      emails_destinatarios: emails,
      telefones_whatsapp: telefones,
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
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Configurar Alertas - {coordenacaoNome}
          </DialogTitle>
          <DialogDescription>
            Configure como e quando esta coordenação receberá alertas automáticos
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Canais */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                Canais de Notificação
              </h4>
              
              {/* Email */}
              <div className={`space-y-3 p-4 rounded-lg border transition-all ${
                emailHabilitado ? 'border-blue-500/50 bg-blue-500/5' : 'bg-muted/30'
              }`}>
                <div className="flex items-center justify-between">
                  <Label htmlFor="email-switch" className="flex items-center gap-2 cursor-pointer">
                    <Mail className={`h-4 w-4 ${emailHabilitado ? 'text-blue-500' : 'text-muted-foreground'}`} />
                    <span className="font-medium">E-mail</span>
                    {!emailHabilitado && (
                      <span className="text-xs text-muted-foreground">(clique para ativar)</span>
                    )}
                  </Label>
                  <Switch 
                    id="email-switch"
                    checked={emailHabilitado} 
                    onCheckedChange={setEmailHabilitado} 
                  />
                </div>
                
                {emailHabilitado && (
                  <div className="space-y-2 pt-2 border-t border-blue-500/20">
                    <Label className="text-sm font-medium">Destinatários de E-mail</Label>
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        placeholder="email@exemplo.com"
                        value={novoEmail}
                        onChange={(e) => setNovoEmail(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddEmail()}
                        className="flex-1"
                      />
                      <Button type="button" size="icon" onClick={handleAddEmail} variant="secondary">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {emails.length === 0 && (
                      <p className="text-xs text-amber-600">⚠️ Adicione pelo menos um e-mail para receber alertas</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {emails.map((email) => (
                        <Badge key={email} variant="secondary" className="gap-1 bg-blue-500/10">
                          {email}
                          <X 
                            className="h-3 w-3 cursor-pointer hover:text-destructive" 
                            onClick={() => setEmails(emails.filter(e => e !== email))}
                          />
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* WhatsApp */}
              <div className={`space-y-3 p-4 rounded-lg border transition-all ${
                whatsappHabilitado ? 'border-green-500/50 bg-green-500/5' : 'bg-muted/30'
              }`}>
                <div className="flex items-center justify-between">
                  <Label htmlFor="whatsapp-switch" className="flex items-center gap-2 cursor-pointer">
                    <MessageCircle className={`h-4 w-4 ${whatsappHabilitado ? 'text-green-500' : 'text-muted-foreground'}`} />
                    <span className="font-medium">WhatsApp</span>
                    {!whatsappHabilitado && (
                      <span className="text-xs text-muted-foreground">(clique para ativar)</span>
                    )}
                  </Label>
                  <Switch 
                    id="whatsapp-switch"
                    checked={whatsappHabilitado} 
                    onCheckedChange={setWhatsappHabilitado} 
                  />
                </div>
                
                {whatsappHabilitado && (
                  <div className="space-y-2 pt-2 border-t border-green-500/20">
                    <Label className="text-sm font-medium">Telefones (com DDD)</Label>
                    <div className="flex gap-2">
                      <Input
                        type="tel"
                        placeholder="(11) 99999-9999"
                        value={novoTelefone}
                        onChange={(e) => setNovoTelefone(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddTelefone()}
                        className="flex-1"
                      />
                      <Button type="button" size="icon" onClick={handleAddTelefone} variant="secondary">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {telefones.length === 0 && (
                      <p className="text-xs text-amber-600">⚠️ Adicione pelo menos um telefone para receber alertas</p>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {telefones.map((tel) => (
                        <Badge key={tel} variant="secondary" className="gap-1 bg-green-500/10">
                          {tel.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')}
                          <X 
                            className="h-3 w-3 cursor-pointer hover:text-destructive" 
                            onClick={() => setTelefones(telefones.filter(t => t !== tel))}
                          />
                        </Badge>
                      ))}
                    </div>
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
                  <div
                    key={tipo.value}
                    className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
                      tiposAlerta.includes(tipo.value)
                        ? 'border-primary bg-primary/10'
                        : 'border-muted hover:border-muted-foreground/50'
                    }`}
                    onClick={() => toggleTipoAlerta(tipo.value)}
                  >
                    <Checkbox 
                      checked={tiposAlerta.includes(tipo.value)} 
                      onCheckedChange={() => toggleTipoAlerta(tipo.value)}
                    />
                    <span className="text-lg">{tipo.icon}</span>
                    <span className="text-sm">{tipo.label}</span>
                  </div>
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
