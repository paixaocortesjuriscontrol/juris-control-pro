import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Globe, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  KeyRound,
  Clock,
  FileText,
  Users,
  Scale,
  Loader2,
  Info,
  ExternalLink,
  ShieldAlert
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface ProcessoPortalTabProps {
  processoId: string;
  processoNumero: string;
  tribunal?: string;
}

interface CredencialDisponivel {
  id: string;
  nome: string;
  sistema: string;
  tribunal: string;
  status_validacao: string;
  ultima_validacao: string | null;
}

interface CapturaTribunal {
  id: string;
  processo_id: string;
  cofre_senha_id: string;
  dados_capturados: any;
  partes: any[];
  movimentacoes: any[];
  documentos: any[];
  intimacoes_pendentes: number;
  capturado_em: string;
  sucesso: boolean;
  erro: string | null;
}

export function ProcessoPortalTab({ processoId, processoNumero, tribunal }: ProcessoPortalTabProps) {
  const { user } = useAuth();
  const [buscando, setBuscando] = useState(false);
  const [credencialSelecionada, setCredencialSelecionada] = useState<string | null>(null);
  const [resultadoBusca, setResultadoBusca] = useState<any>(null);
  const [erroBusca, setErroBusca] = useState<string | null>(null);

  // Buscar credenciais disponíveis do cofre de senhas
  const { data: credenciais = [], isLoading: loadingCredenciais } = useQuery({
    queryKey: ["cofre-senhas-disponiveis", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cofre_senhas")
        .select("id, nome, sistema, tribunal, status_validacao, ultima_validacao")
        .eq("ativo", true)
        .order("tribunal");

      if (error) throw error;
      return data as CredencialDisponivel[];
    },
    enabled: !!user,
  });

  // Buscar última captura deste processo
  const { data: ultimaCaptura, isLoading: loadingCaptura, refetch: refetchCaptura } = useQuery({
    queryKey: ["captura-tribunal-processo", processoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("logs_captura_tribunal")
        .select("*")
        .eq("detalhes->>processo_id", processoId)
        .eq("tipo", "success")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!processoId,
  });

  // Filtrar credenciais compatíveis com o tribunal do processo
  const credenciaisCompativeis = useMemo(() => {
    if (!tribunal) return credenciais;
    
    // Tentar fazer match pelo tribunal
    return credenciais.filter(cred => {
      const tribunalProcesso = tribunal?.toUpperCase() || "";
      const tribunalCred = cred.tribunal?.toUpperCase() || "";
      
      // Match exato ou parcial
      return tribunalCred.includes(tribunalProcesso) || 
             tribunalProcesso.includes(tribunalCred) ||
             tribunalProcesso === "" ||
             tribunalCred === "";
    });
  }, [credenciais, tribunal]);

  // Determinar sistema baseado no tribunal
  const getSistemaFromTribunal = (tribunalStr: string): string => {
    if (!tribunalStr) return "pje";
    const t = tribunalStr.toUpperCase();
    if (t.includes("TRT") || t.includes("TST")) return "pje";
    if (t.includes("TJSP") || t.includes("TJSC") || t.includes("TJMS")) return "esaj";
    if (t.includes("TJPR") || t.includes("TJGO")) return "projudi";
    return "pje";
  };

  const handleBuscarDados = async () => {
    if (!credencialSelecionada) {
      toast.error("Selecione uma credencial para continuar");
      return;
    }

    setBuscando(true);
    setErroBusca(null);
    setResultadoBusca(null);

    try {
      const { data, error } = await supabase.functions.invoke("capturar-processo-tribunal", {
        body: {
          cofre_senha_id: credencialSelecionada,
          processo_numero: processoNumero,
          capturar_intimacoes: true,
          capturar_processos: true,
        },
      });

      if (error) throw error;

      if (data.error) {
        setErroBusca(data.error);
        toast.error(data.error);
      } else {
        setResultadoBusca(data);
        toast.success("Dados do tribunal obtidos!");
        refetchCaptura();
      }
    } catch (err: any) {
      console.error("Erro ao buscar dados:", err);
      setErroBusca(err.message || "Erro ao conectar com o tribunal");
      toast.error("Erro ao buscar dados do tribunal");
    } finally {
      setBuscando(false);
    }
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return "-";
    try {
      return format(new Date(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return "-";
    }
  };

  if (loadingCredenciais) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            <span className="text-muted-foreground">Carregando credenciais...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (credenciais.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Portal do Tribunal
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 space-y-4">
            <KeyRound className="w-12 h-12 text-muted-foreground mx-auto" />
            <div>
              <p className="font-medium">Nenhuma credencial configurada</p>
              <p className="text-sm text-muted-foreground mt-1">
                Configure credenciais no Cofre de Senhas para buscar dados diretamente do portal do tribunal.
              </p>
            </div>
            <Button variant="outline" onClick={() => window.open("/cofre-senhas", "_blank")}>
              <KeyRound className="w-4 h-4 mr-2" />
              Configurar Credenciais
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Globe className="w-5 h-5" />
          Portal do Tribunal
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Alerta de segurança */}
        <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
          <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-amber-800 dark:text-amber-300">
              Busca sob demanda - Clique para consultar
            </p>
            <p className="text-amber-700 dark:text-amber-400 mt-1">
              A busca é feita apenas quando você clicar no botão, evitando acessos excessivos ao portal do tribunal.
              Use com moderação para evitar bloqueios.
            </p>
          </div>
        </div>

        {/* Seleção de credencial */}
        <div className="space-y-3">
          <label className="text-sm font-medium flex items-center gap-2">
            <KeyRound className="w-4 h-4" />
            Selecionar Credencial
          </label>
          
          <div className="grid gap-2">
            {credenciaisCompativeis.length > 0 ? (
              credenciaisCompativeis.map((cred) => (
                <button
                  key={cred.id}
                  onClick={() => setCredencialSelecionada(cred.id)}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors text-left ${
                    credencialSelecionada === cred.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      cred.status_validacao === "valido" ? "bg-green-500" :
                      cred.status_validacao === "erro" ? "bg-red-500" : "bg-yellow-500"
                    }`} />
                    <div>
                      <p className="font-medium">{cred.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {cred.sistema?.toUpperCase()} - {cred.tribunal}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {cred.sistema?.toUpperCase()}
                    </Badge>
                    {credencialSelecionada === cred.id && (
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                    )}
                  </div>
                </button>
              ))
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                <p className="text-sm">Nenhuma credencial compatível com {tribunal || "este tribunal"}</p>
                <p className="text-xs mt-1">Mostrando todas as credenciais disponíveis:</p>
                <div className="mt-3 space-y-2">
                  {credenciais.map((cred) => (
                    <button
                      key={cred.id}
                      onClick={() => setCredencialSelecionada(cred.id)}
                      className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors text-left ${
                        credencialSelecionada === cred.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${
                          cred.status_validacao === "valido" ? "bg-green-500" :
                          cred.status_validacao === "erro" ? "bg-red-500" : "bg-yellow-500"
                        }`} />
                        <div>
                          <p className="font-medium">{cred.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {cred.sistema?.toUpperCase()} - {cred.tribunal}
                          </p>
                        </div>
                      </div>
                      {credencialSelecionada === cred.id && (
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Botão de busca */}
        <Button 
          onClick={handleBuscarDados} 
          disabled={!credencialSelecionada || buscando}
          className="w-full"
          size="lg"
        >
          {buscando ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Buscando dados do tribunal...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Buscar Dados do Portal
            </>
          )}
        </Button>

        {/* Erro */}
        {erroBusca && (
          <div className="flex items-start gap-3 p-4 bg-destructive/10 rounded-lg border border-destructive/30">
            <AlertCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-destructive">Erro ao buscar dados</p>
              <p className="text-destructive/80 mt-1">{erroBusca}</p>
            </div>
          </div>
        )}

        {/* Resultado da busca */}
        {resultadoBusca && (
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <span className="font-medium">Resultado da Busca</span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Scale className="w-4 h-4" />
                  Sistema
                </div>
                <p className="font-medium">{resultadoBusca.sistema?.toUpperCase()}</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <FileText className="w-4 h-4" />
                  Processos
                </div>
                <p className="font-medium">{resultadoBusca.processosCapturados || 0}</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <AlertCircle className="w-4 h-4" />
                  Intimações
                </div>
                <p className="font-medium">{resultadoBusca.intimacoesCapturadas || 0}</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Clock className="w-4 h-4" />
                  Status
                </div>
                <p className="font-medium text-sm">{resultadoBusca.mensagem || "Concluído"}</p>
              </div>
            </div>

            {resultadoBusca.mensagem && resultadoBusca.mensagem.includes("desenvolvimento") && (
              <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                <Info className="w-5 h-5 text-blue-600 dark:text-blue-500 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-blue-800 dark:text-blue-300">
                    Funcionalidade em desenvolvimento
                  </p>
                  <p className="text-blue-700 dark:text-blue-400 mt-1">
                    A integração completa com o {resultadoBusca.sistema?.toUpperCase()} está sendo implementada.
                    Atualmente retorna apenas a estrutura básica.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Última captura */}
        {ultimaCaptura && !resultadoBusca && (
          <div className="pt-4 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
              <Clock className="w-4 h-4" />
              Última consulta: {formatDateTime(ultimaCaptura.created_at)}
            </div>
          </div>
        )}

        {/* Info adicional */}
        <div className="pt-4 border-t">
          <div className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
            <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Dados disponíveis:</strong> Intimações pendentes, movimentações recentes, documentos e partes do processo.</p>
              <p><strong>Sistemas suportados:</strong> PJe (Trabalhista), eSAJ (SP, SC, MS) e Projudi (PR, GO).</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
