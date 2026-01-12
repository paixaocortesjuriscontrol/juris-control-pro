import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Mail, Loader2, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function NotificacoesEmailCard() {
  const { user } = useAuth();
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [email360Enabled, setEmail360Enabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchPreference() {
      if (!user?.id) return;
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('notificacoes_email, notificacoes_email_360')
          .eq('id', user.id)
          .single();

        if (error) throw error;
        setEmailEnabled(data?.notificacoes_email ?? true);
        setEmail360Enabled(data?.notificacoes_email_360 ?? false);
      } catch (error) {
        console.error('Error fetching email preference:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchPreference();
  }, [user?.id]);

  const handleToggle = async (checked: boolean) => {
    if (!user?.id) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ notificacoes_email: checked })
        .eq('id', user.id);

      if (error) throw error;
      
      setEmailEnabled(checked);
      toast.success(checked 
        ? "Notificações por email ativadas" 
        : "Notificações por email desativadas"
      );
    } catch (error) {
      console.error('Error updating email preference:', error);
      toast.error("Erro ao atualizar preferência");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle360 = async (checked: boolean) => {
    if (!user?.id) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ notificacoes_email_360: checked })
        .eq('id', user.id);

      if (error) throw error;
      
      setEmail360Enabled(checked);
      toast.success(checked 
        ? "Alertas Monitoração 360° por email ativados" 
        : "Alertas Monitoração 360° por email desativados"
      );
    } catch (error) {
      console.error('Error updating 360 email preference:', error);
      toast.error("Erro ao atualizar preferência");
    } finally {
      setSaving(false);
    }
  };

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
          <Mail className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1">
          <CardTitle className="text-lg">Notificações por Email</CardTitle>
          <CardDescription>
            Configure quais alertas você deseja receber por email
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Notificações de Andamentos */}
        <div className="flex items-center justify-between">
          <Label htmlFor="email-notifications" className="flex flex-col gap-1">
            <span className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              Andamentos e Eventos
            </span>
            <span className="text-sm text-muted-foreground font-normal">
              Receba emails quando novos andamentos forem detectados ou eventos forem criados
            </span>
          </Label>
          <Switch
            id="email-notifications"
            checked={emailEnabled}
            onCheckedChange={handleToggle}
            disabled={saving}
          />
        </div>

        <div className="border-t pt-6">
          {/* Notificações de Monitoração 360 */}
          <div className="flex items-center justify-between">
            <Label htmlFor="email-360-notifications" className="flex flex-col gap-1">
              <span className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                Monitoração 360°
              </span>
              <span className="text-sm text-muted-foreground font-normal">
                Receba emails com alertas de termos estratégicos detectados nos andamentos
              </span>
            </Label>
            <Switch
              id="email-360-notifications"
              checked={email360Enabled}
              onCheckedChange={handleToggle360}
              disabled={saving}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
