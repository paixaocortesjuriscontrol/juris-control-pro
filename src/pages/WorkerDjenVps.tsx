/**
 * Página headless para VPS Worker
 * Acessar via: /worker-djen-vps?coordenacao=UUID
 * 
 * Esta página é minimalista e otimizada para rodar em VPS remotas.
 * Auto-inicia a busca quando o parâmetro coordenacao está presente.
 */
import { useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWorkerDjenVps } from "@/hooks/useWorkerDjenVps";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, Square, RefreshCw, Wifi, WifiOff, Clock, FileText, Copy } from "lucide-react";

export default function WorkerDjenVps() {
  const [searchParams] = useSearchParams();
  const coordenacaoId = searchParams.get('coordenacao');
  const autoStart = searchParams.get('autostart') === 'true';
  
  const [coordenacaoNome, setCoordenacaoNome] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Verificar autenticação
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
    };
    checkAuth();
  }, []);

  // Buscar nome da coordenação
  useEffect(() => {
    if (!coordenacaoId) return;
    
    const fetchCoordenacao = async () => {
      const { data } = await supabase
        .from('coordenacoes')
        .select('nome')
        .eq('id', coordenacaoId)
        .single();
      
      if (data) setCoordenacaoNome(data.nome);
    };
    
    fetchCoordenacao();
  }, [coordenacaoId]);

  // Hook do worker
  const { progress, ipAddress, executar, cancelar, isRunning } = useWorkerDjenVps({
    coordenacaoId: coordenacaoId || '',
    autoStart: autoStart && !!coordenacaoId,
  });

  // Calcular percentual
  const percentage = progress.totalMonitoramentos > 0
    ? Math.round((progress.monitoramentoAtual / progress.totalMonitoramentos) * 100)
    : 0;

  // Formatar tempo
  const formatTempo = (segundos: number) => {
    const min = Math.floor(segundos / 60);
    const sec = segundos % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  // Status badge color
  const getStatusColor = () => {
    switch (progress.status) {
      case 'executando': return 'bg-blue-500';
      case 'concluido': return 'bg-green-500';
      case 'erro': return 'bg-red-500';
      case 'pausado': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  // Copiar URL do worker
  const copiarUrl = () => {
    const url = `${window.location.origin}/worker-djen-vps?coordenacao=${coordenacaoId}&autostart=true`;
    navigator.clipboard.writeText(url);
  };

  if (!coordenacaoId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-red-500">Erro: Coordenação não especificada</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Acesse esta página com o parâmetro <code>?coordenacao=UUID</code>
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Exemplo: <code>/worker-djen-vps?coordenacao=abc123&autostart=true</code>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isAuthenticated === false) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-yellow-500">Autenticação necessária</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Você precisa estar logado para executar o worker.
            </p>
            <Button 
              className="mt-4 w-full"
              onClick={() => window.location.href = '/auth'}
            >
              Fazer Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">VPS Worker DJEN</h1>
            <p className="text-muted-foreground">{coordenacaoNome || coordenacaoId}</p>
          </div>
          <Button variant="outline" size="sm" onClick={copiarUrl}>
            <Copy className="h-4 w-4 mr-2" />
            Copiar URL
          </Button>
        </div>

        {/* Status Card */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Status do Worker</CardTitle>
              <div className="flex items-center gap-2">
                {ipAddress ? (
                  <Badge variant="outline" className="gap-1">
                    <Wifi className="h-3 w-3 text-green-500" />
                    {ipAddress}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="gap-1">
                    <WifiOff className="h-3 w-3 text-gray-400" />
                    Detectando IP...
                  </Badge>
                )}
                <Badge className={getStatusColor()}>
                  {progress.status.toUpperCase()}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>
                  Monitoramento {progress.monitoramentoAtual} de {progress.totalMonitoramentos}
                </span>
                <span>{percentage}%</span>
              </div>
              <Progress value={percentage} className="h-2" />
            </div>

            {/* Mensagem */}
            <p className="text-sm text-muted-foreground min-h-[20px]">
              {progress.mensagem || 'Aguardando...'}
            </p>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-3 bg-muted rounded-lg">
                <FileText className="h-5 w-5 mx-auto mb-1 text-green-500" />
                <div className="text-2xl font-bold">{progress.publicacoesNovas}</div>
                <div className="text-xs text-muted-foreground">Novas</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <Copy className="h-5 w-5 mx-auto mb-1 text-yellow-500" />
                <div className="text-2xl font-bold">{progress.publicacoesDuplicadas}</div>
                <div className="text-xs text-muted-foreground">Duplicadas</div>
              </div>
              <div className="text-center p-3 bg-muted rounded-lg">
                <Clock className="h-5 w-5 mx-auto mb-1 text-blue-500" />
                <div className="text-2xl font-bold">{formatTempo(progress.tempoDecorrido)}</div>
                <div className="text-xs text-muted-foreground">Tempo</div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              {isRunning ? (
                <Button 
                  variant="destructive" 
                  className="flex-1"
                  onClick={cancelar}
                >
                  <Square className="h-4 w-4 mr-2" />
                  Parar
                </Button>
              ) : (
                <Button 
                  className="flex-1"
                  onClick={executar}
                  disabled={progress.status === 'executando'}
                >
                  {progress.status === 'concluido' ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Executar Novamente
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Iniciar
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Info */}
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground text-center">
              Este worker processa os monitoramentos DJEN da coordenação usando o IP desta máquina.
              <br />
              Mantenha esta janela aberta durante a execução.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
