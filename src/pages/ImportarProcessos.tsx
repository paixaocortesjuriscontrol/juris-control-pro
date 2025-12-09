import { useState, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { buscarAndamentosExternos } from "@/hooks/useBuscarAndamentos";
import { useCoordenacoesFull } from "@/hooks/useCoordenacoes";
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2, XCircle, Loader2, FileDown, List, Building2, Users, ArrowRightLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
interface ValidationError {
  campo: string;
  mensagem: string;
}

interface ProcessoImport {
  numero: string;
  assunto: string | null;
  situacao: string | null;
  responsavel: string | null;
  descricao: string | null;
  justica: string | null;
  cidade: string | null;
  estado: string | null;
  instancia: string | null;
  orgao: string | null;
  orgaoJulgador: string | null;
  sistema: string | null;
  area: string | null;
  fase: string | null;
  dataDistribuicao: string | null;
  classeCNJ: string | null;
  valorAcao: number | null;
  parteAtiva: string | null;
  partePassiva: string | null;
  cpfCnpjAtivo: string | null;
  cpfCnpjPassivo: string | null;
  status: "pendente" | "valido" | "invalido" | "sucesso" | "erro";
  erros: ValidationError[];
  erroImport?: string;
  linhaOriginal: number;
  // Projuris-specific fields
  identificadorProjuris?: string | null;
  pastaFisica?: string | null;
  pastaCliente?: string | null;
  dataCitacao?: string | null;
  dataRecebimento?: string | null;
  dataArquivamento?: string | null;
  valorProvisionado?: number | null;
  probabilidade?: string | null;
  risco?: string | null;
  transitadoJulgado?: boolean | null;
  resultado?: string | null;
  valorCondenacao?: number | null;
}

const validAreas = ["civil", "trabalhista", "empresarial", "cível", "civel", "trabalho", "empresa"];
const validSituacoes = ["ativo", "pendente", "urgente", "encerrado", "arquivado", "em andamento", "finalizado"];

const mapAreaToEnum = (area: string | null): "civil" | "trabalhista" | "empresarial" => {
  if (!area) return "civil";
  const areaLower = area.toLowerCase().trim();
  if (areaLower.includes("trabalhista") || areaLower.includes("trabalho")) return "trabalhista";
  if (areaLower.includes("empresarial") || areaLower.includes("empresa")) return "empresarial";
  return "civil";
};

const mapStatusToEnum = (situacao: string | null): "ativo" | "pendente" | "urgente" | "encerrado" | "arquivado" => {
  if (!situacao) return "ativo";
  const situacaoLower = situacao.toLowerCase().trim();
  if (situacaoLower.includes("encerrado") || situacaoLower.includes("finalizado")) return "encerrado";
  if (situacaoLower.includes("arquivado")) return "arquivado";
  if (situacaoLower.includes("urgente")) return "urgente";
  if (situacaoLower.includes("pendente")) return "pendente";
  return "ativo";
};

const parseDate = (dateValue: any): string | null => {
  if (!dateValue) return null;
  
  if (typeof dateValue === "number") {
    const date = XLSX.SSF.parse_date_code(dateValue);
    if (date) {
      return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
    }
  }
  
  if (typeof dateValue === "string") {
    const trimmed = dateValue.trim();
    if (!trimmed) return null;
    
    // DD/MM/YYYY format
    const brMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (brMatch) {
      const [, day, month, year] = brMatch;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    // YYYY-MM-DD format
    const isoMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoMatch) {
      return trimmed;
    }
  }
  
  return null;
};

const parseNumber = (value: any): number | null => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }
  return null;
};

const validateNumeroProcesso = (numero: string): boolean => {
  if (!numero || numero.trim() === "") return false;
  // Basic validation - should have some structure
  return numero.trim().length >= 5;
};

const validateProcesso = (processo: ProcessoImport): ValidationError[] => {
  const errors: ValidationError[] = [];
  
  // Required field: numero
  if (!processo.numero || processo.numero.trim() === "") {
    errors.push({ campo: "Número do processo", mensagem: "Campo obrigatório" });
  } else if (!validateNumeroProcesso(processo.numero)) {
    errors.push({ campo: "Número do processo", mensagem: "Formato inválido (mínimo 5 caracteres)" });
  }
  
  // Validate area if provided
  if (processo.area) {
    const areaLower = processo.area.toLowerCase().trim();
    const isValidArea = validAreas.some(a => areaLower.includes(a));
    if (!isValidArea) {
      errors.push({ campo: "Área", mensagem: `Valor inválido: "${processo.area}". Use: Civil, Trabalhista ou Empresarial` });
    }
  }
  
  // Validate situacao if provided
  if (processo.situacao) {
    const situacaoLower = processo.situacao.toLowerCase().trim();
    const isValidSituacao = validSituacoes.some(s => situacaoLower.includes(s));
    if (!isValidSituacao) {
      errors.push({ campo: "Situação", mensagem: `Valor inválido: "${processo.situacao}". Use: Ativo, Pendente, Urgente, Encerrado ou Arquivado` });
    }
  }
  
  // Validate date if provided
  if (processo.dataDistribuicao) {
    const parsedDate = parseDate(processo.dataDistribuicao);
    if (!parsedDate) {
      errors.push({ campo: "Distribuído", mensagem: `Data inválida: "${processo.dataDistribuicao}". Use formato DD/MM/AAAA` });
    }
  }
  
  // Validate valor if provided
  if (processo.valorAcao !== null && processo.valorAcao !== undefined) {
    const parsedValue = parseNumber(processo.valorAcao);
    if (parsedValue === null && String(processo.valorAcao) !== "") {
      errors.push({ campo: "Valor da ação", mensagem: `Valor numérico inválido: "${processo.valorAcao}"` });
    }
  }
  
  return errors;
};

interface BatchProcesso {
  numero: string;
  status: "pendente" | "processando" | "sucesso" | "erro";
  erroMensagem?: string;
  andamentosImportados?: number;
}

