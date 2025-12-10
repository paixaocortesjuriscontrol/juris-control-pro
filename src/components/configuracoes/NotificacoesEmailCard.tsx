import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Mail, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function NotificacoesEmailCard() {
  const { user } = useAuth();
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function fetchPreference() {
      if (!user?.id) return;
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('notificacoes_email')
          .eq('id', user.id)
          .single();

        if (error) throw error;
        setEmailEnabled(data?.notificacoes_email ?? true);
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
            Receba alertas por email quando novos andamentos forem encontrados
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <Label htmlFor="email-notifications" className="flex flex-col gap-1">
            <span>Receber emails de monitoramento</span>
            <span className="text-sm text-muted-foreground font-normal">
              Você receberá um email quando novos andamentos forem detectados nos seus processos
            </span>
          </Label>
          <Switch
            id="email-notifications"
            checked={emailEnabled}
            onCheckedChange={handleToggle}
            disabled={saving}
          />
        </div>
      </CardContent>
    </Card>
  );
}
