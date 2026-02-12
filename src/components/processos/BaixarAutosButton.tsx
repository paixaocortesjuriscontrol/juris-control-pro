import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useBaixarAutos } from "@/hooks/useBaixarAutos";
import { useMniConsultaProcesso, type ResultadoMni } from "@/hooks/useMniConsultaProcesso";
import { obterTribunalMni } from "@/utils/mniTribunalMap";
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
  ShieldAlert,
  Lock,
  Globe,
  LogIn,
  Clock,
  Users,
  Scale,
  Zap,
} from "lucide-react";

interface BaixarAutosButtonProps {
  processoId: string;
  processoNumero: string;
  tribunal?: string;
}

type ModoBusca = "mni" | "consulta_publica" | "login_certificado";

export function BaixarAutosButton({ processoId, processoNumero, tribunal }: BaixarAutosButtonProps) {
  const { user } = useAuth();
  const [credencialSelecionada, setCredencialSelecionada] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Detectar se MNI está disponível para este processo
  const mniDisponivel = useMemo(() => !!obterTribunalMni(processoNumero), [processoNumero]);
  const tribunalMni = useMemo(() => obterTribunalMni(processoNumero), [processoNumero]);

  const [modo, setModo] = useState<ModoBusca>(mniDisponivel ? "mni" : "consulta_publica");

  const { baixarAutos, buscando: buscandoBrowserless, resultado: resultadoBrowserless, erro: erroBrowserless, documentosBaixados, loadingDocs } = useBaixarAutos(processoId);
  const { consultarMni, consultando: consultandoMni, resultado: resultadoMni, erro: erroMni } = useMniConsultaProcesso();

  const buscando = consultandoMni || buscandoBrowserless;
  const erro = modo === "mni" ? erroMni : erroBrowserless;

  const { data: credenciais = [], isLoading: loadingCreds } = useQuery({
    queryKey: ["cofre-senhas-a1", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cofre_senhas")
        .select("id, nome, sistema, tribunal, status_validacao, certificado_a1_path, tentativas_falhas, bloqueado_ate")
        .eq("ativo", true)
        .order("tribunal");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const credenciaisPje = useMemo(() => {
    return credenciais.filter((c) => c.sistema?.toLowerCase() === "pje");
  }, [credenciais]);

  const credencialAtual = useMemo(() => {
    return credenciaisPje.find((c) => c.id === credencialSelecionada);
  }, [credenciaisPje, credencialSelecionada]);

  const estaBloqueada = useMemo(() => {
    if (!credencialAtual?.bloqueado_ate) return false;
    return new Date(credencialAtual.bloqueado_ate) > new Date();
  }, [credencialAtual]);

  const minutosRestantes = useMemo(() => {
    if (!credencialAtual?.bloqueado_ate) return 0;
    const diff = new Date(credencialAtual.bloqueado_ate).getTime() - Date.now();
    return diff > 0 ? Math.ceil(diff / 60000) : 0;
  }, [credencialAtual]);

  const handleClickBaixar = () => {
    if (!credencialSelecionada) return;
    setShowConfirmDialog(true);
  };

  const handleConfirmarBaixar = () => {
    setShowConfirmDialog(false);
    if (!credencialSelecionada) return;

    if (modo === "mni") {
      consultarMni({
        cofre_senha_id: credencialSelecionada,
        processo_numero: processoNumero,
      });
    } else {
      baixarAutos({
        cofre_senha_id: credencialSelecionada,
        processo_numero: processoNumero,
        tribunal,
        modo: modo as "consulta_publica" | "login_certificado",
      });
    }
  };

  if (loadingCreds) return null;

  const botaoDesabilitado = !credencialSelecionada || buscando || (modo !== "mni" && modo === "login_certificado" && estaBloqueada);

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Download className="w-5 h-5" />
            Buscar Autos do PJe
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
              {/* Seleção de modo */}
              <div className={`grid gap-2 ${mniDisponivel ? "grid-cols-3" : "grid-cols-2"}`}>
                {mniDisponivel && (
                  <button
                    onClick={() => setModo("mni")}
                    className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-colors ${
                      modo === "mni"
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <Zap className={`w-4 h-4 ${modo === "mni" ? "text-blue-600" : "text-muted-foreground"}`} />
                    <div>
                      <p className="text-xs font-medium">API MNI</p>
                      <p className="text-[10px] text-muted-foreground">Oficial CNJ</p>
                    </div>
                  </button>
                )}
                <button
                  onClick={() => setModo("consulta_publica")}
                  className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-colors ${
                    modo === "consulta_publica"
                      ? "border-green-500 bg-green-50 dark:bg-green-950/30"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <Globe className={`w-4 h-4 ${modo === "consulta_publica" ? "text-green-600" : "text-muted-foreground"}`} />
                  <div>
                    <p className="text-xs font-medium">Consulta Pública</p>
                    <p className="text-[10px] text-muted-foreground">Sem risco</p>
                  </div>
                </button>
                <button
                  onClick={() => setModo("login_certificado")}
                  className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-colors ${
                    modo === "login_certificado"
                      ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <LogIn className={`w-4 h-4 ${modo === "login_certificado" ? "text-amber-600" : "text-muted-foreground"}`} />
                  <div>
                    <p className="text-xs font-medium">Login Autenticado</p>
                    <p className="text-[10px] text-muted-foreground">Acesso completo</p>
                  </div>
                </button>
              </div>

              {/* Aviso de segurança por modo */}
              {modo === "mni" ? (
                <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                  <Zap className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                  <div className="text-xs text-blue-700 dark:text-blue-400">
                    <p className="font-medium">API MNI — Protocolo Oficial do CNJ</p>
                    <p className="mt-0.5">
                      Consulta via webservice oficial. Retorna partes, documentos e movimentações de forma estruturada.
                      {tribunalMni && <span className="font-medium"> Tribunal: {tribunalMni.sigla}</span>}
                    </p>
                  </div>
                </div>
              ) : modo === "consulta_publica" ? (
                <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                  <ShieldCheck className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                  <div className="text-xs text-green-700 dark:text-green-400">
                    <p className="font-medium">Modo seguro: Consulta Pública</p>
                    <p className="mt-0.5">Nenhuma credencial de login será enviada ao tribunal.</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                  <ShieldAlert className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="text-xs text-amber-700 dark:text-amber-400">
                    <p className="font-medium">Login com credenciais</p>
                    <p className="mt-0.5">
                      Máx. 3 tentativas falhadas = bloqueio de 1h. Acesso completo aos documentos do processo.
                    </p>
                  </div>
                </div>
              )}

              {/* Seleção de credencial */}
              <div className="grid gap-2">
                <p className="text-xs text-muted-foreground">
                  {modo === "mni"
                    ? "Selecione a credencial (CPF/senha) para consultar via MNI:"
                    : modo === "consulta_publica"
                      ? "Selecione a credencial para registrar a busca:"
                      : "Selecione a credencial para login no PJe:"}
                </p>
                {credenciaisPje.map((cred) => {
                  const credBloqueada = cred.bloqueado_ate && new Date(cred.bloqueado_ate) > new Date();
                  const minutosBlq = credBloqueada
                    ? Math.ceil((new Date(cred.bloqueado_ate!).getTime() - Date.now()) / 60000)
                    : 0;
                  const desabilitada = modo === "login_certificado" && !!credBloqueada;

                  return (
                    <button
                      key={cred.id}
                      onClick={() => setCredencialSelecionada(cred.id)}
                      disabled={desabilitada}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-colors text-left ${
                        credencialSelecionada === cred.id
                          ? "border-primary bg-primary/5"
                          : desabilitada
                            ? "border-destructive/30 bg-destructive/5 opacity-60 cursor-not-allowed"
                            : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          credBloqueada ? "bg-red-500" :
                          cred.status_validacao === "valido" ? "bg-green-500" :
                          cred.status_validacao === "erro" ? "bg-yellow-500" : "bg-yellow-500"
                        }`} />
                        <div>
                          <p className="font-medium text-sm">{cred.nome}</p>
                          <p className="text-xs text-muted-foreground">{cred.tribunal}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {credBloqueada && modo !== "mni" && (
                          <Badge variant="destructive" className="text-[10px] gap-1">
                            <Lock className="w-3 h-3" />
                            {minutosBlq}min
                          </Badge>
                        )}
                        {cred.tentativas_falhas > 0 && !credBloqueada && modo !== "consulta_publica" && (
                          <Badge variant="outline" className="text-[10px] gap-1 text-amber-600 border-amber-300">
                            {cred.tentativas_falhas}/3
                          </Badge>
                        )}
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
                  );
                })}
              </div>

              {/* Botão */}
              <Button
                onClick={handleClickBaixar}
                disabled={botaoDesabilitado}
                className="w-full"
                variant={modo === "mni" ? "default" : modo === "login_certificado" ? "default" : "outline"}
              >
                {buscando ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {modo === "mni" ? "Consultando API MNI..." : modo === "login_certificado" ? "Fazendo login e buscando..." : "Buscando (consulta pública)..."}
                  </>
                ) : estaBloqueada && modo === "login_certificado" ? (
                  <>
                    <Clock className="w-4 h-4 mr-2" />
                    Bloqueada ({minutosRestantes}min restantes)
                  </>
                ) : (
                  <>
                    {modo === "mni" ? <Zap className="w-4 h-4 mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                    {modo === "mni" ? "Consultar via MNI" : modo === "login_certificado" ? "Buscar Autos (Login)" : "Buscar Autos (Público)"}
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

          {/* Resultado MNI */}
          {resultadoMni && resultadoMni.sucesso && (
            <MniResultadoView resultado={resultadoMni} />
          )}

          {/* Resultado Browserless */}
          {resultadoBrowserless && resultadoBrowserless.sucesso && (
            <div className="space-y-3 pt-3 border-t">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium">{resultadoBrowserless.mensagem}</span>
              </div>
              {resultadoBrowserless.documentos && resultadoBrowserless.documentos.length > 0 && (
                <ScrollArea className="max-h-[200px]">
                  <div className="space-y-1">
                    {resultadoBrowserless.documentos.map((doc: any, i: number) => (
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

          {/* Documentos já baixados */}
          {!loadingDocs && documentosBaixados.length > 0 && !resultadoBrowserless && !resultadoMni && (
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
              {modo === "mni" ? (
                <Zap className="w-5 h-5 text-blue-500" />
              ) : modo === "login_certificado" ? (
                <ShieldAlert className="w-5 h-5 text-amber-500" />
              ) : (
                <ShieldCheck className="w-5 h-5 text-green-500" />
              )}
              Confirmar Busca de Autos
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Deseja buscar os documentos do processo <strong>{processoNumero}</strong>?</p>
                {modo === "mni" ? (
                  <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-xs text-blue-700 dark:text-blue-400 font-medium flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5" />
                      API MNI — Protocolo Oficial
                    </p>
                    <ul className="text-xs text-blue-600 dark:text-blue-500 mt-1.5 space-y-1 list-disc list-inside">
                      <li>Consulta via webservice oficial do CNJ</li>
                      <li>Suas credenciais (CPF/senha) serão usadas para autenticar</li>
                      <li>Retorna partes, documentos e movimentações</li>
                      <li>Sem risco de CAPTCHA ou bloqueio de portal</li>
                    </ul>
                  </div>
                ) : modo === "login_certificado" ? (
                  <div className="bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg border border-amber-200 dark:border-amber-800">
                    <p className="text-xs text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      Login com credenciais
                    </p>
                    <ul className="text-xs text-amber-600 dark:text-amber-500 mt-1.5 space-y-1 list-disc list-inside">
                      <li>Suas credenciais serão usadas para autenticar no PJe</li>
                      <li>Máximo de 3 tentativas falhadas antes do bloqueio de 1h</li>
                      <li>Acesso completo aos documentos do processo</li>
                    </ul>
                  </div>
                ) : (
                  <div className="bg-green-50 dark:bg-green-950/30 p-3 rounded-lg border border-green-200 dark:border-green-800">
                    <p className="text-xs text-green-700 dark:text-green-400 font-medium flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Modo seguro ativo
                    </p>
                    <ul className="text-xs text-green-600 dark:text-green-500 mt-1.5 space-y-1 list-disc list-inside">
                      <li>Apenas consulta processual pública será realizada</li>
                      <li>Nenhuma credencial de login será enviada ao tribunal</li>
                      <li>Sem risco de bloqueio de conta</li>
                    </ul>
                  </div>
                )}
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

// ============================================================
// Componente para exibir resultado MNI
// ============================================================
function MniResultadoView({ resultado }: { resultado: ResultadoMni }) {
  const partesAtivo = resultado.partes.filter((p) => p.polo === "ativo");
  const partesPassivo = resultado.partes.filter((p) => p.polo === "passivo");

  return (
    <div className="space-y-4 pt-3 border-t">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-green-600" />
        <span className="text-sm font-medium">{resultado.mensagem}</span>
        <Badge variant="secondary" className="text-[10px] ml-auto">MNI</Badge>
      </div>

      {/* Dados básicos */}
      {resultado.dadosBasicos.classe && (
        <div className="p-3 bg-muted/30 rounded-lg space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Scale className="w-3.5 h-3.5" />
            Classe / Assuntos
          </div>
          <p className="text-sm font-medium">{resultado.dadosBasicos.classe}</p>
          {resultado.dadosBasicos.assuntos.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {resultado.dadosBasicos.assuntos.map((a, i) => (
                <Badge key={i} variant="outline" className="text-[10px]">{a}</Badge>
              ))}
            </div>
          )}
          {resultado.dadosBasicos.orgaoJulgador && (
            <p className="text-xs text-muted-foreground mt-1">{resultado.dadosBasicos.orgaoJulgador}</p>
          )}
        </div>
      )}

      {/* Partes */}
      {resultado.partes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="w-3.5 h-3.5" />
            Partes do Processo
          </div>

          {partesAtivo.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-blue-600 uppercase">Polo Ativo</p>
              {partesAtivo.map((p, i) => (
                <div key={i} className="p-2 bg-blue-50 dark:bg-blue-950/20 rounded text-sm">
                  <p className="font-medium">{p.nome}</p>
                  {p.documento && <p className="text-xs text-muted-foreground">{p.documento}</p>}
                  {p.advogados.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Adv: {p.advogados.map((a) => `${a.nome} (${a.inscricao})`).join(", ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {partesPassivo.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-medium text-red-600 uppercase">Polo Passivo</p>
              {partesPassivo.map((p, i) => (
                <div key={i} className="p-2 bg-red-50 dark:bg-red-950/20 rounded text-sm">
                  <p className="font-medium">{p.nome}</p>
                  {p.documento && <p className="text-xs text-muted-foreground">{p.documento}</p>}
                  {p.advogados.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Adv: {p.advogados.map((a) => `${a.nome} (${a.inscricao})`).join(", ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Documentos */}
      {resultado.documentos.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <FileText className="w-3.5 h-3.5" />
            Documentos ({resultado.documentos.length})
          </div>
          <ScrollArea className="max-h-[200px]">
            <div className="space-y-1">
              {resultado.documentos.map((doc, i) => (
                <div key={doc.idDocumento || i} className="flex items-center gap-2 p-2 bg-muted/30 rounded text-sm">
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="truncate">{doc.descricao || doc.tipo}</span>
                  <Badge variant="outline" className="text-xs ml-auto shrink-0">{doc.tipo}</Badge>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Movimentações */}
      {resultado.movimentacoes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            Movimentações ({resultado.movimentacoes.length})
          </div>
          <ScrollArea className="max-h-[200px]">
            <div className="space-y-1">
              {resultado.movimentacoes.slice(0, 20).map((mov, i) => (
                <div key={i} className="p-2 bg-muted/30 rounded text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{mov.descricao || "Movimentação"}</span>
                    {mov.data && (
                      <span className="text-muted-foreground shrink-0 ml-2">{mov.data.slice(0, 10)}</span>
                    )}
                  </div>
                  {mov.complementos.length > 0 && (
                    <p className="text-muted-foreground mt-0.5">{mov.complementos.join("; ")}</p>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