export default function ImportarProcessos() {
  const [file, setFile] = useState<File | null>(null);
  const [processos, setProcessos] = useState<ProcessoImport[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();

  // Batch import states
  const [batchText, setBatchText] = useState("");
  const [batchProcessos, setBatchProcessos] = useState<BatchProcesso[]>([]);
  const [batchImporting, setBatchImporting] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [selectedCoordenacao, setSelectedCoordenacao] = useState<string>("");
  const [selectedMembro, setSelectedMembro] = useState<string>("");
  const [selectedCliente, setSelectedCliente] = useState<string>("");

  // Projuris import states
  const [projurisFile, setProjurisFile] = useState<File | null>(null);
  const [projurisProcessos, setProjurisProcessos] = useState<ProcessoImport[]>([]);
  const [projurisImporting, setProjurisImporting] = useState(false);
  const [projurisProgress, setProjurisProgress] = useState(0);

  // Fetch coordenacoes
  const { data: coordenacoes = [] } = useCoordenacoesFull();

  // Fetch clientes
  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes-import"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, tipo")
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      parseExcel(selectedFile);
    }
  }, []);

  const parseExcel = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: null });

      const parsed: ProcessoImport[] = jsonData.map((row: any, index: number): ProcessoImport => {
        const processo: ProcessoImport = {
          numero: String(row["Número do processo"] || row["Numero do processo"] || "").trim(),
          assunto: row["Assunto"] || null,
          situacao: row["Situação"] || row["Situacao"] || null,
          responsavel: row["Responsável"] || row["Responsavel"] || null,
          descricao: row["Descrição"] || row["Descricao"] || null,
          justica: row["Justiça"] || row["Justica"] || null,
          cidade: row["Cidade"] || null,
          estado: row["Estado"] || null,
          instancia: row["Instância"] || row["Instancia"] || null,
          orgao: row["Órgão (Comarca / Tribunal)"] || row["Orgao (Comarca / Tribunal)"] || null,
          orgaoJulgador: row["Órgão Julgador (Vara / Câmara)"] || row["Orgao Julgador (Vara / Camara)"] || null,
          sistema: row["Sistema"] || null,
          area: row["Área"] || row["Area"] || null,
          fase: row["Fase"] || null,
          dataDistribuicao: row["Distribuído"] || row["Distribuido"] || null,
          classeCNJ: row["Classe – CNJ"] || row["Classe - CNJ"] || row["Classe CNJ"] || null,
          valorAcao: row["Valor da ação"] || row["Valor da acao"] || null,
          parteAtiva: row["Parte Ativa"] || null,
          partePassiva: row["Parte Passiva"] || null,
          cpfCnpjAtivo: row["CPF/CNPJ Parte Ativa"] || null,
          cpfCnpjPassivo: row["CPF/CNPJ Parte Passiva"] || null,
          status: "pendente",
          erros: [],
          linhaOriginal: index + 2, // +2 because Excel is 1-indexed and has header row
        };
        
        // Validate the processo
        processo.erros = validateProcesso(processo);
        processo.status = processo.erros.length > 0 ? "invalido" : "valido";
        
        return processo;
      });

      setProcessos(parsed);
      
      const validCount = parsed.filter(p => p.status === "valido").length;
      const invalidCount = parsed.filter(p => p.status === "invalido").length;
      
      if (parsed.length === 0) {
        toast({
          title: "Nenhum processo encontrado",
          description: "A planilha não contém dados. Verifique se a primeira linha contém os cabeçalhos.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Planilha carregada",
          description: `${parsed.length} linha(s): ${validCount} válida(s), ${invalidCount} com erro(s).`,
          variant: invalidCount > 0 ? "destructive" : "default",
        });
      }
    } catch (error) {
      console.error("Erro ao ler planilha:", error);
      toast({
        title: "Erro ao ler planilha",
        description: "Verifique se o arquivo está no formato correto (.xlsx ou .xls).",
        variant: "destructive",
      });
    }
  };

  const handleImport = async () => {
    const validProcessos = processos.filter(p => p.status === "valido");
    if (validProcessos.length === 0) {
      toast({
        title: "Nenhum processo válido",
        description: "Corrija os erros de validação antes de importar.",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    setProgress(0);

    const updatedProcessos = [...processos];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < updatedProcessos.length; i++) {
      const processo = updatedProcessos[i];
      
      // Skip invalid processos
      if (processo.status === "invalido") {
        continue;
      }
      
      try {
        // Check if process already exists
        const { data: existingProcesso } = await supabase
          .from("processos")
          .select("id")
          .eq("numero", processo.numero.trim())
          .maybeSingle();

        let processoId: string;
        let isUpdate = false;

        if (existingProcesso) {
          // Update existing process with coordination and member if selected
          const updateData: Record<string, any> = {};
          if (selectedCoordenacao) {
            updateData.coordenacao_id = selectedCoordenacao;
          }
          if (selectedMembro) {
            updateData.advogado_responsavel_id = selectedMembro;
          }
          
          if (Object.keys(updateData).length > 0) {
            await supabase.from("processos").update(updateData).eq("id", existingProcesso.id);
          }
          
          processoId = existingProcesso.id;
          isUpdate = true;
        } else {
          // Insert new process
          const { data: insertedProcesso, error } = await supabase.from("processos").insert({
            numero: processo.numero.trim(),
            assunto: processo.assunto,
            descricao: processo.descricao,
            area: mapAreaToEnum(processo.area),
            status: mapStatusToEnum(processo.situacao),
            tribunal: processo.orgao,
            vara: processo.orgaoJulgador,
            comarca: processo.cidade,
            classe: processo.classeCNJ,
            data_distribuicao: parseDate(processo.dataDistribuicao),
            valor_causa: parseNumber(processo.valorAcao),
            polo_ativo: processo.parteAtiva,
            polo_passivo: processo.partePassiva,
            coordenacao_id: selectedCoordenacao || null,
            advogado_responsavel_id: selectedMembro || null,
            cliente_id: selectedCliente || null,
          }).select("id").single();

          if (error) {
            updatedProcessos[i] = { ...processo, status: "erro", erroImport: error.message };
            errorCount++;
            continue;
          }
          
          processoId = insertedProcesso.id;
        }

        // Buscar dados adicionais da API se campos importantes estiverem vazios (only for new processes)
        if (!isUpdate) {
          const { data: apiData } = await supabase.functions.invoke("consultar-processo", {
            body: { numeroProcesso: processo.numero.trim() },
          });

          if (apiData?.found && apiData?.processo) {
            const processoApi = apiData.processo;
            
            // Extract parties (polo ativo e passivo) if not already set
            let poloAtivo = processo.parteAtiva;
            let poloPassivo = processo.partePassiva;
            
            if ((!poloAtivo || !poloPassivo) && processoApi.partes && processoApi.partes.length > 0) {
              const partesAtivas = processoApi.partes
                .filter((p: any) => p.tipo === 'POLO_ATIVO' || p.tipoParte === 'AUTOR' || p.tipoParte === 'REQUERENTE' || p.tipoParte === 'RECLAMANTE')
                .map((p: any) => p.nome)
                .filter(Boolean);
                
              const partesPassivas = processoApi.partes
                .filter((p: any) => p.tipo === 'POLO_PASSIVO' || p.tipoParte === 'REU' || p.tipoParte === 'REQUERIDO' || p.tipoParte === 'RECLAMADO')
                .map((p: any) => p.nome)
                .filter(Boolean);
                
              if (!poloAtivo && partesAtivas.length > 0) {
                poloAtivo = partesAtivas.join(', ');
              }
              if (!poloPassivo && partesPassivas.length > 0) {
                poloPassivo = partesPassivas.join(', ');
              }
            }

            // Update with API data for any empty fields
            const updateData: Record<string, any> = {};
            
            if (!processo.orgao && (processoApi.tribunal || apiData.tribunal)) {
              updateData.tribunal = processoApi.tribunal || apiData.tribunal;
            }
            if (!processo.orgaoJulgador && processoApi.orgaoJulgador) {
              updateData.vara = processoApi.orgaoJulgador;
            }
            if (!processo.classeCNJ && processoApi.classe) {
              updateData.classe = processoApi.classe;
            }
            if (!processo.assunto && processoApi.assunto) {
              updateData.assunto = processoApi.assunto;
            }
            if (!processo.parteAtiva && poloAtivo) {
              updateData.polo_ativo = poloAtivo;
            }
            if (!processo.partePassiva && poloPassivo) {
              updateData.polo_passivo = poloPassivo;
            }
            if (!parseDate(processo.dataDistribuicao) && processoApi.dataAjuizamento) {
              updateData.data_distribuicao = new Date(processoApi.dataAjuizamento.replace(/(\d{4})(\d{2})(\d{2}).*/, '$1-$2-$3')).toISOString().split('T')[0];
            }

            // Update area based on tribunal if not set in spreadsheet
            if (!processo.area) {
              const tribunalLower = (processoApi.tribunal || apiData.tribunal || "").toLowerCase();
              if (tribunalLower.includes("trt") || tribunalLower.includes("tst") || tribunalLower.includes("trabalho")) {
                updateData.area = "trabalhista";
              }
            }

            if (Object.keys(updateData).length > 0) {
              await supabase.from("processos").update(updateData).eq("id", processoId);
            }

            // Insert movements
            if (apiData.movimentos && apiData.movimentos.length > 0) {
              const movimentosToInsert = apiData.movimentos.map((mov: any) => ({
                processo_id: processoId,
                descricao: mov.nome || "Sem descrição",
                data_movimentacao: mov.data ? new Date(mov.data).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
                tipo: "API Externa",
                fonte: "DataJud/CNJ",
              }));

              await supabase.from("movimentacoes").insert(movimentosToInsert);
              console.log(`Processo ${processo.numero}: ${movimentosToInsert.length} andamentos importados`);
            }
          }
        }
        
        updatedProcessos[i] = { 
          ...processo, 
          status: "sucesso", 
          erroImport: isUpdate ? "Atualizado (já existia)" : undefined 
        };
        successCount++;
      } catch (err: any) {
        updatedProcessos[i] = { ...processo, status: "erro", erroImport: err.message };
        errorCount++;
      }

      setProgress(((i + 1) / updatedProcessos.length) * 100);
      setProcessos([...updatedProcessos]);
    }

    setImporting(false);

    toast({
      title: "Importação concluída",
      description: `${successCount} processo(s) importado(s). ${errorCount} erro(s) de importação.`,
      variant: errorCount > 0 ? "destructive" : "default",
    });
  };

  const downloadTemplate = () => {
    window.open("https://bfxahrrvoqxcdmfsvnrk.supabase.co/storage/v1/object/public/projuris_planilhas/MODELO_IMPORTACAO_PROCESSO_PADRAO.xlsx", "_blank");
  };

  const downloadRejeitados = () => {
    const rejeitados = processos.filter(p => p.status === "invalido" || p.status === "erro");
    
    if (rejeitados.length === 0) {
      toast({
        title: "Nenhum rejeitado",
        description: "Não há processos rejeitados para exportar.",
      });
      return;
    }

    const exportData = rejeitados.map(p => ({
      "Linha": p.linhaOriginal,
      "Número do processo": p.numero,
      "Área": p.area,
      "Situação": p.situacao,
      "Parte Ativa": p.parteAtiva,
      "Parte Passiva": p.partePassiva,
      "Órgão (Comarca / Tribunal)": p.orgao,
      "Distribuído": p.dataDistribuicao,
      "Valor da ação": p.valorAcao,
      "Erros de Validação": p.erros.map(e => `${e.campo}: ${e.mensagem}`).join("; "),
      "Erro de Importação": p.erroImport || "",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rejeitados");
    
    // Auto-size columns
    const colWidths = Object.keys(exportData[0] || {}).map(key => ({
      wch: Math.max(key.length, 15)
    }));
    ws["!cols"] = colWidths;
    
    XLSX.writeFile(wb, `processos_rejeitados_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    toast({
      title: "Arquivo gerado",
      description: `${rejeitados.length} processo(s) rejeitado(s) exportado(s).`,
    });
  };

  // Batch import functions
  const parseBatchNumbers = () => {
    const lines = batchText.split('\n')
      .map(line => line.trim())
      .filter(line => line.length >= 5);
    
    const uniqueNumbers = [...new Set(lines)];
    
    const parsed: BatchProcesso[] = uniqueNumbers.map(numero => ({
      numero,
      status: "pendente" as const,
    }));

    setBatchProcessos(parsed);
    
    if (parsed.length === 0) {
      toast({
        title: "Nenhum número válido",
        description: "Insira pelo menos um número de processo válido (mínimo 5 caracteres).",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Números carregados",
        description: `${parsed.length} número(s) de processo(s) encontrado(s).`,
      });
    }
  };

  const handleBatchImport = async () => {
    if (batchProcessos.length === 0) {
      toast({
        title: "Nenhum processo para importar",
        description: "Primeiro carregue os números dos processos.",
        variant: "destructive",
      });
      return;
    }

    setBatchImporting(true);
    setBatchProgress(0);

    const updatedProcessos = [...batchProcessos];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < updatedProcessos.length; i++) {
      const processo = updatedProcessos[i];
      updatedProcessos[i] = { ...processo, status: "processando" };
      setBatchProcessos([...updatedProcessos]);

      try {
        // Check if process already exists
        const { data: existingProcesso } = await supabase
          .from("processos")
          .select("id")
          .eq("numero", processo.numero)
          .maybeSingle();

        let processoId: string;
        let isUpdate = false;
        let andamentosImportados = 0;

        if (existingProcesso) {
          // Update existing process with coordination and member if selected
          const updateData: Record<string, any> = {};
          if (selectedCoordenacao) {
            updateData.coordenacao_id = selectedCoordenacao;
          }
          if (selectedMembro) {
            updateData.advogado_responsavel_id = selectedMembro;
          }
          
          if (Object.keys(updateData).length > 0) {
            await supabase.from("processos").update(updateData).eq("id", existingProcesso.id);
          }
          
          processoId = existingProcesso.id;
          isUpdate = true;
        } else {
          // Insert process with minimal data - system will fetch details from API
          const { data: insertedProcesso, error } = await supabase.from("processos").insert({
            numero: processo.numero,
            area: "civil", // Default area
            status: "ativo",
            coordenacao_id: selectedCoordenacao || null,
            advogado_responsavel_id: selectedMembro || null,
            cliente_id: selectedCliente || null,
          }).select("id").single();

          if (error) {
            updatedProcessos[i] = { 
              ...processo, 
              status: "erro", 
              erroMensagem: error.message 
            };
            errorCount++;
            continue;
          }
          
          processoId = insertedProcesso.id;
        }

        // Fetch process details and movements from external API (only for new processes)
        if (!isUpdate) {
          const { data: apiData } = await supabase.functions.invoke("consultar-processo", {
            body: { numeroProcesso: processo.numero },
          });

          // Update process with API data if found
          if (apiData?.found && apiData?.processo) {
            const processoApi = apiData.processo;
            
            // Extract parties (polo ativo e passivo)
            let poloAtivo: string | null = null;
            let poloPassivo: string | null = null;
            
            if (processoApi.partes && processoApi.partes.length > 0) {
              const partesAtivas = processoApi.partes
                .filter((p: any) => p.tipo === 'POLO_ATIVO' || p.tipoParte === 'AUTOR' || p.tipoParte === 'REQUERENTE' || p.tipoParte === 'RECLAMANTE')
                .map((p: any) => p.nome)
                .filter(Boolean);
                
              const partesPassivas = processoApi.partes
                .filter((p: any) => p.tipo === 'POLO_PASSIVO' || p.tipoParte === 'REU' || p.tipoParte === 'REQUERIDO' || p.tipoParte === 'RECLAMADO')
                .map((p: any) => p.nome)
                .filter(Boolean);
                
              if (partesAtivas.length > 0) {
                poloAtivo = partesAtivas.join(', ');
              }
              if (partesPassivas.length > 0) {
                poloPassivo = partesPassivas.join(', ');
              }
            }

            // Determine area based on tribunal
            let area: "civil" | "trabalhista" | "empresarial" = "civil";
            const tribunalLower = (processoApi.tribunal || apiData.tribunal || "").toLowerCase();
            if (tribunalLower.includes("trt") || tribunalLower.includes("tst") || tribunalLower.includes("trabalho")) {
              area = "trabalhista";
            }
            
            await supabase.from("processos").update({
              tribunal: processoApi.tribunal || apiData.tribunal || null,
              vara: processoApi.orgaoJulgador || null,
              classe: processoApi.classe || null,
              assunto: processoApi.assunto || null,
              polo_ativo: poloAtivo,
              polo_passivo: poloPassivo,
              area: area,
              data_distribuicao: processoApi.dataAjuizamento 
                ? new Date(processoApi.dataAjuizamento.replace(/(\d{4})(\d{2})(\d{2}).*/, '$1-$2-$3')).toISOString().split('T')[0]
                : null,
            }).eq("id", processoId);

            // Insert movements if available
            if (apiData.movimentos && apiData.movimentos.length > 0) {
              const movimentosToInsert = apiData.movimentos.map((mov: any) => ({
                processo_id: processoId,
                descricao: mov.nome || "Sem descrição",
                data_movimentacao: mov.data ? new Date(mov.data).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
                tipo: "API Externa",
                fonte: "DataJud/CNJ",
              }));

              await supabase.from("movimentacoes").insert(movimentosToInsert);
              andamentosImportados = movimentosToInsert.length;
            }
          }
        }
        
        updatedProcessos[i] = { 
          ...processo, 
          status: "sucesso",
          andamentosImportados,
          erroMensagem: isUpdate ? "Atualizado (já existia)" : undefined,
        };
        successCount++;
      } catch (err: any) {
        updatedProcessos[i] = { 
          ...processo, 
          status: "erro", 
          erroMensagem: err.message 
        };
        errorCount++;
      }

      setBatchProgress(((i + 1) / updatedProcessos.length) * 100);
      setBatchProcessos([...updatedProcessos]);
    }

    setBatchImporting(false);

    toast({
      title: "Importação concluída",
      description: `${successCount} processo(s) importado(s). ${errorCount} erro(s).`,
      variant: errorCount > 0 ? "destructive" : "default",
    });
  };

  const clearBatch = () => {
    setBatchText("");
    setBatchProcessos([]);
    setBatchProgress(0);
    setSelectedCoordenacao("");
    setSelectedMembro("");
    setSelectedCliente("");
  };

  // Projuris Excel parsing
  const handleProjurisFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setProjurisFile(selectedFile);
      parseProjurisExcel(selectedFile);
    }
  }, []);

  const parseProjurisExcel = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: null, range: 2 }); // Start from row 3 (index 2) to skip header rows

      const parsed: ProcessoImport[] = jsonData
        .filter((row: any) => {
          // Skip empty rows and header rows - check for "Número CNJ" column
          const numeroCNJ = row["Número CNJ"] || "";
          return numeroCNJ && numeroCNJ.trim().length >= 5 && !numeroCNJ.includes("Número CNJ");
        })
        .map((row: any, index: number): ProcessoImport => {
          // Parse Projuris columns exactly as exported
          const numeroCNJ = String(row["Número CNJ"] || "").trim();
          const assunto = row["Assunto"] || null;
          const situacao = row["Situação"] || row["Situacao"] || null;
          const status = row["Status"] || null;
          const justica = row["Justiça"] || row["Justica"] || null;
          const instancia = row["Instância"] || row["Instancia"] || null;
          const orgao = row["Órgao"] || row["Orgao"] || null; // Note: Projuris uses "Órgao" (without accent on second 'a')
          const orgaoJulgador = row["Órgão julgador"] || row["Orgao julgador"] || null;
          const tipoOrgaoJulgador = row["Tipo órgão julgador"] || row["Tipo orgao julgador"] || null;
          const complemento = row["Complemento"] || null;
          const area = row["Área"] || row["Area"] || null;
          const fase = row["Fase"] || null;
          const dataDistribuicao = row["Data distribuição"] || row["Data distribuicao"] || null;
          const dataCitacao = row["Data citação"] || row["Data citacao"] || null;
          const dataRecebimento = row["Data recebimento"] || null;
          const dataArquivamento = row["Data arquivamento"] || null;
          const dataInclusao = row["Data inclusão"] || row["Data inclusao"] || null;
          const valorAcao = row["Valor ação"] || row["Valor acao"] || null;
          const valorProvisionado = row["Valor provisionado"] || null;
          const probabilidade = row["Probabilidade"] || null;
          const risco = row["Risco"] || null;
          const dataEncerramento = row["Data encerramento"] || null;
          const transitadoEmJulgado = row["Transitado em julgado"] || null;
          const resultado = row["Resultado"] || null;
          const valorCondenacao = row["Valor da condenação"] || row["Valor da condenacao"] || null;
          const descricaoEncerramento = row["Descrição do encerramento"] || row["Descricao do encerramento"] || null;
          const partesAtivas = row["Partes ativas"] || null;
          const partesPassivas = row["Partes passivas"] || null;
          const estado = row["Estado"] || null;
          const cidade = row["Cidade"] || null;
          const clientes = row["Clientes"] || null;
          const responsaveis = row["Responsáveis"] || row["Responsaveis"] || null;
          const descricao = row["Descrição"] || row["Descricao"] || null;
          const identificador = row["Identificador"] || null;
          const pastaFisica = row["Pasta física"] || row["Pasta fisica"] || null;
          const pastaCliente = row["Pasta cliente"] || null;
          const unidadeAtual = row["Unidade atual"] || null;
          const gruposTrabalho = row["Grupos de trabalho"] || null;
          const marcadores = row["Marcadores"] || null;

          // Map Projuris status to our status
          const mapProjurisSituacao = (sit: string | null, stat: string | null): string | null => {
            if (stat?.toLowerCase().includes("habilitado")) return "ativo";
            if (stat?.toLowerCase().includes("desabilitado")) return "arquivado";
            return sit;
          };

          const processo: ProcessoImport = {
            numero: numeroCNJ,
            assunto: assunto,
            situacao: mapProjurisSituacao(situacao, status),
            responsavel: responsaveis,
            descricao: descricao || complemento,
            justica: justica,
            cidade: cidade,
            estado: estado,
            instancia: instancia,
            orgao: orgao,
            orgaoJulgador: orgaoJulgador || tipoOrgaoJulgador,
            sistema: null,
            area: area,
            fase: fase,
            dataDistribuicao: dataDistribuicao,
            classeCNJ: null,
            valorAcao: valorAcao,
            parteAtiva: partesAtivas ? extractPartyName(partesAtivas) : null,
            partePassiva: partesPassivas ? extractPartyName(partesPassivas) : null,
            cpfCnpjAtivo: null,
            cpfCnpjPassivo: null,
            status: "pendente",
            erros: [],
            linhaOriginal: index + 4, // +4 because we skip 2 header rows and Excel is 1-indexed
            // Projuris-specific fields
            identificadorProjuris: identificador,
            pastaFisica: pastaFisica,
            pastaCliente: pastaCliente,
            dataCitacao: dataCitacao,
            dataRecebimento: dataRecebimento,
            dataArquivamento: dataArquivamento,
            valorProvisionado: valorProvisionado,
            probabilidade: probabilidade,
            risco: risco,
            transitadoJulgado: transitadoEmJulgado?.toLowerCase() === "sim" || transitadoEmJulgado === true,
            resultado: resultado,
            valorCondenacao: valorCondenacao,
          };
          
          // Validate the processo
          processo.erros = validateProcesso(processo);
          processo.status = processo.erros.length > 0 ? "invalido" : "valido";
          
          return processo;
        });

      setProjurisProcessos(parsed);
      
      const validCount = parsed.filter(p => p.status === "valido").length;
      const invalidCount = parsed.filter(p => p.status === "invalido").length;
      
      if (parsed.length === 0) {
        toast({
          title: "Nenhum processo encontrado",
          description: "A planilha não contém dados válidos. Verifique se é uma planilha exportada do Projuris.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Planilha Projuris carregada",
          description: `${parsed.length} processo(s): ${validCount} válido(s), ${invalidCount} com erro(s).`,
          variant: invalidCount > 0 ? "destructive" : "default",
        });
      }
    } catch (error) {
      console.error("Erro ao ler planilha Projuris:", error);
      toast({
        title: "Erro ao ler planilha",
        description: "Verifique se o arquivo é uma planilha do Projuris no formato correto (.xlsx).",
        variant: "destructive",
      });
    }
  };

  // Helper to extract party name from Projuris format: "NOME (Tipo)"
  const extractPartyName = (partyString: string): string => {
    if (!partyString) return "";
    // Remove the role/type in parentheses, e.g., "BANCO SANTANDER (Requerido)" -> "BANCO SANTANDER"
    return partyString.replace(/\s*\([^)]*\)\s*$/, "").trim();
  };

  const handleProjurisImport = async () => {
    const validProcessos = projurisProcessos.filter(p => p.status === "valido");
    if (validProcessos.length === 0) {
      toast({
        title: "Nenhum processo válido",
        description: "Corrija os erros de validação antes de importar.",
        variant: "destructive",
      });
      return;
    }

    setProjurisImporting(true);
    setProjurisProgress(0);

    const updatedProcessos = [...projurisProcessos];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < updatedProcessos.length; i++) {
      const processo = updatedProcessos[i];
      
      // Skip invalid processos
      if (processo.status === "invalido") {
        continue;
      }
      
      try {
        // Check if process already exists
        const { data: existingProcesso } = await supabase
          .from("processos")
          .select("id")
          .eq("numero", processo.numero.trim())
          .maybeSingle();

        let processoId: string;
        let isUpdate = false;

        if (existingProcesso) {
          // Update existing process with coordination and member if selected
          const updateData: Record<string, any> = {};
          if (selectedCoordenacao) {
            updateData.coordenacao_id = selectedCoordenacao;
          }
          if (selectedMembro) {
            updateData.advogado_responsavel_id = selectedMembro;
          }
          if (selectedCliente) {
            updateData.cliente_id = selectedCliente;
          }
          
          if (Object.keys(updateData).length > 0) {
            await supabase.from("processos").update(updateData).eq("id", existingProcesso.id);
          }
          
          processoId = existingProcesso.id;
          isUpdate = true;
        } else {
          // Insert new process with all Projuris fields
          const { data: insertedProcesso, error } = await supabase.from("processos").insert({
            numero: processo.numero.trim(),
            assunto: processo.assunto,
            descricao: processo.descricao,
            area: mapAreaToEnum(processo.area),
            status: mapStatusToEnum(processo.situacao),
            tribunal: processo.orgao,
            vara: processo.orgaoJulgador,
            comarca: processo.cidade,
            classe: processo.classeCNJ,
            data_distribuicao: parseDate(processo.dataDistribuicao),
            valor_causa: parseNumber(processo.valorAcao),
            polo_ativo: processo.parteAtiva,
            polo_passivo: processo.partePassiva,
            coordenacao_id: selectedCoordenacao || null,
            advogado_responsavel_id: selectedMembro || null,
            cliente_id: selectedCliente || null,
            // Projuris-specific fields
            identificador_projuris: processo.identificadorProjuris || null,
            pasta_fisica: processo.pastaFisica || null,
            pasta_cliente: processo.pastaCliente || null,
            justica: processo.justica || null,
            instancia: processo.instancia || null,
            fase: processo.fase || null,
            data_citacao: parseDate(processo.dataCitacao),
            data_recebimento: parseDate(processo.dataRecebimento),
            data_arquivamento: parseDate(processo.dataArquivamento),
            valor_provisionado: parseNumber(processo.valorProvisionado),
            probabilidade: processo.probabilidade || null,
            risco: processo.risco || null,
            transitado_julgado: processo.transitadoJulgado || false,
            resultado: processo.resultado || null,
            valor_condenacao: parseNumber(processo.valorCondenacao),
            uf: processo.estado || null,
            responsaveis_projuris: processo.responsavel || null,
          }).select("id").single();

          if (error) {
            updatedProcessos[i] = { ...processo, status: "erro", erroImport: error.message };
            errorCount++;
            continue;
          }
          
          processoId = insertedProcesso.id;
        }

        // Fetch additional data from API for new processes
        if (!isUpdate) {
          const { data: apiData } = await supabase.functions.invoke("consultar-processo", {
            body: { numeroProcesso: processo.numero.trim() },
          });

          if (apiData?.found && apiData?.processo) {
            const processoApi = apiData.processo;
            
            // Extract parties if not already set
            let poloAtivo = processo.parteAtiva;
            let poloPassivo = processo.partePassiva;
            
            if ((!poloAtivo || !poloPassivo) && processoApi.partes && processoApi.partes.length > 0) {
              const partesAtivas = processoApi.partes
                .filter((p: any) => p.tipo === 'POLO_ATIVO' || p.tipoParte === 'AUTOR' || p.tipoParte === 'REQUERENTE' || p.tipoParte === 'RECLAMANTE')
                .map((p: any) => p.nome)
                .filter(Boolean);
                
              const partesPassivas = processoApi.partes
                .filter((p: any) => p.tipo === 'POLO_PASSIVO' || p.tipoParte === 'REU' || p.tipoParte === 'REQUERIDO' || p.tipoParte === 'RECLAMADO')
                .map((p: any) => p.nome)
                .filter(Boolean);
                
              if (!poloAtivo && partesAtivas.length > 0) {
                poloAtivo = partesAtivas.join(', ');
              }
              if (!poloPassivo && partesPassivas.length > 0) {
                poloPassivo = partesPassivas.join(', ');
              }
            }

            // Update with API data for empty fields
            const updateData: Record<string, any> = {};
            
            if (!processo.orgao && (processoApi.tribunal || apiData.tribunal)) {
              updateData.tribunal = processoApi.tribunal || apiData.tribunal;
            }
            if (!processo.orgaoJulgador && processoApi.orgaoJulgador) {
              updateData.vara = processoApi.orgaoJulgador;
            }
            if (!processo.classeCNJ && processoApi.classe) {
              updateData.classe = processoApi.classe;
            }
            if (!processo.assunto && processoApi.assunto) {
              updateData.assunto = processoApi.assunto;
            }
            if (!processo.parteAtiva && poloAtivo) {
              updateData.polo_ativo = poloAtivo;
            }
            if (!processo.partePassiva && poloPassivo) {
              updateData.polo_passivo = poloPassivo;
            }
            if (!parseDate(processo.dataDistribuicao) && processoApi.dataAjuizamento) {
              updateData.data_distribuicao = new Date(processoApi.dataAjuizamento.replace(/(\d{4})(\d{2})(\d{2}).*/, '$1-$2-$3')).toISOString().split('T')[0];
            }

            // Update area based on tribunal if not set
            if (!processo.area) {
              const tribunalLower = (processoApi.tribunal || apiData.tribunal || "").toLowerCase();
              if (tribunalLower.includes("trt") || tribunalLower.includes("tst") || tribunalLower.includes("trabalho")) {
                updateData.area = "trabalhista";
              }
            }

            if (Object.keys(updateData).length > 0) {
              await supabase.from("processos").update(updateData).eq("id", processoId);
            }

            // Insert movements
            if (apiData.movimentos && apiData.movimentos.length > 0) {
              const movimentosToInsert = apiData.movimentos.map((mov: any) => ({
                processo_id: processoId,
                descricao: mov.nome || "Sem descrição",
                data_movimentacao: mov.data ? new Date(mov.data).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
                tipo: "API Externa",
                fonte: "DataJud/CNJ",
              }));

              await supabase.from("movimentacoes").insert(movimentosToInsert);
            }
          }
        }
        
        updatedProcessos[i] = { 
          ...processo, 
          status: "sucesso", 
          erroImport: isUpdate ? "Atualizado (já existia)" : undefined 
        };
        successCount++;
      } catch (err: any) {
        updatedProcessos[i] = { ...processo, status: "erro", erroImport: err.message };
        errorCount++;
      }

      setProjurisProgress(((i + 1) / updatedProcessos.length) * 100);
      setProjurisProcessos([...updatedProcessos]);
    }

    setProjurisImporting(false);

    toast({
      title: "Importação Projuris concluída",
      description: `${successCount} processo(s) importado(s). ${errorCount} erro(s) de importação.`,
      variant: errorCount > 0 ? "destructive" : "default",
    });
  };

  const downloadProjurisRejeitados = () => {
    const rejeitados = projurisProcessos.filter(p => p.status === "invalido" || p.status === "erro");
    
    if (rejeitados.length === 0) {
      toast({
        title: "Nenhum rejeitado",
        description: "Não há processos rejeitados para exportar.",
      });
      return;
    }

    const exportData = rejeitados.map(p => ({
      "Linha": p.linhaOriginal,
      "Número CNJ": p.numero,
      "Área": p.area,
      "Situação": p.situacao,
      "Parte Ativa": p.parteAtiva,
      "Parte Passiva": p.partePassiva,
      "Órgão": p.orgao,
      "Data Distribuição": p.dataDistribuicao,
      "Valor da Ação": p.valorAcao,
      "Erros de Validação": p.erros.map(e => `${e.campo}: ${e.mensagem}`).join("; "),
      "Erro de Importação": p.erroImport || "",
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rejeitados");
    
    // Auto-size columns
    const colWidths = Object.keys(exportData[0] || {}).map(key => ({
      wch: Math.max(key.length, 15)
    }));
    ws["!cols"] = colWidths;
    
    XLSX.writeFile(wb, `projuris_rejeitados_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    toast({
      title: "Arquivo gerado",
      description: `${rejeitados.length} processo(s) rejeitado(s) exportado(s).`,
    });
  };

  const clearProjuris = () => {
    setProjurisFile(null);
    setProjurisProcessos([]);
    setProjurisProgress(0);
  };

  // Get members of selected coordination
  const membrosDisponiveis = selectedCoordenacao 
    ? coordenacoes.find(c => c.id === selectedCoordenacao)?.membros?.filter(m => m.usuario?.id).map(m => ({
        id: m.usuario!.id,
        nome: m.usuario!.nome,
      })) || []
    : [];

  const batchSuccessCount = batchProcessos.filter(p => p.status === "sucesso").length;
  const batchErrorCount = batchProcessos.filter(p => p.status === "erro").length;
  const batchPendingCount = batchProcessos.filter(p => p.status === "pendente").length;

  const validCount = processos.filter(p => p.status === "valido").length;
  const invalidCount = processos.filter(p => p.status === "invalido").length;
  const successCount = processos.filter(p => p.status === "sucesso").length;
  const errorCount = processos.filter(p => p.status === "erro").length;
  const totalRejeitados = invalidCount + errorCount;

  const projurisValidCount = projurisProcessos.filter(p => p.status === "valido").length;
  const projurisInvalidCount = projurisProcessos.filter(p => p.status === "invalido").length;
  const projurisSuccessCount = projurisProcessos.filter(p => p.status === "sucesso").length;
  const projurisErrorCount = projurisProcessos.filter(p => p.status === "erro").length;
  const projurisTotalRejeitados = projurisInvalidCount + projurisErrorCount;

  return (
    <MainLayout title="Importar Processos" subtitle="Importe processos em lote">
      <div className="space-y-6">
        <Tabs defaultValue="lista" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-lg">
            <TabsTrigger value="lista" className="flex items-center gap-2">
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">Lista</span>
            </TabsTrigger>
            <TabsTrigger value="planilha" className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              <span className="hidden sm:inline">Planilha</span>
            </TabsTrigger>
            <TabsTrigger value="projuris" className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Projuris</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab: Lista de Números */}
          <TabsContent value="lista" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <List className="h-5 w-5" />
                  Importação por Lista
                </CardTitle>
                <CardDescription>
                  Cole os números dos processos, um por linha. O sistema cadastrará todos e buscará os andamentos automaticamente.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Coordenação Selection */}
                <div className="space-y-2">
                  <Label htmlFor="coordenacao" className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Coordenação Responsável
                  </Label>
                  <Select 
                    value={selectedCoordenacao} 
                    onValueChange={(value) => {
                      setSelectedCoordenacao(value);
                      setSelectedMembro(""); // Reset member when coordination changes
                    }}
                    disabled={batchImporting}
                  >
                    <SelectTrigger id="coordenacao">
                      <SelectValue placeholder="Selecione a coordenação (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {coordenacoes.map((coord) => (
                        <SelectItem key={coord.id} value={coord.id}>
                          {coord.nome} ({coord.area})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Os processos serão atribuídos a esta coordenação para posterior distribuição aos membros.
                  </p>
                </div>

                {/* Member Selection */}
                {selectedCoordenacao && membrosDisponiveis.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="membro" className="flex items-center gap-2">
                      Advogado Responsável (opcional)
                    </Label>
                    <Select 
                      value={selectedMembro} 
                      onValueChange={setSelectedMembro}
                      disabled={batchImporting}
                    >
                      <SelectTrigger id="membro">
                        <SelectValue placeholder="Selecione o advogado responsável" />
                      </SelectTrigger>
                      <SelectContent>
                        {membrosDisponiveis.map((membro) => (
                          <SelectItem key={membro.id} value={membro.id}>
                            {membro.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Se selecionado, os processos já serão atribuídos diretamente a este advogado.
                    </p>
                  </div>
                )}

                {/* Cliente Selection */}
                <div className="space-y-2">
                  <Label htmlFor="cliente" className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Cliente (opcional)
                  </Label>
                  <Select 
                    value={selectedCliente} 
                    onValueChange={setSelectedCliente}
                    disabled={batchImporting}
                  >
                    <SelectTrigger id="cliente">
                      <SelectValue placeholder="Selecione o cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientes.map((cliente) => (
                        <SelectItem key={cliente.id} value={cliente.id}>
                          {cliente.nome} ({cliente.tipo === "pessoa_fisica" ? "PF" : "PJ"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Todos os processos serão vinculados a este cliente.
                  </p>
                </div>

                <div>
                  <Label htmlFor="numeros">Números dos Processos</Label>
                  <Textarea
                    id="numeros"
                    placeholder={"Cole os números dos processos aqui, um por linha:\n\n0001234-56.2024.8.21.0001\n0002345-67.2024.8.21.0002\n0003456-78.2024.8.21.0003"}
                    value={batchText}
                    onChange={(e) => setBatchText(e.target.value)}
                    className="min-h-[200px] font-mono text-sm mt-2"
                    disabled={batchImporting}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={parseBatchNumbers} disabled={batchImporting || !batchText.trim()}>
                    Carregar Números
                  </Button>
                  {batchProcessos.length > 0 && (
                    <>
                      <Button 
                        onClick={handleBatchImport} 
                        disabled={batchImporting || batchPendingCount === 0}
                        variant="default"
                      >
                        {batchImporting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Importando...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            Importar ({batchPendingCount})
                          </>
                        )}
                      </Button>
                      <Button variant="outline" onClick={clearBatch} disabled={batchImporting}>
                        Limpar
                      </Button>
                    </>
                  )}
                </div>
                
                {batchImporting && (
                  <Progress value={batchProgress} className="mt-4" />
                )}
              </CardContent>
            </Card>

            {/* Batch Results */}
            {batchProcessos.length > 0 && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <CardTitle>Processos</CardTitle>
                      <CardDescription>
                        {batchProcessos.length} número(s) carregado(s)
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2 text-sm flex-wrap">
                      {batchPendingCount > 0 && (
                        <Badge variant="outline" className="bg-muted">
                          {batchPendingCount} pendentes
                        </Badge>
                      )}
                      {batchSuccessCount > 0 && (
                        <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">
                          {batchSuccessCount} importados
                        </Badge>
                      )}
                      {batchErrorCount > 0 && (
                        <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-200">
                          {batchErrorCount} erros
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="border rounded-lg overflow-hidden">
                    <div className="max-h-[400px] overflow-auto">
                      <Table>
                        <TableHeader className="sticky top-0 bg-background">
                          <TableRow>
                            <TableHead className="w-[50px]">#</TableHead>
                            <TableHead className="w-[60px]">Status</TableHead>
                            <TableHead>Número do Processo</TableHead>
                            <TableHead>Andamentos</TableHead>
                            <TableHead>Observação</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {batchProcessos.map((processo, index) => (
                            <TableRow 
                              key={index} 
                              className={
                                processo.status === "erro" ? "bg-red-50 dark:bg-red-950/20" : 
                                processo.status === "sucesso" ? "bg-green-50 dark:bg-green-950/20" : ""
                              }
                            >
                              <TableCell className="text-muted-foreground">
                                {index + 1}
                              </TableCell>
                              <TableCell>
                                {processo.status === "pendente" && (
                                  <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
                                )}
                                {processo.status === "processando" && (
                                  <Loader2 className="h-4 w-4 text-primary animate-spin" />
                                )}
                                {processo.status === "sucesso" && (
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                )}
                                {processo.status === "erro" && (
                                  <XCircle className="h-4 w-4 text-red-500" />
                                )}
                              </TableCell>
                              <TableCell className="font-mono text-sm">
                                {processo.numero}
                              </TableCell>
                              <TableCell>
                                {processo.status === "sucesso" && processo.andamentosImportados !== undefined && (
                                  <span className="text-muted-foreground">
                                    {processo.andamentosImportados} importado(s)
                                  </span>
                                )}
                                {processo.status !== "sucesso" && "-"}
                              </TableCell>
                              <TableCell className="text-sm">
                                {processo.status === "erro" && (
                                  <span className="text-red-600">{processo.erroMensagem}</span>
                                )}
                                {processo.status === "sucesso" && (
                                  <span className="text-green-600">Importado com sucesso</span>
                                )}
                                {processo.status === "pendente" && "-"}
                                {processo.status === "processando" && (
                                  <span className="text-muted-foreground">Processando...</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Tab: Planilha Excel */}
          <TabsContent value="planilha" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5" />
                  Importação por Planilha
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <h4 className="font-medium mb-2">1. Baixe o modelo</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Utilize o modelo padrão para preencher os dados dos processos.
                    </p>
                    <Button variant="outline" onClick={downloadTemplate}>
                      <Download className="h-4 w-4 mr-2" />
                      Baixar Modelo
                    </Button>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">2. Faça upload da planilha</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Após preencher, faça o upload do arquivo para validar e importar.
                    </p>
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={handleFileChange}
                        className="max-w-xs"
                      />
                    </div>
                  </div>
                </div>
                
                {/* Coordenação Selection for Excel Import */}
                <div className="space-y-2 pt-4 border-t">
                  <Label htmlFor="coordenacao-excel" className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Coordenação Responsável
                  </Label>
                  <Select 
                    value={selectedCoordenacao} 
                    onValueChange={(value) => {
                      setSelectedCoordenacao(value);
                      setSelectedMembro(""); // Reset member when coordination changes
                    }}
                    disabled={importing}
                  >
                    <SelectTrigger id="coordenacao-excel" className="max-w-md">
                      <SelectValue placeholder="Selecione a coordenação (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {coordenacoes.map((coord) => (
                        <SelectItem key={coord.id} value={coord.id}>
                          {coord.nome} ({coord.area})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Todos os processos importados serão atribuídos a esta coordenação para posterior distribuição.
                  </p>
                </div>

                {/* Member Selection for Excel Import */}
                {selectedCoordenacao && membrosDisponiveis.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="membro-excel" className="flex items-center gap-2">
                      Advogado Responsável (opcional)
                    </Label>
                    <Select 
                      value={selectedMembro} 
                      onValueChange={setSelectedMembro}
                      disabled={importing}
                    >
                      <SelectTrigger id="membro-excel" className="max-w-md">
                        <SelectValue placeholder="Selecione o advogado responsável" />
                      </SelectTrigger>
                      <SelectContent>
                        {membrosDisponiveis.map((membro) => (
                          <SelectItem key={membro.id} value={membro.id}>
                            {membro.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Se selecionado, os processos já serão atribuídos diretamente a este advogado.
                    </p>
                  </div>
                )}

                {/* Cliente Selection for Excel Import */}
                <div className="space-y-2">
                  <Label htmlFor="cliente-excel" className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Cliente (opcional)
                  </Label>
                  <Select 
                    value={selectedCliente} 
                    onValueChange={setSelectedCliente}
                    disabled={importing}
                  >
                    <SelectTrigger id="cliente-excel" className="max-w-md">
                      <SelectValue placeholder="Selecione o cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientes.map((cliente) => (
                        <SelectItem key={cliente.id} value={cliente.id}>
                          {cliente.nome} ({cliente.tipo === "pessoa_fisica" ? "PF" : "PJ"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Todos os processos importados serão vinculados a este cliente.
                  </p>
                </div>
                
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Campos obrigatórios:</strong> Número do processo. <br />
                    <strong>Áreas válidas:</strong> Civil, Trabalhista, Empresarial. <br />
                    <strong>Situações válidas:</strong> Ativo, Pendente, Urgente, Encerrado, Arquivado. <br />
                    <strong>Formato de data:</strong> DD/MM/AAAA
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

        {/* File Preview */}
        {file && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <CardTitle>Pré-visualização</CardTitle>
                  <CardDescription>
                    {processos.length} linha(s) encontrada(s) em "{file.name}"
                  </CardDescription>
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  {processos.length > 0 && (
                    <div className="flex items-center gap-2 text-sm flex-wrap">
                      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">
                        {validCount} válidos
                      </Badge>
                      <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-200">
                        {invalidCount} inválidos
                      </Badge>
                      {successCount > 0 && (
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-200">
                          {successCount} importados
                        </Badge>
                      )}
                      {errorCount > 0 && (
                        <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-200">
                          {errorCount} erros
                        </Badge>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2">
                    {totalRejeitados > 0 && (
                      <Button variant="outline" onClick={downloadRejeitados}>
                        <FileDown className="h-4 w-4 mr-2" />
                        Baixar Rejeitados ({totalRejeitados})
                      </Button>
                    )}
                    <Button 
                      onClick={handleImport} 
                      disabled={importing || validCount === 0}
                    >
                      {importing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Importando...
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-2" />
                          Importar ({validCount})
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
              {importing && (
                <Progress value={progress} className="mt-4" />
              )}
            </CardHeader>
            <CardContent>
              {processos.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Nenhum processo encontrado na planilha. Verifique se os cabeçalhos estão corretos.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <div className="max-h-[500px] overflow-auto">
                    <Table>
                      <TableHeader className="sticky top-0 bg-background">
                        <TableRow>
                          <TableHead className="w-[60px]">Linha</TableHead>
                          <TableHead className="w-[60px]">Status</TableHead>
                          <TableHead>Número</TableHead>
                          <TableHead>Área</TableHead>
                          <TableHead>Parte Ativa</TableHead>
                          <TableHead>Parte Passiva</TableHead>
                          <TableHead>Órgão</TableHead>
                          <TableHead className="min-w-[300px]">Erros</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {processos.map((processo, index) => (
                          <TableRow key={index} className={processo.status === "invalido" ? "bg-red-50 dark:bg-red-950/20" : processo.status === "erro" ? "bg-orange-50 dark:bg-orange-950/20" : ""}>
                            <TableCell className="text-muted-foreground">
                              {processo.linhaOriginal}
                            </TableCell>
                            <TableCell>
                              {processo.status === "valido" && (
                                <div className="w-3 h-3 rounded-full bg-green-500" />
                              )}
                              {processo.status === "invalido" && (
                                <XCircle className="h-4 w-4 text-red-500" />
                              )}
                              {processo.status === "sucesso" && (
                                <CheckCircle2 className="h-4 w-4 text-blue-500" />
                              )}
                              {processo.status === "erro" && (
                                <XCircle className="h-4 w-4 text-orange-500" />
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {processo.numero || <span className="text-red-500 italic">vazio</span>}
                            </TableCell>
                            <TableCell>{processo.area || "-"}</TableCell>
                            <TableCell className="max-w-[150px] truncate">
                              {processo.parteAtiva || "-"}
                            </TableCell>
                            <TableCell className="max-w-[150px] truncate">
                              {processo.partePassiva || "-"}
                            </TableCell>
                            <TableCell className="max-w-[150px] truncate">
                              {processo.orgao || "-"}
                            </TableCell>
                            <TableCell className="text-sm">
                              {processo.erros.length > 0 && (
                                <div className="text-red-600 space-y-1">
                                  {processo.erros.map((erro, i) => (
                                    <div key={i}>• {erro.campo}: {erro.mensagem}</div>
                                  ))}
                                </div>
                              )}
                              {processo.erroImport && (
                                <div className="text-orange-600">• Importação: {processo.erroImport}</div>
                              )}
                              {processo.status === "valido" && "-"}
                              {processo.status === "sucesso" && <span className="text-blue-600">Importado com sucesso</span>}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
          </TabsContent>

          {/* Tab: Importar do Projuris */}
          <TabsContent value="projuris" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowRightLeft className="h-5 w-5" />
                  Importar do Projuris
                </CardTitle>
                <CardDescription>
                  Importe processos usando a planilha exportada do sistema Projuris.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Faça upload da planilha do Projuris</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Exporte a planilha de processos do Projuris e faça o upload aqui.
                  </p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleProjurisFileChange}
                      className="max-w-xs"
                      disabled={projurisImporting}
                    />
                    {projurisFile && (
                      <Button variant="outline" onClick={clearProjuris} disabled={projurisImporting}>
                        Limpar
                      </Button>
                    )}
                  </div>
                </div>
                
                {/* Coordenação Selection for Projuris Import */}
                <div className="space-y-2 pt-4 border-t">
                  <Label htmlFor="coordenacao-projuris" className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Coordenação Responsável
                  </Label>
                  <Select 
                    value={selectedCoordenacao} 
                    onValueChange={(value) => {
                      setSelectedCoordenacao(value);
                      setSelectedMembro(""); // Reset member when coordination changes
                    }}
                    disabled={projurisImporting}
                  >
                    <SelectTrigger id="coordenacao-projuris" className="max-w-md">
                      <SelectValue placeholder="Selecione a coordenação (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {coordenacoes.map((coord) => (
                        <SelectItem key={coord.id} value={coord.id}>
                          {coord.nome} ({coord.area})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Todos os processos importados serão atribuídos a esta coordenação.
                  </p>
                </div>

                {/* Member Selection for Projuris Import */}
                {selectedCoordenacao && membrosDisponiveis.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="membro-projuris" className="flex items-center gap-2">
                      Advogado Responsável (opcional)
                    </Label>
                    <Select 
                      value={selectedMembro} 
                      onValueChange={setSelectedMembro}
                      disabled={projurisImporting}
                    >
                      <SelectTrigger id="membro-projuris" className="max-w-md">
                        <SelectValue placeholder="Selecione o advogado responsável" />
                      </SelectTrigger>
                      <SelectContent>
                        {membrosDisponiveis.map((membro) => (
                          <SelectItem key={membro.id} value={membro.id}>
                            {membro.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Se selecionado, os processos já serão atribuídos diretamente a este advogado.
                    </p>
                  </div>
                )}

                {/* Cliente Selection for Projuris Import */}
                <div className="space-y-2">
                  <Label htmlFor="cliente-projuris" className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Cliente (opcional)
                  </Label>
                  <Select 
                    value={selectedCliente} 
                    onValueChange={setSelectedCliente}
                    disabled={projurisImporting}
                  >
                    <SelectTrigger id="cliente-projuris" className="max-w-md">
                      <SelectValue placeholder="Selecione o cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientes.map((cliente) => (
                        <SelectItem key={cliente.id} value={cliente.id}>
                          {cliente.nome} ({cliente.tipo === "pessoa_fisica" ? "PF" : "PJ"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Todos os processos importados serão vinculados a este cliente.
                  </p>
                </div>
                
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Colunas reconhecidas:</strong> Número CNJ, Assunto, Situação, Órgão, Órgão julgador, Área, Data distribuição, Valor ação, Partes ativas, Partes passivas, Estado, Cidade, Clientes.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Projuris File Preview */}
            {projurisFile && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <CardTitle>Pré-visualização Projuris</CardTitle>
                      <CardDescription>
                        {projurisProcessos.length} processo(s) encontrado(s) em "{projurisFile.name}"
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      {projurisProcessos.length > 0 && (
                        <div className="flex items-center gap-2 text-sm flex-wrap">
                          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">
                            {projurisValidCount} válidos
                          </Badge>
                          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-200">
                            {projurisInvalidCount} inválidos
                          </Badge>
                          {projurisSuccessCount > 0 && (
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-200">
                              {projurisSuccessCount} importados
                            </Badge>
                          )}
                          {projurisErrorCount > 0 && (
                            <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-200">
                              {projurisErrorCount} erros
                            </Badge>
                          )}
                        </div>
                      )}
                      <div className="flex gap-2">
                        {projurisTotalRejeitados > 0 && (
                          <Button variant="outline" onClick={downloadProjurisRejeitados}>
                            <FileDown className="h-4 w-4 mr-2" />
                            Baixar Rejeitados ({projurisTotalRejeitados})
                          </Button>
                        )}
                        <Button 
                          onClick={handleProjurisImport} 
                          disabled={projurisImporting || projurisValidCount === 0}
                        >
                          {projurisImporting ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Importando...
                            </>
                          ) : (
                            <>
                              <Upload className="h-4 w-4 mr-2" />
                              Importar ({projurisValidCount})
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                  {projurisImporting && (
                    <Progress value={projurisProgress} className="mt-4" />
                  )}
                </CardHeader>
                <CardContent>
                  {projurisProcessos.length === 0 ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Nenhum processo encontrado na planilha. Verifique se é uma planilha exportada do Projuris.
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="max-h-[500px] overflow-auto">
                        <Table>
                          <TableHeader className="sticky top-0 bg-background">
                            <TableRow>
                              <TableHead className="w-[60px]">Linha</TableHead>
                              <TableHead className="w-[60px]">Status</TableHead>
                              <TableHead>Número CNJ</TableHead>
                              <TableHead>Situação</TableHead>
                              <TableHead>Parte Ativa</TableHead>
                              <TableHead>Parte Passiva</TableHead>
                              <TableHead>Órgão</TableHead>
                              <TableHead className="min-w-[300px]">Erros</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {projurisProcessos.map((processo, index) => (
                              <TableRow key={index} className={processo.status === "invalido" ? "bg-red-50 dark:bg-red-950/20" : processo.status === "erro" ? "bg-orange-50 dark:bg-orange-950/20" : ""}>
                                <TableCell className="text-muted-foreground">
                                  {processo.linhaOriginal}
                                </TableCell>
                                <TableCell>
                                  {processo.status === "valido" && (
                                    <div className="w-3 h-3 rounded-full bg-green-500" />
                                  )}
                                  {processo.status === "invalido" && (
                                    <XCircle className="h-4 w-4 text-red-500" />
                                  )}
                                  {processo.status === "sucesso" && (
                                    <CheckCircle2 className="h-4 w-4 text-blue-500" />
                                  )}
                                  {processo.status === "erro" && (
                                    <XCircle className="h-4 w-4 text-orange-500" />
                                  )}
                                </TableCell>
                                <TableCell className="font-mono text-sm">
                                  {processo.numero || <span className="text-red-500 italic">vazio</span>}
                                </TableCell>
                                <TableCell>{processo.situacao || "-"}</TableCell>
                                <TableCell className="max-w-[150px] truncate">
                                  {processo.parteAtiva || "-"}
                                </TableCell>
                                <TableCell className="max-w-[150px] truncate">
                                  {processo.partePassiva || "-"}
                                </TableCell>
                                <TableCell className="max-w-[150px] truncate">
                                  {processo.orgao || "-"}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {processo.erros.length > 0 && (
                                    <div className="text-red-600 space-y-1">
                                      {processo.erros.map((erro, i) => (
                                        <div key={i}>• {erro.campo}: {erro.mensagem}</div>
                                      ))}
                                    </div>
                                  )}
                                  {processo.erroImport && (
                                    <div className="text-orange-600">• Importação: {processo.erroImport}</div>
                                  )}
                                  {processo.status === "valido" && "-"}
                                  {processo.status === "sucesso" && <span className="text-blue-600">Importado com sucesso</span>}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
