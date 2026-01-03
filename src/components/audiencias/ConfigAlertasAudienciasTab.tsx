import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, Mail, MessageCircle, Clock, Save, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const LEMBRETES_OPCOES = [
  { value: 15, label: "15 minutos antes" },
  { value: 30, label: "30 minutos antes" },
  { value: 60, label: "1 hora antes" },
  { value: 120, label: "2 horas antes" },
  { value: 1440, label: "1 dia antes" },
  { value: 2880, label: "2 dias antes" },
  { value: 4320, label: "3 dias antes" },
];

interface ConfigAlertas {
  id: string;
  enviar_whatsapp_criacao: boolean;
  enviar_email_criacao: boolean;
  lembretes_minutos: number[];
}

export function ConfigAlertasAudienciasTab() {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<ConfigAlertas>({
    id: "",
    enviar_whatsapp_criacao: true,
    enviar_email_criacao: false,
    lembretes_minutos: [1440, 60],
  });

  const { data: configData, isLoading } = useQuery({
    queryKey: ["config-alertas-audiencias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("config_alertas_audiencias")
        .select("*")
        .limit(1)
        .single();
      
      if (error) {
        // Se não existir, criar registro padrão
        if (error.code === "PGRST116") {
          const { data: newConfig, error: insertError } = await supabase
            .from("config_alertas_audiencias")
            .insert({
              enviar_whatsapp_criacao: true,
              enviar_email_criacao: false,
              lembretes_minutos: [1440, 60],
            })
            .select()
            .single();
          
          if (insertError) throw insertError;
          return newConfig;
        }
        throw error;
      }
      return data;
    },
  });

  useEffect(() => {
    if (configData) {
      setConfig({
        id: configData.id,
        enviar_whatsapp_criacao: configData.enviar_whatsapp_criacao,
        enviar_email_criacao: configData.enviar_email_criacao,
        lembretes_minutos: configData.lembretes_minutos || [1440, 60],
      });
    }
  }, [configData]);

  const salvarConfig = useMutation({
    mutationFn: async (novaConfig: ConfigAlertas) => {
      const { error } = await supabase
        .from("config_alertas_audiencias")
        .update({
          enviar_whatsapp_criacao: novaConfig.enviar_whatsapp_criacao,
          enviar_email_criacao: novaConfig.enviar_email_criacao,
          lembretes_minutos: novaConfig.lembretes_minutos,
        })
        .eq("id", novaConfig.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["config-alertas-audiencias"] });
      toast.success("Configurações salvas com sucesso!");
    },
    onError: (error) => {
      console.error("Erro ao salvar configurações:", error);
      toast.error("Erro ao salvar configurações");
    },
  });

  const toggleLembrete = (minutos: number) => {
    setConfig(prev => ({
      ...prev,
      lembretes_minutos: prev.lembretes_minutos.includes(minutos)
        ? prev.lembretes_minutos.filter(m => m !== minutos)
        : [...prev.lembretes_minutos, minutos].sort((a, b) => b - a),
    }));
  };

  const handleSalvar = () => {
    salvarConfig.mutate(config);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alertas ao Criar Audiência */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Alertas ao Criar Audiência
          </CardTitle>
          <CardDescription>
            Configure quais notificações serão enviadas automaticamente quando uma nova audiência for criada
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageCircle className="h-5 w-5 text-green-500" />
              <div>
                <Label htmlFor="whatsapp-criacao" className="font-medium">WhatsApp</Label>
                <p className="text-sm text-muted-foreground">
                  Enviar notificação via WhatsApp aos responsáveis
                </p>
              </div>
            </div>
            <Switch
              id="whatsapp-criacao"
              checked={config.enviar_whatsapp_criacao}
              onCheckedChange={(checked) => setConfig({ ...config, enviar_whatsapp_criacao: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-blue-500" />
              <div>
                <Label htmlFor="email-criacao" className="font-medium">E-mail</Label>
                <p className="text-sm text-muted-foreground">
                  Enviar notificação por e-mail aos responsáveis
                </p>
              </div>
            </div>
            <Switch
              id="email-criacao"
              checked={config.enviar_email_criacao}
              onCheckedChange={(checked) => setConfig({ ...config, enviar_email_criacao: checked })}
            />
          </div>

          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Destinatários:</strong> Os alertas serão enviados ao advogado responsável cadastrado na audiência 
              e ao criador da audiência (se tiver telefone/email cadastrado no perfil).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Lembretes Automáticos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Lembretes Automáticos
          </CardTitle>
          <CardDescription>
            Configure quando os lembretes serão enviados antes da audiência (similar aos eventos da agenda)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {LEMBRETES_OPCOES.map((opcao) => (
              <div
                key={opcao.value}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  config.lembretes_minutos.includes(opcao.value)
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                }`}
                onClick={() => toggleLembrete(opcao.value)}
              >
                <Checkbox
                  checked={config.lembretes_minutos.includes(opcao.value)}
                  onCheckedChange={() => toggleLembrete(opcao.value)}
                />
                <Label className="cursor-pointer flex-1">{opcao.label}</Label>
              </div>
            ))}
          </div>

          {config.lembretes_minutos.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              <span className="text-sm text-muted-foreground">Lembretes configurados:</span>
              {config.lembretes_minutos
                .sort((a, b) => b - a)
                .map((minutos) => {
                  const opcao = LEMBRETES_OPCOES.find(o => o.value === minutos);
                  return (
                    <Badge key={minutos} variant="secondary">
                      {opcao?.label || `${minutos} min`}
                    </Badge>
                  );
                })}
            </div>
          )}

          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Como funciona:</strong> Os lembretes serão enviados via WhatsApp (se ativado acima) 
              no tempo configurado antes da audiência. Por exemplo, se você selecionou "1 dia antes", 
              o lembrete será enviado exatamente 24 horas antes do horário da audiência.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Botão Salvar */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSalvar} 
          disabled={salvarConfig.isPending}
          size="lg"
        >
          {salvarConfig.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}
