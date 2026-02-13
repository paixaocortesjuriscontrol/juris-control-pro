import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Sparkles, User, Scale, FileText, AlertCircle, Check } from "lucide-react";

interface AnaliseDocumentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analise: any;
  processo: any;
  onConfirm: (camposParaPreencher: Record<string, any>) => void;
  onSkip: () => void;
}

export function AnaliseDocumentoDialog({
  open,
  onOpenChange,
  analise,
  processo,
  onConfirm,
  onSkip,
}: AnaliseDocumentoDialogProps) {
  const [selectedFields, setSelectedFields] = useState<Record<string, boolean>>({});

  const camposExtraidos = analise?.campos_extraidos || {};
  const partes = analise?.partes || {};
  const advogados = analise?.advogados || [];
  const infoProcessual = analise?.info_processual || {};

  // Only show fields that exist in the processos table
  const VALID_COLUMNS = new Set([
    'polo_ativo', 'polo_passivo', 'vara', 'comarca', 'tribunal',
    'assunto', 'valor_causa', 'data_distribuicao', 'classe',
    'esfera', 'instancia', 'justica', 'natureza', 'materia',
    'advogado_externo', 'cpf_cnpj_parte_contraria', 'funcao_parte_contraria',
  ]);
  const camposDisponiveis: { key: string; label: string; valor: any; atual: any }[] = [];

  const addCampo = (key: string, label: string, valor: any) => {
    if (valor && !processo?.[key] && VALID_COLUMNS.has(key)) {
      camposDisponiveis.push({ key, label, valor, atual: processo?.[key] });
    }
  };

  // From campos_extraidos
  Object.entries(camposExtraidos).forEach(([key, valor]) => {
    const labels: Record<string, string> = {
      polo_ativo: "Reclamante / Polo Ativo",
      polo_passivo: "Reclamado / Polo Passivo",
      advogado_parte_contraria: "Advogado da Parte Contrária",
      vara: "Vara",
      comarca: "Comarca",
      tribunal: "Tribunal",
      assunto: "Assunto",
      valor_causa: "Valor da Causa",
      data_distribuicao: "Data de Distribuição",
      juiz: "Juiz",
      classe_judicial: "Classe Judicial",
    };
    addCampo(key, labels[key] || key, valor);
  });

  // From partes (fallback if not in campos_extraidos)
  if (partes.polo_ativo && !camposExtraidos.polo_ativo) {
    addCampo("polo_ativo", "Reclamante / Polo Ativo", partes.polo_ativo);
  }
  if (partes.polo_passivo && !camposExtraidos.polo_passivo) {
    addCampo("polo_passivo", "Reclamado / Polo Passivo", partes.polo_passivo);
  }

  // From info_processual (fallback)
  const infoMap: Record<string, string> = {
    vara: "Vara",
    comarca: "Comarca",
    tribunal: "Tribunal",
    juiz: "Juiz",
    classe_judicial: "Classe Judicial",
    assunto: "Assunto",
    valor_causa: "Valor da Causa",
    data_distribuicao: "Data de Distribuição",
  };
  Object.entries(infoMap).forEach(([key, label]) => {
    if (infoProcessual[key] && !camposExtraidos[key] && !processo?.[key]) {
      if (!camposDisponiveis.find(c => c.key === key)) {
        addCampo(key, label, infoProcessual[key]);
      }
    }
  });

  // Initialize all fields as selected when camposDisponiveis changes
  useEffect(() => {
    if (camposDisponiveis.length > 0) {
      const initial: Record<string, boolean> = {};
      camposDisponiveis.forEach(c => { initial[c.key] = true; });
      setSelectedFields(initial);
    }
  }, [analise]);

  if (!analise) return null;

  const toggleField = (key: string) => {
    setSelectedFields(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleConfirm = () => {
    const campos: Record<string, any> = {};
    camposDisponiveis.forEach(c => {
      if (selectedFields[c.key]) {
        campos[c.key] = c.valor;
      }
    });
    onConfirm(campos);
  };

  const formatValor = (key: string, valor: any) => {
    if (key === "valor_causa" && typeof valor === "number") {
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
    }
    return String(valor);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            Análise IA do Documento
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[55vh] pr-4">
          <div className="space-y-4">
            {/* Document info */}
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{analise.categoria}</Badge>
              {analise.tipo_documento && (
                <Badge variant="outline">{analise.tipo_documento}</Badge>
              )}
              <Badge
                variant={analise.confianca === "alta" ? "default" : analise.confianca === "media" ? "secondary" : "outline"}
              >
                Confiança: {analise.confianca}
              </Badge>
            </div>

            {analise.descricao && (
              <p className="text-sm text-muted-foreground">{analise.descricao}</p>
            )}

            {/* Partes encontradas */}
            {(partes.polo_ativo || partes.polo_passivo) && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <User className="w-4 h-4" /> Partes Identificadas
                </h4>
                <div className="grid grid-cols-1 gap-2 text-sm">
                  {partes.polo_ativo && (
                    <div className="rounded-md border p-2 bg-muted/30">
                      <span className="text-xs text-muted-foreground">Reclamante:</span>
                      <p className="font-medium">{partes.polo_ativo}</p>
                    </div>
                  )}
                  {partes.polo_passivo && (
                    <div className="rounded-md border p-2 bg-muted/30">
                      <span className="text-xs text-muted-foreground">Reclamado:</span>
                      <p className="font-medium">{partes.polo_passivo}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Advogados */}
            {advogados.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Scale className="w-4 h-4" /> Advogados Identificados
                </h4>
                <div className="space-y-1">
                  {advogados.map((adv: any, i: number) => (
                    <div key={i} className="text-sm rounded-md border p-2 bg-muted/30">
                      <span className="font-medium">{adv.nome}</span>
                      {adv.oab && <span className="text-muted-foreground ml-2">({adv.oab})</span>}
                      {adv.parte && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          {adv.parte}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Números de processo */}
            {analise.numeros_processo?.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Processos Encontrados
                </h4>
                <div className="flex flex-wrap gap-2">
                  {analise.numeros_processo.map((num: string, i: number) => (
                    <Badge key={i} variant="secondary" className="font-mono text-xs">
                      {num}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Auto-fill section */}
            {camposDisponiveis.length > 0 ? (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  Campos que podem ser preenchidos automaticamente
                </h4>
                <p className="text-xs text-muted-foreground">
                  Selecione os campos que deseja preencher no processo:
                </p>
                <div className="space-y-2">
                  {camposDisponiveis.map(campo => (
                    <div
                      key={campo.key}
                      className="flex items-start gap-3 rounded-md border p-3 bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => toggleField(campo.key)}
                    >
                      <Checkbox
                        checked={selectedFields[campo.key] ?? true}
                        onCheckedChange={() => toggleField(campo.key)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-muted-foreground">{campo.label}</p>
                        <p className="text-sm font-medium truncate">{formatValor(campo.key, campo.valor)}</p>
                      </div>
                      <Check className="w-4 h-4 text-emerald-500 mt-1 flex-shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <Check className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Todos os campos do processo já estão preenchidos!
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onSkip}>
            Pular
          </Button>
          {camposDisponiveis.length > 0 && (
            <Button onClick={handleConfirm} className="gap-2">
              <Sparkles className="w-4 h-4" />
              Preencher Selecionados
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}