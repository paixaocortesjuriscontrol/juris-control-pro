import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Info, X, Save, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Coordenacao {
  id: string;
  nome: string;
}

interface Membro {
  id: string;
  nome: string;
  telefone: string | null;
}

interface AlertaCoordenacao {
  id: string;
  coordenacao_id: string;
  ativo: boolean;
  horario_envio: string;
  membros_ids: string[];
}

interface AlertasCoordenacaoCardProps {
  coordenacoes: Coordenacao[];
}

export function AlertasCoordenacaoCard({ coordenacoes }: AlertasCoordenacaoCardProps) {
  const queryClient = useQueryClient();
  const [coordenacaoSelecionada, setCoordenacaoSelecionada] = useState<string>("");
  const [alertaAtivo, setAlertaAtivo] = useState(false);
  const [horarioEnvio, setHorarioEnvio] = useState("08:00");
  const [membrosSelecionados, setMembrosSelecionados] = useState<string[]>([]);

  // Buscar alerta existente para a coordenação selecionada
  const { data: alertaExistente, isLoading: loadingAlerta } = useQuery({
    queryKey: ['alerta-coordenacao-djen', coordenacaoSelecionada],
    queryFn: async () => {
      if (!coordenacaoSelecionada) return null;
      const { data, error } = await supabase
        .from('alertas_coordenacao_djen')
        .select('*')
        .eq('coordenacao_id', coordenacaoSelecionada)
        .maybeSingle();
      if (error) throw error;
      return data as AlertaCoordenacao | null;
    },
    enabled: !!coordenacaoSelecionada,
  });

  // Buscar membros da coordenação selecionada
  const { data: membros = [], isLoading: loadingMembros } = useQuery({
    queryKey: ['membros-coordenacao-alertas', coordenacaoSelecionada],
    queryFn: async () => {
      if (!coordenacaoSelecionada) return [];
      
      // Primeiro busca os IDs dos membros
      const { data: membroData, error: membroError } = await supabase
        .from('membros_coordenacao')
        .select('usuario_id')
        .eq('coordenacao_id', coordenacaoSelecionada);
      
      if (membroError) throw membroError;
      if (!membroData || membroData.length === 0) return [];
      
      const usuarioIds = membroData.map(m => m.usuario_id);
      
      // Depois busca os profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, nome, telefone')
        .in('id', usuarioIds);
      
      if (profilesError) throw profilesError;
      
      return (profiles || []).map(p => ({
        id: p.id,
        nome: p.nome || 'Sem nome',
        telefone: p.telefone
      })) as Membro[];
    },
    enabled: !!coordenacaoSelecionada,
  });

  // Atualizar estados quando carregar alerta existente
  useEffect(() => {
    if (alertaExistente) {
      setAlertaAtivo(alertaExistente.ativo);
      setHorarioEnvio(alertaExistente.horario_envio?.slice(0, 5) || '08:00');
      setMembrosSelecionados(alertaExistente.membros_ids || []);
    } else {
      setAlertaAtivo(false);
      setHorarioEnvio('08:00');
      setMembrosSelecionados([]);
    }
  }, [alertaExistente]);

  // Mutation para salvar
  const salvarAlerta = useMutation({
    mutationFn: async () => {
      if (!coordenacaoSelecionada) throw new Error("Selecione uma coordenação");

      const alertaData = {
        coordenacao_id: coordenacaoSelecionada,
        ativo: alertaAtivo,
        horario_envio: horarioEnvio + ':00',
        membros_ids: membrosSelecionados,
      };

      if (alertaExistente) {
        const { error } = await supabase
          .from('alertas_coordenacao_djen')
          .update(alertaData)
          .eq('id', alertaExistente.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('alertas_coordenacao_djen')
          .insert(alertaData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerta-coordenacao-djen'] });
      toast.success("Configuração de alertas salva!");
    },
    onError: (error) => {
      toast.error(`Erro ao salvar: ${error.message}`);
    },
  });

  const handleToggleMembro = (membroId: string) => {
    setMembrosSelecionados(prev =>
      prev.includes(membroId)
        ? prev.filter(id => id !== membroId)
        : [...prev, membroId]
    );
  };

  const coordenacaoNome = coordenacoes.find(c => c.id === coordenacaoSelecionada)?.nome;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="w-4 h-4" />
          Alertas WhatsApp por Coordenação
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Configure alertas para receber um resumo diário das publicações encontradas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Coordenação</Label>
          <Select value={coordenacaoSelecionada} onValueChange={setCoordenacaoSelecionada}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma coordenação para configurar" />
            </SelectTrigger>
            <SelectContent>
              {coordenacoes.map((coord) => (
                <SelectItem key={coord.id} value={coord.id}>{coord.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {coordenacaoSelecionada && (
          <>
            {loadingAlerta ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4 pt-2 border-t">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Alertas Ativos</Label>
                    <p className="text-xs text-muted-foreground">
                      Enviar resumo diário via WhatsApp
                    </p>
                  </div>
                  <Switch
                    checked={alertaAtivo}
                    onCheckedChange={setAlertaAtivo}
                  />
                </div>

                {alertaAtivo && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="horario">Horário de Envio</Label>
                      <Input
                        id="horario"
                        type="time"
                        value={horarioEnvio}
                        onChange={(e) => setHorarioEnvio(e.target.value)}
                        className="w-40"
                      />
                      <p className="text-xs text-muted-foreground">
                        Resumo enviado diariamente neste horário (se houver publicações)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label>Membros que receberão alertas</Label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-4 w-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              <p>Apenas membros com telefone cadastrado podem receber alertas via WhatsApp.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>

                      {loadingMembros ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : membros.length === 0 ? (
                        <p className="text-sm text-muted-foreground italic py-2">
                          Nenhum membro encontrado nesta coordenação
                        </p>
                      ) : (
                        <ScrollArea className="h-48 border rounded-md p-3">
                          <div className="space-y-2">
                            {membros.map((membro) => (
                              <div key={membro.id} className="flex items-center space-x-3 p-2 rounded hover:bg-muted/50">
                                <Checkbox
                                  id={`membro-${membro.id}`}
                                  checked={membrosSelecionados.includes(membro.id)}
                                  onCheckedChange={() => handleToggleMembro(membro.id)}
                                  disabled={!membro.telefone}
                                />
                                <div className="flex-1">
                                  <label 
                                    htmlFor={`membro-${membro.id}`} 
                                    className={`text-sm cursor-pointer ${!membro.telefone ? 'text-muted-foreground' : ''}`}
                                  >
                                    {membro.nome}
                                  </label>
                                  {membro.telefone ? (
                                    <p className="text-xs text-muted-foreground">{membro.telefone}</p>
                                  ) : (
                                    <p className="text-xs text-destructive">Sem telefone cadastrado</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      )}

                      {membrosSelecionados.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {membrosSelecionados.map((id) => {
                            const membro = membros.find(m => m.id === id);
                            return membro ? (
                              <Badge key={id} variant="secondary" className="gap-1">
                                {membro.nome}
                                <button
                                  type="button"
                                  onClick={() => handleToggleMembro(id)}
                                  className="ml-1 hover:text-destructive"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ) : null;
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}

                <Button 
                  onClick={() => salvarAlerta.mutate()} 
                  disabled={salvarAlerta.isPending}
                  className="w-full"
                >
                  {salvarAlerta.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Salvar Configuração
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}