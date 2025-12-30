import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, Clock, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  coordenacaoId?: string;
}

const HORARIOS_DISPONIVEIS = [
  { value: '08:00', label: '08:00', cron: '0 11 * * *' },
  { value: '12:00', label: '12:00', cron: '0 15 * * *' },
  { value: '14:00', label: '14:00', cron: '0 17 * * *' },
  { value: '18:00', label: '18:00', cron: '0 21 * * *' },
  { value: '22:00', label: '22:00', cron: '0 1 * * *' },
];

export function MonitoramentoAudienciasCard({ coordenacaoId }: Props) {
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ['config-monitoramento', 'andamentos', coordenacaoId],
    queryFn: async () => {
      let query = supabase
        .from('configuracoes_monitoramento')
        .select('*')
        .eq('tipo', 'andamentos');
      
      if (coordenacaoId) {
        query = query.eq('coordenacao_id', coordenacaoId);
      } else {
        query = query.is('coordenacao_id', null);
      }

      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const atualizarHorarios = useMutation({
    mutationFn: async (horarios: string[]) => {
      if (!config?.id) {
        const { error } = await supabase
          .from('configuracoes_monitoramento')
          .insert({
            tipo: 'andamentos',
            coordenacao_id: coordenacaoId || null,
            horarios_execucao: horarios,
            ativo: true,
          });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('configuracoes_monitoramento')
          .update({ 
            horarios_execucao: horarios,
            updated_at: new Date().toISOString(),
          })
          .eq('id', config.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['config-monitoramento'] });
      toast.success('Horários atualizados!');
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });

  const horariosSelecionados = (config?.horarios_execucao as string[]) || [];

  const handleToggleHorario = (horario: string) => {
    const novosHorarios = horariosSelecionados.includes(horario)
      ? horariosSelecionados.filter(h => h !== horario)
      : [...horariosSelecionados, horario];
    
    atualizarHorarios.mutate(novosHorarios);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Calendar className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Monitoramento de Audiências</CardTitle>
            <CardDescription>
              Configure os horários para verificar audiências nos andamentos dos processos
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-sm font-medium">Horários de Execução</Label>
          <p className="text-xs text-muted-foreground mb-3">
            Selecione os horários para verificar novos andamentos e detectar audiências
          </p>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {HORARIOS_DISPONIVEIS.map((horario) => (
              <label
                key={horario.value}
                className={`
                  flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors
                  ${horariosSelecionados.includes(horario.value) 
                    ? 'bg-primary/10 border-primary' 
                    : 'hover:bg-muted'}
                `}
              >
                <Checkbox
                  checked={horariosSelecionados.includes(horario.value)}
                  onCheckedChange={() => handleToggleHorario(horario.value)}
                  disabled={atualizarHorarios.isPending}
                />
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{horario.label}</span>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            <strong>Nota:</strong> O monitoramento verifica os andamentos dos processos cadastrados 
            e detecta automaticamente audiências marcadas, exibindo-as no Painel de Audiências.
          </p>
        </div>

        {horariosSelecionados.length > 0 && (
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm">
              <strong>Horários configurados:</strong> {horariosSelecionados.sort().join(', ')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
