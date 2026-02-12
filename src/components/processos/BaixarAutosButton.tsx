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
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  FileText,
  ShieldCheck,
  Info,
} from "lucide-react";

interface BaixarAutosButtonProps {
  processoId: string;
  processoNumero: string;
  tribunal?: string;
}

export function BaixarAutosButton({ processoId, processoNumero, tribunal }: BaixarAutosButtonProps) {
  const { user } = useAuth();
  const [credencialSelecionada, setCredencialSelecionada] = useState<string | null>(null);
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

  const handleBaixar = () => {
    if (!credencialSelecionada) return;
    baixarAutos({
      cofre_senha_id: credencialSelecionada,
      processo_numero: processoNumero,
      tribunal,
    });
  };

  if (loadingCreds) return null;

  return (
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
            {/* Info certificado */}
            <div className="flex items-start gap-2 p-3 bg-muted/30 rounded-lg">
              <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Selecione uma credencial PJe para buscar os documentos do processo.
                Credenciais com certificado A1 (🔐) permitem login automatizado.
              </p>
            </div>

            {/* Seleção de credencial */}
            <div className="grid gap-2">
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
              onClick={handleBaixar}
              disabled={!credencialSelecionada || buscando}
              className="w-full"
            >
              {buscando ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Buscando documentos no PJe...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Buscar Autos do Processo
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
            {resultado.documentos.length > 0 && (
              <ScrollArea className="max-h-[200px]">
                <div className="space-y-1">
                  {resultado.documentos.map((doc, i) => (
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
  );
}
