import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaixarAutos } from "@/hooks/useBaixarAutos";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  FileText,
  ShieldCheck,
  Info,
  ShieldAlert,
} from "lucide-react";

interface BaixarAutosButtonProps {
  processoId: string;
  processoNumero: string;
  tribunal?: string;
}

export function BaixarAutosButton({ processoId, processoNumero, tribunal }: BaixarAutosButtonProps) {
  const { user } = useAuth();
  const [credencialSelecionada, setCredencialSelecionada] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const { baixarAutos, buscando, resultado, erro, documentosBaixados, loadingDocs } = useBaixarAutos(processoId);

  // Buscar credenciais com certificado A1
  const { data: credenciais = [], isLoading: loadingCreds } = useQuery({
    queryKey: ["cofre-senhas-a1", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cofre_senhas")
        .select("id, nome, sistema, tribunal, status_validacao, certificado_a1_path")
        .eq("ativo", true)
        .order("tribunal");

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Filtrar credenciais PJe
  const credenciaisPje = useMemo(() => {
    return credenciais.filter(
      (c) => c.sistema?.toLowerCase() === "pje"
    );
  }, [credenciais]);

  const handleClickBaixar = () => {
    if (!credencialSelecionada) return;
    setShowConfirmDialog(true);
  };

  const handleConfirmarBaixar = () => {
    setShowConfirmDialog(false);
    if (!credencialSelecionada) return;
    baixarAutos({
      cofre_senha_id: credencialSelecionada,
      processo_numero: processoNumero,
      tribunal,
    });
  };

  if (loadingCreds) return null;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Download className="w-5 h-5" />
            Baixar Autos do PJe
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {credenciaisPje.length === 0 ? (
            <div className="text-center py-4 space-y-2">
              <KeyRound className="w-8 h-8 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">
                Nenhuma credencial PJe configurada no cofre.
              </p>
              <Button variant="outline" size="sm" onClick={() => window.open("/cofre-senhas", "_blank")}>
                Configurar Credencial
              </Button>
            </div>
          ) : (
            <>
              {/* Aviso de segurança */}
              <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                <ShieldCheck className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                <div className="text-xs text-green-700 dark:text-green-400">
                  <p className="font-medium">Modo seguro: Consulta Pública</p>
                  <p className="mt-0.5">
                    A busca utiliza apenas a consulta pública do PJe. <strong>Nenhuma credencial de login será enviada ao tribunal</strong>, 
                    eliminando qualquer risco de bloqueio de conta.
                  </p>
                </div>
              </div>

              {/* Seleção de credencial */}
              <div className="grid gap-2">
                <p className="text-xs text-muted-foreground">Selecione a credencial para registrar a busca:</p>
                {credenciaisPje.map((cred) => (
                  <button
                    key={cred.id}
                    onClick={() => setCredencialSelecionada(cred.id)}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors text-left ${
                      credencialSelecionada === cred.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        cred.status_validacao === "valido" ? "bg-green-500" :
                        cred.status_validacao === "erro" ? "bg-red-500" : "bg-yellow-500"
                      }`} />
                      <div>
                        <p className="font-medium text-sm">{cred.nome}</p>
                        <p className="text-xs text-muted-foreground">{cred.tribunal}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {cred.certificado_a1_path && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <ShieldCheck className="w-3 h-3" /> A1
                        </Badge>
                      )}
                      {credencialSelecionada === cred.id && (
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                      )}
                    </div>
                  </button>
                ))}
              </div>

              {/* Botão */}
              <Button
                onClick={handleClickBaixar}
                disabled={!credencialSelecionada || buscando}
                className="w-full"
              >
                {buscando ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Buscando documentos (consulta pública)...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Buscar Autos (Consulta Pública)
                  </>
                )}
              </Button>
            </>
          )}

          {/* Erro */}
          {erro && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg border border-destructive/30">
              <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-sm text-destructive">{erro}</p>
            </div>
          )}

          {/* Resultado */}
          {resultado && resultado.sucesso && (
            <div className="space-y-3 pt-3 border-t">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium">{resultado.mensagem}</span>
              </div>
              {resultado.documentos && resultado.documentos.length > 0 && (
                <ScrollArea className="max-h-[200px]">
                  <div className="space-y-1">
                    {resultado.documentos.map((doc: any, i: number) => (
                      <div key={doc.id || i} className="flex items-center gap-2 p-2 bg-muted/30 rounded text-sm">
                        <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="truncate">{doc.nome}</span>
                        <Badge variant="outline" className="text-xs ml-auto shrink-0">
                          {doc.tipo}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}

          {/* Documentos já baixados anteriormente */}
          {!loadingDocs && documentosBaixados.length > 0 && !resultado && (
            <div className="pt-3 border-t">
              <p className="text-xs text-muted-foreground mb-2">
                {documentosBaixados.length} documento(s) encontrado(s) anteriormente
              </p>
              <ScrollArea className="max-h-[150px]">
                <div className="space-y-1">
                  {documentosBaixados.slice(0, 10).map((doc: any) => (
                    <div key={doc.id} className="flex items-center gap-2 p-2 bg-muted/30 rounded text-sm">
                      <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="truncate text-xs">{doc.nome_arquivo}</span>
                      <Badge variant="outline" className="text-xs ml-auto shrink-0">
                        {doc.status_download}
                      </Badge>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de confirmação */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-500" />
              Confirmar Busca de Autos
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Deseja buscar os documentos do processo <strong>{processoNumero}</strong>?</p>
                <div className="bg-green-50 dark:bg-green-950/30 p-3 rounded-lg border border-green-200 dark:border-green-800">
                  <p className="text-xs text-green-700 dark:text-green-400 font-medium flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Modo seguro ativo
                  </p>
                  <ul className="text-xs text-green-600 dark:text-green-500 mt-1.5 space-y-1 list-disc list-inside">
                    <li>Apenas consulta processual pública será realizada</li>
                    <li>Nenhuma credencial de login será enviada ao tribunal</li>
                    <li>Sem risco de bloqueio de conta do advogado</li>
                  </ul>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmarBaixar}>
              Confirmar Busca
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
