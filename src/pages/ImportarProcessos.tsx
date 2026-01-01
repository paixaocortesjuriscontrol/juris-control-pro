import { useState, useCallback, useRef, useEffect } from "react";
import { useImport } from "@/contexts/ImportContext";
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
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2, XCircle, Loader2, FileDown, List, Building2, Users, ArrowRightLeft, Hospital, Clock, Scale } from "lucide-react";
import { Switch } from "@/components/ui/switch";
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

const validSituacoes = ["ativo", "pendente", "urgente", "encerrado", "arquivado", "em andamento", "finalizado"];

// Normaliza área para slug (ex: "Direito Privado" -> "direito_privado")
const normalizeAreaToSlug = (area: string | null): string => {
  if (!area) return "civil";
  const areaLower = area.toLowerCase().trim();
  
  // Map common variations to standard slugs
  if (areaLower.includes("trabalhista") || areaLower.includes("trabalho")) return "trabalhista";
  if (areaLower.includes("empresarial") || areaLower.includes("empresa")) return "empresarial";
  if (areaLower.includes("cível") || areaLower.includes("civel") || areaLower === "civil") return "civil";
  if (areaLower.includes("direito privado") || areaLower.includes("privado")) return "direito_privado";
  
  // For any other area, create a slug from the name
  return areaLower
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .replace(/[^a-z0-9\s]/g, "") // remove special chars
    .replace(/\s+/g, "_"); // spaces to underscores
};

// Alias para manter compatibilidade com código existente
const mapAreaToEnum = normalizeAreaToSlug;

// Cache de áreas já criadas para evitar múltiplas inserções
const createdAreasCache = new Set<string>();

// Cria área na tabela areas_atuacao se não existir
const ensureAreaExists = async (area: string | null): Promise<string> => {
  if (!area) return "civil";
  
  const slug = normalizeAreaToSlug(area);
  
  // Se já criamos nessa sessão, não precisa verificar de novo
  if (createdAreasCache.has(slug)) {
    return slug;
  }
  
  // Verificar se a área já existe
  const { data: existingArea } = await supabase
    .from("areas_atuacao")
    .select("slug")
    .eq("slug", slug)
    .maybeSingle();
  
  if (existingArea) {
    createdAreasCache.add(slug);
    return slug;
  }
  
  // Criar nova área
  const nome = area.trim().charAt(0).toUpperCase() + area.trim().slice(1);
  const cores = ["#3B82F6", "#22C55E", "#8B5CF6", "#F59E0B", "#EC4899", "#14B8A6", "#F97316", "#6366F1"];
  const randomColor = cores[Math.floor(Math.random() * cores.length)];
  
  const { error } = await supabase
    .from("areas_atuacao")
    .insert({ nome, slug, cor: randomColor })
    .select()
    .single();
  
  if (!error) {
    createdAreasCache.add(slug);
    console.log(`Nova área criada: ${nome} (${slug})`);
  }
  
  return slug;
};

const mapStatusToEnum = (situacao: string | null): "ativo" | "pendente" | "urgente" | "encerrado" | "arquivado" => {
  if (!situacao) return "ativo";
  const situacaoLower = situacao.toLowerCase().trim();
  if (situacaoLower.includes("encerrado") || situacaoLower.includes("finalizado")) return "encerrado";
  if (situacaoLower.includes("arquivado")) return "arquivado";
  if (situacaoLower.includes("urgente")) return "urgente";
  if (situacaoLower.includes("pendente")) return "pendente";
  if (situacaoLower.includes("ativo") || situacaoLower.includes("andamento")) return "ativo";
  // If doesn't match any known status, return "ativo" as default
  return "ativo";
};

// Returns the original situation value if it doesn't match standard enum values
const getSituacaoOriginal = (situacao: string | null): string | null => {
  if (!situacao) return null;
  const situacaoLower = situacao.toLowerCase().trim();
  const standardValues = ["ativo", "pendente", "urgente", "encerrado", "arquivado", "em andamento", "finalizado"];
  const isStandard = standardValues.some(s => situacaoLower.includes(s));
  return isStandard ? null : situacao.trim();
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

// Translate common Supabase/Postgres errors to user-friendly Portuguese messages
const translateDatabaseError = (errorMessage: string): string => {
  if (!errorMessage) return "Erro desconhecido ao salvar dados.";
  
  const lowerMsg = errorMessage.toLowerCase();
  
  if (lowerMsg.includes("numeric field overflow") || lowerMsg.includes("numeric value out of range")) {
    return "Valor numérico muito grande. Verifique os campos de valor (causa, provisionamento, condenação).";
  }
  if (lowerMsg.includes("duplicate key") || lowerMsg.includes("unique constraint")) {
    return "Processo já existe na base de dados.";
  }
  if (lowerMsg.includes("violates foreign key constraint")) {
    return "Referência inválida (coordenação, advogado ou cliente não encontrado).";
  }
  if (lowerMsg.includes("not-null constraint") || lowerMsg.includes("null value in column")) {
    return "Campo obrigatório não preenchido.";
  }
  if (lowerMsg.includes("invalid input syntax for type date")) {
    return "Data em formato inválido.";
  }
  if (lowerMsg.includes("invalid input syntax for type numeric")) {
    return "Valor numérico em formato inválido.";
  }
  if (lowerMsg.includes("string data, right truncation") || lowerMsg.includes("value too long")) {
    return "Texto muito longo para o campo.";
  }
  if (lowerMsg.includes("permission denied") || lowerMsg.includes("rls")) {
    return "Sem permissão para realizar esta operação.";
  }
  if (lowerMsg.includes("network") || lowerMsg.includes("timeout") || lowerMsg.includes("connection")) {
    return "Erro de conexão. Verifique sua internet e tente novamente.";
  }
  
  // Return original message if no translation found (but clean it up a bit)
  return errorMessage.length > 100 ? errorMessage.substring(0, 100) + "..." : errorMessage;
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
  
  // Área agora aceita qualquer valor - será criada automaticamente se não existir
  // Não validamos mais contra lista fixa
  
  // Situação: não validamos mais - valores não padrão serão salvos em situacao_original
  
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
  const { startImport, endImport } = useImport();

  // AbortController for cancelling imports on unmount
  const abortControllerRef = useRef<AbortController | null>(null);
  const isCancelledRef = useRef(false);

  // Cleanup on unmount - cancel any running imports
  useEffect(() => {
    return () => {
      isCancelledRef.current = true;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Batch import states
  const [batchText, setBatchText] = useState("");
  const [batchProcessos, setBatchProcessos] = useState<BatchProcesso[]>([]);
  const [batchImporting, setBatchImporting] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [selectedCoordenacao, setSelectedCoordenacao] = useState<string>("");
  const [selectedMembro, setSelectedMembro] = useState<string>("");
  const [selectedCliente, setSelectedCliente] = useState<string>("");
  const [buscarAndamentos, setBuscarAndamentos] = useState(true);

  // Projuris import states
  const [projurisFile, setProjurisFile] = useState<File | null>(null);
  const [projurisProcessos, setProjurisProcessos] = useState<ProcessoImport[]>([]);
  const [projurisImporting, setProjurisImporting] = useState(false);
  const [projurisProgress, setProjurisProgress] = useState(0);
  const [projurisBuscarAndamentos, setProjurisBuscarAndamentos] = useState(true);
  const [projurisParsing, setProjurisParsing] = useState(false);
  const [projurisParseProgress, setProjurisParseProgress] = useState(0);
  const projurisCancelledRef = useRef(false);

  // Dr. Osmar (Rede D'Or) import states
  const [osmarFile, setOsmarFile] = useState<File | null>(null);
  const [osmarProcessos, setOsmarProcessos] = useState<ProcessoImport[]>([]);
  const [osmarImporting, setOsmarImporting] = useState(false);
  const [osmarProgress, setOsmarProgress] = useState(0);
  const [osmarBuscarAndamentos, setOsmarBuscarAndamentos] = useState(true);

  // Dra. Janaina (ACH Contingencial) import states
  const [janainaFile, setJanainaFile] = useState<File | null>(null);
  const [janainaProcessos, setJanainaProcessos] = useState<ProcessoImport[]>([]);
  const [janainaImporting, setJanainaImporting] = useState(false);
  const [janainaProgress, setJanainaProgress] = useState(0);
  const [janainaBuscarAndamentos, setJanainaBuscarAndamentos] = useState(true);

  // Excel/Planilha import state for andamentos
  const [planilhaBuscarAndamentos, setPlanilhaBuscarAndamentos] = useState(true);

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
    startImport("Importando planilha");
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
            situacao_original: getSituacaoOriginal(processo.situacao),
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
          }
        }

        // Buscar e inserir andamentos (somente se a opção estiver habilitada)
        if (planilhaBuscarAndamentos) {
          const andamentosRes = await buscarAndamentosExternos(processoId, processo.numero.trim());
          if (!andamentosRes.success) {
            console.warn(`Falha ao buscar andamentos do processo ${processo.numero}:`, andamentosRes.error);
          } else if (andamentosRes.movimentosInseridos > 0) {
            console.log(`Processo ${processo.numero}: ${andamentosRes.movimentosInseridos} andamentos importados`);
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
    endImport();

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
    startImport("Importação em lote");
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
            monitorar_andamentos: buscarAndamentos,
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

        // Fetch process details from external API (only for new processes)
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
          }
        }

        // Buscar e inserir andamentos (somente se a opção estiver habilitada)
        if (buscarAndamentos) {
          const andamentosRes = await buscarAndamentosExternos(processoId, processo.numero);
          if (andamentosRes.success) {
            andamentosImportados = andamentosRes.movimentosInseridos;
          } else {
            console.warn(`Falha ao buscar andamentos do processo ${processo.numero}:`, andamentosRes.error);
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
    endImport();

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
    setProjurisParsing(true);
    setProjurisParseProgress(0);

    let worker: Worker | null = null;

    try {
      // 1) Ler arquivo (rápido, mas ainda assíncrono)
      setProjurisParseProgress(2);
      const data = await file.arrayBuffer();
      setProjurisParseProgress(10);

      // 2) Parse pesado (XLSX.read + sheet_to_json) em Web Worker para não travar a UI
      const filteredRows = await new Promise<any[]>((resolve, reject) => {
        worker = new Worker(new URL("../workers/projurisParser.worker.ts", import.meta.url), {
          type: "module",
        });

        worker.onmessage = (ev: MessageEvent) => {
          const msg = ev.data as
            | { type: "progress"; progress: number }
            | { type: "result"; rows: any[] }
            | { type: "error"; message: string };

          if (msg?.type === "progress") {
            // Mapear 0-100 do worker para 10-40 no UI
            const uiProgress = 10 + Math.round((msg.progress / 100) * 30);
            setProjurisParseProgress(uiProgress);
            return;
          }

          if (msg?.type === "result") {
            resolve(msg.rows);
            return;
          }

          if (msg?.type === "error") {
            reject(new Error(msg.message));
          }
        };

        worker.onerror = (err) => {
          reject(new Error(err.message || "Erro no worker de parsing"));
        };

        // Transferir o ArrayBuffer para evitar cópia
        worker.postMessage({ arrayBuffer: data }, [data as ArrayBuffer]);
      });

      setProjurisParseProgress(40);

      // 3) Montagem + validação (em lotes no main thread, com yields)
      const BATCH_SIZE = 500;
      const totalRows = filteredRows.length;
      const parsed: ProcessoImport[] = [];

      for (let i = 0; i < totalRows; i += BATCH_SIZE) {
        const batch = filteredRows.slice(i, Math.min(i + BATCH_SIZE, totalRows));

        const batchParsed = batch.map((row: any, batchIndex: number): ProcessoImport => {
          const index = i + batchIndex;
          // Parse Projuris columns exactly as exported
          const numeroCNJ = String(row["Número CNJ"] || row["Numero CNJ"] || "").trim();
          const assunto = row["Assunto"] || null;
          const situacao = row["Situação"] || row["Situacao"] || null;
          const status = row["Status"] || null;
          const justica = row["Justiça"] || row["Justica"] || null;
          const instancia = row["Instância"] || row["Instancia"] || null;
          const orgao = row["Órgao"] || row["Orgao"] || null;
          const orgaoJulgador = row["Órgão julgador"] || row["Orgao julgador"] || null;
          const tipoOrgaoJulgador = row["Tipo órgão julgador"] || row["Tipo orgao julgador"] || null;
          const complemento = row["Complemento"] || null;
          const area = row["Área"] || row["Area"] || null;
          const fase = row["Fase"] || null;
          const dataDistribuicao = row["Data distribuição"] || row["Data distribuicao"] || null;
          const dataCitacao = row["Data citação"] || row["Data citacao"] || null;
          const dataRecebimento = row["Data recebimento"] || null;
          const dataArquivamento = row["Data arquivamento"] || null;
          const valorAcao = row["Valor ação"] || row["Valor acao"] || null;
          const valorProvisionado = row["Valor provisionado"] || null;
          const probabilidade = row["Probabilidade"] || null;
          const risco = row["Risco"] || null;
          const transitadoEmJulgado = row["Transitado em julgado"] || null;
          const resultado = row["Resultado"] || null;
          const valorCondenacao = row["Valor da condenação"] || row["Valor da condenacao"] || null;
          const partesAtivas = row["Partes ativas"] || null;
          const partesPassivas = row["Partes passivas"] || null;
          const estado = row["Estado"] || null;
          const cidade = row["Cidade"] || null;
          const responsaveis = row["Responsáveis"] || row["Responsaveis"] || null;
          const descricao = row["Descrição"] || row["Descricao"] || null;
          const identificador = row["Identificador"] || null;
          const pastaFisica = row["Pasta física"] || row["Pasta fisica"] || null;
          const pastaCliente = row["Pasta cliente"] || null;

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
            linhaOriginal: index + 4,
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

        parsed.push(...batchParsed);

        // Update progress (40-95% is for parsing)
        const progressPercent = 40 + Math.floor(((i + batch.length) / totalRows) * 55);
        setProjurisParseProgress(progressPercent);

        // Yield to UI thread
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      setProjurisParseProgress(100);
      setProjurisProcessos(parsed);

      const validCount = parsed.filter((p) => p.status === "valido").length;
      const invalidCount = parsed.filter((p) => p.status === "invalido").length;

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
    } finally {
      if (worker) worker.terminate();
      setProjurisParsing(false);
    }
  };

  // Helper to extract party name from Projuris format: "NOME (Tipo)"
  const extractPartyName = (partyString: string): string => {
    if (!partyString) return "";
    // Remove the role/type in parentheses, e.g., "BANCO SANTANDER (Requerido)" -> "BANCO SANTANDER"
    return partyString.replace(/\s*\([^)]*\)\s*$/, "").trim();
  };

  const cancelProjurisImport = useCallback(() => {
    projurisCancelledRef.current = true;
    setProjurisImporting(false);
    endImport();
    toast({
      title: "Importação cancelada",
      description: "A importação foi interrompida. Os processos já importados permanecem na base.",
    });
  }, [endImport, toast]);

  const handleProjurisImport = async () => {
    const validProcessos = projurisProcessos.filter((p) => p.status === "valido");
    if (validProcessos.length === 0) {
      toast({
        title: "Nenhum processo válido",
        description: "Corrija os erros de validação antes de importar.",
        variant: "destructive",
      });
      return;
    }

    projurisCancelledRef.current = false;
    setProjurisImporting(true);
    startImport("Importando Projuris");
    setProjurisProgress(0);

    const updatedProcessos = [...projurisProcessos];
    let successCount = 0;
    let errorCount = 0;

    // Helper to build insert payload for a processo
    const buildInsertPayload = (p: ProcessoImport) => ({
      numero: p.numero.trim(),
      assunto: p.assunto,
      descricao: p.descricao,
      area: mapAreaToEnum(p.area),
      status: mapStatusToEnum(p.situacao),
      situacao_original: getSituacaoOriginal(p.situacao),
      tribunal: p.orgao,
      vara: p.orgaoJulgador,
      comarca: p.cidade,
      classe: p.classeCNJ,
      data_distribuicao: parseDate(p.dataDistribuicao),
      valor_causa: parseNumber(p.valorAcao),
      polo_ativo: p.parteAtiva,
      polo_passivo: p.partePassiva,
      coordenacao_id: selectedCoordenacao || null,
      advogado_responsavel_id: selectedMembro || null,
      cliente_id: selectedCliente || null,
      monitorar_andamentos: false,
      identificador_projuris: p.identificadorProjuris || null,
      pasta_fisica: p.pastaFisica || null,
      pasta_cliente: p.pastaCliente || null,
      justica: p.justica || null,
      instancia: p.instancia || null,
      fase: p.fase || null,
      data_citacao: parseDate(p.dataCitacao),
      data_recebimento: parseDate(p.dataRecebimento),
      data_arquivamento: parseDate(p.dataArquivamento),
      valor_provisionado: parseNumber(p.valorProvisionado),
      probabilidade: p.probabilidade || null,
      risco: p.risco || null,
      transitado_julgado: p.transitadoJulgado || false,
      resultado: p.resultado || null,
      valor_condenacao: parseNumber(p.valorCondenacao),
      uf: p.estado || null,
      responsaveis_projuris: p.responsavel || null,
    });

    // ======== FAST PATH: bulk insert when buscarAndamentos is disabled ========
    if (!projurisBuscarAndamentos) {
      const BATCH_SIZE = 200;
      const CHUNK_SIZE = 500; // For querying existing in chunks (Supabase limit)
      
      const validIndices = updatedProcessos
        .map((p, idx) => (p.status === "valido" ? idx : -1))
        .filter((idx) => idx >= 0);

      // 1) Detect duplicates WITHIN the spreadsheet itself
      const seenInSpreadsheet = new Map<string, number>(); // numero -> first index
      const duplicatesInSpreadsheet: number[] = [];
      for (const idx of validIndices) {
        const num = updatedProcessos[idx].numero.trim();
        if (seenInSpreadsheet.has(num)) {
          duplicatesInSpreadsheet.push(idx);
          updatedProcessos[idx] = { 
            ...updatedProcessos[idx], 
            status: "erro", 
            erroImport: `Duplicado na planilha (linha ${updatedProcessos[seenInSpreadsheet.get(num)!].linhaOriginal})` 
          };
          errorCount++;
        } else {
          seenInSpreadsheet.set(num, idx);
        }
      }
      
      // Filter out spreadsheet duplicates from valid indices
      const uniqueValidIndices = validIndices.filter(idx => !duplicatesInSpreadsheet.includes(idx));

      // 2) Fetch existing process numbers in CHUNKS to avoid query limits
      const allNumeros = uniqueValidIndices.map((idx) => updatedProcessos[idx].numero.trim());
      const existingMap = new Map<string, string>();
      
      for (let i = 0; i < allNumeros.length; i += CHUNK_SIZE) {
        const chunk = allNumeros.slice(i, i + CHUNK_SIZE);
        const { data: existingRows } = await supabase
          .from("processos")
          .select("id, numero")
          .in("numero", chunk);
        for (const row of existingRows || []) {
          existingMap.set(row.numero, row.id);
        }
      }

      // Separate indices for insert vs update
      const toInsertIndices: number[] = [];
      const toUpdateIndices: number[] = [];
      for (const idx of uniqueValidIndices) {
        const num = updatedProcessos[idx].numero.trim();
        if (existingMap.has(num)) {
          toUpdateIndices.push(idx);
        } else {
          toInsertIndices.push(idx);
        }
      }

      let processed = 0;
      const totalToProcess = toInsertIndices.length + toUpdateIndices.length;

      // 3) Batch INSERT new processes with FALLBACK on error
      for (let i = 0; i < toInsertIndices.length; i += BATCH_SIZE) {
        if (projurisCancelledRef.current) break;

        const batchIndices = toInsertIndices.slice(i, i + BATCH_SIZE);
        const insertPayload = batchIndices.map((idx) => buildInsertPayload(updatedProcessos[idx]));

        const { error } = await supabase.from("processos").insert(insertPayload);
        
        if (error) {
          // Check if it's a unique violation - if so, fallback to one-by-one
          const isUniqueViolation = error.message?.includes("duplicate key") || 
                                     error.code === "23505" ||
                                     error.message?.includes("processos_numero_key");
          
          if (isUniqueViolation) {
            // FALLBACK: Insert one by one to find the actual duplicates
            for (const idx of batchIndices) {
              if (projurisCancelledRef.current) break;
              
              const singlePayload = buildInsertPayload(updatedProcessos[idx]);
              const { error: singleError } = await supabase.from("processos").insert([singlePayload]);
              
              if (singleError) {
                const translatedError = translateDatabaseError(singleError.message);
                updatedProcessos[idx] = { ...updatedProcessos[idx], status: "erro", erroImport: translatedError };
                errorCount++;
              } else {
                updatedProcessos[idx] = { ...updatedProcessos[idx], status: "sucesso" };
                successCount++;
              }
            }
          } else {
            // Non-duplicate error: mark all in batch as error
            const translatedError = translateDatabaseError(error.message);
            for (const idx of batchIndices) {
              updatedProcessos[idx] = { ...updatedProcessos[idx], status: "erro", erroImport: translatedError };
              errorCount++;
            }
          }
        } else {
          for (const idx of batchIndices) {
            updatedProcessos[idx] = { ...updatedProcessos[idx], status: "sucesso" };
            successCount++;
          }
        }

        processed += batchIndices.length;
        setProjurisProgress((processed / totalToProcess) * 100);
        setProjurisProcessos([...updatedProcessos]);
        // Yield to UI
        await new Promise((r) => setTimeout(r, 0));
      }

      if (projurisCancelledRef.current) return;

      // 3) Batch UPDATE existing processes (if coordination/member/cliente selected)
      const hasUpdateFields = selectedCoordenacao || selectedMembro || selectedCliente;
      if (hasUpdateFields && toUpdateIndices.length > 0) {
        for (let i = 0; i < toUpdateIndices.length; i += BATCH_SIZE) {
          if (projurisCancelledRef.current) break;

          const batchIndices = toUpdateIndices.slice(i, i + BATCH_SIZE);
          const numeros = batchIndices.map((idx) => updatedProcessos[idx].numero.trim());
          const updateData: Record<string, any> = {};
          if (selectedCoordenacao) updateData.coordenacao_id = selectedCoordenacao;
          if (selectedMembro) updateData.advogado_responsavel_id = selectedMembro;
          if (selectedCliente) updateData.cliente_id = selectedCliente;

          const { error } = await supabase.from("processos").update(updateData).in("numero", numeros);
          if (error) {
            const translatedError = translateDatabaseError(error.message);
            for (const idx of batchIndices) {
              updatedProcessos[idx] = { ...updatedProcessos[idx], status: "erro", erroImport: translatedError };
              errorCount++;
            }
          } else {
            for (const idx of batchIndices) {
              updatedProcessos[idx] = { ...updatedProcessos[idx], status: "sucesso", erroImport: "Atualizado (já existia)" };
              successCount++;
            }
          }

          processed += batchIndices.length;
          setProjurisProgress((processed / totalToProcess) * 100);
          setProjurisProcessos([...updatedProcessos]);
          await new Promise((r) => setTimeout(r, 0));
        }
        if (projurisCancelledRef.current) return;
      } else {
        // Mark existing as success (no update needed)
        for (const idx of toUpdateIndices) {
          updatedProcessos[idx] = { ...updatedProcessos[idx], status: "sucesso", erroImport: "Já existia (sem alteração)" };
          successCount++;
        }
        setProjurisProgress(100);
        setProjurisProcessos([...updatedProcessos]);
      }

      setProjurisImporting(false);
      endImport();
      toast({
        title: "Importação Projuris concluída",
        description: `${successCount} processo(s) importado(s). ${errorCount} erro(s).`,
        variant: errorCount > 0 ? "destructive" : "default",
      });
      return;
    }

    // ======== SLOW PATH: one-by-one with API + andamentos ========
    for (let i = 0; i < updatedProcessos.length; i++) {
      if (projurisCancelledRef.current) break;

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
          const { data: insertedProcesso, error } = await supabase
            .from("processos")
            .insert({
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
              monitorar_andamentos: projurisBuscarAndamentos,
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
            })
            .select("id")
            .single();

          if (error) {
            updatedProcessos[i] = { ...processo, status: "erro", erroImport: translateDatabaseError(error.message) };
            errorCount++;
            continue;
          }

          processoId = insertedProcesso.id;
        }

        // Fetch additional data from API for new processes (only in slow path)
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
                .filter(
                  (p: any) =>
                    p.tipo === "POLO_ATIVO" ||
                    p.tipoParte === "AUTOR" ||
                    p.tipoParte === "REQUERENTE" ||
                    p.tipoParte === "RECLAMANTE"
                )
                .map((p: any) => p.nome)
                .filter(Boolean);

              const partesPassivas = processoApi.partes
                .filter(
                  (p: any) =>
                    p.tipo === "POLO_PASSIVO" ||
                    p.tipoParte === "REU" ||
                    p.tipoParte === "REQUERIDO" ||
                    p.tipoParte === "RECLAMADO"
                )
                .map((p: any) => p.nome)
                .filter(Boolean);

              if (!poloAtivo && partesAtivas.length > 0) {
                poloAtivo = partesAtivas.join(", ");
              }
              if (!poloPassivo && partesPassivas.length > 0) {
                poloPassivo = partesPassivas.join(", ");
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
              updateData.data_distribuicao = new Date(
                processoApi.dataAjuizamento.replace(/(\d{4})(\d{2})(\d{2}).*/, "$1-$2-$3")
              )
                .toISOString()
                .split("T")[0];
            }

            // Update area based on tribunal if not set
            if (!processo.area) {
              const tribunalLower = (processoApi.tribunal || apiData.tribunal || "").toLowerCase();
              if (
                tribunalLower.includes("trt") ||
                tribunalLower.includes("tst") ||
                tribunalLower.includes("trabalho")
              ) {
                updateData.area = "trabalhista";
              }
            }

            if (Object.keys(updateData).length > 0) {
              await supabase.from("processos").update(updateData).eq("id", processoId);
            }
          }
        }

        // Buscar e inserir andamentos (somente se a opção estiver habilitada - only in slow path)
        const andamentosRes = await buscarAndamentosExternos(processoId, processo.numero.trim());
        if (!andamentosRes.success) {
          console.warn(`Falha ao buscar andamentos do processo ${processo.numero}:`, andamentosRes.error);
        }

        updatedProcessos[i] = {
          ...processo,
          status: "sucesso",
          erroImport: isUpdate ? "Atualizado (já existia)" : undefined,
        };
        successCount++;
      } catch (err: any) {
        updatedProcessos[i] = { ...processo, status: "erro", erroImport: err.message };
        errorCount++;
      }

      setProjurisProgress(((i + 1) / updatedProcessos.length) * 100);
      setProjurisProcessos([...updatedProcessos]);
    }

    if (projurisCancelledRef.current) return;

    setProjurisImporting(false);
    endImport();

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

  const osmarValidCount = osmarProcessos.filter(p => p.status === "valido").length;
  const osmarInvalidCount = osmarProcessos.filter(p => p.status === "invalido").length;
  const osmarSuccessCount = osmarProcessos.filter(p => p.status === "sucesso").length;
  const osmarErrorCount = osmarProcessos.filter(p => p.status === "erro").length;
  const osmarWarningCount = osmarProcessos.filter(p => (p.status === "valido" || p.status === "sucesso") && p.erros.length > 0).length;
  const osmarTotalRejeitados = osmarInvalidCount + osmarErrorCount;
  const osmarTotalProblemas = osmarTotalRejeitados + osmarWarningCount;

  const janainaValidCount = janainaProcessos.filter(p => p.status === "valido").length;
  const janainaInvalidCount = janainaProcessos.filter(p => p.status === "invalido").length;
  const janainaSuccessCount = janainaProcessos.filter(p => p.status === "sucesso").length;
  const janainaErrorCount = janainaProcessos.filter(p => p.status === "erro").length;
  const janainaWarningCount = janainaProcessos.filter(p => (p.status === "valido" || p.status === "sucesso") && p.erros.length > 0).length;
  const janainaTotalRejeitados = janainaInvalidCount + janainaErrorCount;
  const janainaTotalProblemas = janainaTotalRejeitados + janainaWarningCount;

  // Dr. Osmar file handling
  const handleOsmarFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setOsmarFile(selectedFile);
      parseOsmarExcel(selectedFile);
    }
  }, []);

  const parseOsmarExcel = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: null });

      const parsed: ProcessoImport[] = jsonData.map((row: any, index: number): ProcessoImport => {
        const processo: ProcessoImport = {
          numero: String(row["Numero do processo"] || row["Número do processo"] || "").trim(),
          assunto: row["PEDIDOS"] || null,
          situacao: row["STATUS DO PROCESSO"] || null,
          responsavel: row["ADVOGADO"] || null,
          descricao: row["Observações"] || null,
          justica: row["Esfera"] || null,
          cidade: null,
          estado: row["Estado"] || null,
          instancia: row["Fase do Processo"] || null,
          orgao: null,
          orgaoJulgador: row["VARA"] || null,
          sistema: null,
          area: row["Natureza"] || null,
          fase: row["Fase do Processo"] || null,
          dataDistribuicao: row["Distribuição"] || null,
          classeCNJ: null,
          valorAcao: row["Provável - Dez/2023"] || row["Possível - Dez/2023"] || row["Remoto - Dez/2023"] || null,
          parteAtiva: row["UNIDADE"] || null,
          partePassiva: row["Parte Contrária"] || null,
          cpfCnpjAtivo: null,
          cpfCnpjPassivo: row["CPF / CNPJ"] || null,
          status: "pendente",
          erros: [],
          linhaOriginal: index + 2,
          // Extended fields for Dr. Osmar
          identificadorProjuris: null,
          pastaFisica: null,
          pastaCliente: null,
          dataCitacao: null,
          dataRecebimento: null,
          dataArquivamento: null,
          valorProvisionado: null,
          probabilidade: null,
          risco: null,
          transitadoJulgado: null,
          resultado: null,
          valorCondenacao: null,
        };
        
        // Store additional Dr. Osmar fields in a custom property
        (processo as any).osmarData = {
          unidadeCliente: row["UNIDADE"] || null,
          siglaUnidade: row["Sigla"] || null,
          tipoControladora: row["Controladora / Consolidado"] || null,
          cpfCnpjParteContraria: row["CPF / CNPJ"] || null,
          dataFatoGerador: row["Data do Fato Gerador"] || null,
          pedidos: row["PEDIDOS"] || null,
          funcaoParteContraria: row["FUNÇÃO"] || null,
          periodoLaborado: row["PERÍODO LABORADO"] || null,
          andamentoAtual: row["ANDAMENTO"] || null,
          esfera: row["Esfera"] || null,
          natureza: row["Natureza"] || null,
          materia: row["Matéria"] || null,
          terceiroEnvolvido: row["3º"] || null,
          provisionamentoProvavel: parseNumber(row["Provável - Dez/2023"]),
          provisionamentoPossivel: parseNumber(row["Possível - Dez/2023"]),
          provisionamentoRemoto: parseNumber(row["Remoto - Dez/2023"]),
          valorPagamento: parseNumber(row["Valor do pagamento"]),
          tipoPagamento: row["Acordo ou Pagamento ?"] || null,
          formaPagamento: row["A vista ou parcelado?"] || null,
          valorPago: parseNumber(row["Valor pago"]),
          depositoJudicial: parseNumber(row["Depósito judicial (atualizado)"]),
          observacoes: row["Observações"] || null,
        };
        
        // Validate the processo - but now we allow partial imports
        processo.erros = validateProcesso(processo);
        // Only mark as invalid if numero is missing (critical error), otherwise mark as valid with warnings
        const hasCriticalError = !processo.numero || processo.numero.trim() === "" || processo.numero.trim().length < 5;
        processo.status = hasCriticalError ? "invalido" : "valido";
        
        return processo;
      });

      setOsmarProcessos(parsed);
      
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
          title: "Planilha Dr. Osmar carregada",
          description: `${parsed.length} linha(s): ${validCount} válida(s), ${invalidCount} com erro(s).`,
          variant: invalidCount > 0 ? "destructive" : "default",
        });
      }
    } catch (error) {
      console.error("Erro ao ler planilha Dr. Osmar:", error);
      toast({
        title: "Erro ao ler planilha",
        description: "Verifique se o arquivo está no formato correto (.xlsx ou .xls).",
        variant: "destructive",
      });
    }
  };

  const handleOsmarImport = async () => {
    // Now we import all processes that have a valid numero (not just those without any errors)
    const importableProcessos = osmarProcessos.filter(p => p.status === "valido");
    if (importableProcessos.length === 0) {
      toast({
        title: "Nenhum processo importável",
        description: "Todos os processos têm número inválido ou ausente.",
        variant: "destructive",
      });
      return;
    }

    setOsmarImporting(true);
    startImport("Importando Dr. Osmar");
    setOsmarProgress(0);

    const updatedProcessos = [...osmarProcessos];
    let successCountLocal = 0;
    let errorCountLocal = 0;

    for (let i = 0; i < updatedProcessos.length; i++) {
      const processo = updatedProcessos[i];
      
      if (processo.status === "invalido") {
        continue;
      }
      
      try {
        const osmarData = (processo as any).osmarData || {};
        
        // Check if process already exists by numero
        const { data: existingProcesso } = await supabase
          .from("processos")
          .select("id")
          .eq("numero", processo.numero.trim())
          .maybeSingle();

        const processoData: Record<string, any> = {
          numero: processo.numero.trim(),
          assunto: osmarData.pedidos,
          area: mapAreaToEnum(processo.area),
          status: mapStatusToEnum(processo.situacao),
          situacao_original: getSituacaoOriginal(processo.situacao),
          vara: processo.orgaoJulgador,
          uf: processo.estado,
          fase: processo.fase,
          data_distribuicao: parseDate(processo.dataDistribuicao),
          polo_ativo: osmarData.unidadeCliente,
          polo_passivo: processo.partePassiva,
          coordenacao_id: selectedCoordenacao || null,
          advogado_responsavel_id: selectedMembro || null,
          cliente_id: selectedCliente || null,
          monitorar_andamentos: osmarBuscarAndamentos,
          // Dr. Osmar specific fields
          unidade_cliente: osmarData.unidadeCliente,
          sigla_unidade: osmarData.siglaUnidade,
          tipo_controladora: osmarData.tipoControladora,
          cpf_cnpj_parte_contraria: osmarData.cpfCnpjParteContraria,
          data_fato_gerador: osmarData.dataFatoGerador,
          pedidos: osmarData.pedidos,
          funcao_parte_contraria: osmarData.funcaoParteContraria,
          periodo_laborado: osmarData.periodoLaborado,
          andamento_atual: osmarData.andamentoAtual,
          esfera: osmarData.esfera,
          natureza: osmarData.natureza,
          materia: osmarData.materia,
          terceiro_envolvido: osmarData.terceiroEnvolvido,
          provisionamento_provavel: osmarData.provisionamentoProvavel,
          provisionamento_possivel: osmarData.provisionamentoPossivel,
          provisionamento_remoto: osmarData.provisionamentoRemoto,
          valor_pagamento: osmarData.valorPagamento,
          tipo_pagamento: osmarData.tipoPagamento,
          forma_pagamento: osmarData.formaPagamento,
          valor_pago: osmarData.valorPago,
          deposito_judicial: osmarData.depositoJudicial,
          observacoes_processo: osmarData.observacoes,
        };

        let isUpdate = false;

        if (existingProcesso) {
          // Update existing process (upsert behavior)
          const { error } = await supabase
            .from("processos")
            .update(processoData)
            .eq("id", existingProcesso.id);

          if (error) {
            updatedProcessos[i] = { ...processo, status: "erro", erroImport: error.message };
            errorCountLocal++;
            continue;
          }
          isUpdate = true;
        } else {
          // Insert new process
          const { data: insertedProcesso, error } = await supabase
            .from("processos")
            .insert(processoData as any)
            .select("id")
            .single();

          if (error) {
            updatedProcessos[i] = { ...processo, status: "erro", erroImport: error.message };
            errorCountLocal++;
            continue;
          }

          // Buscar e inserir andamentos (somente se a opção estiver habilitada e for processo novo)
          if (osmarBuscarAndamentos && insertedProcesso) {
            const andamentosRes = await buscarAndamentosExternos(insertedProcesso.id, processo.numero.trim());
            if (!andamentosRes.success) {
              console.warn(`Falha ao buscar andamentos do processo ${processo.numero}:`, andamentosRes.error);
            }
          }
        }
        
        updatedProcessos[i] = { 
          ...processo, 
          status: "sucesso", 
          erroImport: isUpdate ? "Atualizado (já existia)" : undefined 
        };
        successCountLocal++;
      } catch (err: any) {
        updatedProcessos[i] = { ...processo, status: "erro", erroImport: err.message };
        errorCountLocal++;
      }

      setOsmarProgress(((i + 1) / updatedProcessos.length) * 100);
      setOsmarProcessos([...updatedProcessos]);
    }

    setOsmarImporting(false);
    endImport();

    toast({
      title: "Importação Dr. Osmar concluída",
      description: `${successCountLocal} processo(s) importado(s). ${errorCountLocal} erro(s) de importação.`,
      variant: errorCountLocal > 0 ? "destructive" : "default",
    });
  };

  const downloadOsmarRejeitados = () => {
    // Include both completely rejected (invalid numero) and those with warnings (imported with issues)
    const rejeitados = osmarProcessos.filter(p => p.status === "invalido" || p.status === "erro");
    const comAvisos = osmarProcessos.filter(p => (p.status === "sucesso" || p.status === "valido") && p.erros.length > 0);
    
    if (rejeitados.length === 0 && comAvisos.length === 0) {
      toast({
        title: "Nenhum problema encontrado",
        description: "Não há processos rejeitados ou com avisos para exportar.",
      });
      return;
    }

    // Create sheet for rejected (critical errors)
    const rejeitadosData = rejeitados.map(p => ({
      "Linha": p.linhaOriginal,
      "Número do processo": p.numero || "(vazio)",
      "Unidade": p.parteAtiva,
      "Parte Contrária": p.partePassiva,
      "Fase": p.fase,
      "VARA": p.orgaoJulgador,
      "STATUS": p.situacao,
      "Tipo": "REJEITADO",
      "Motivo": p.erros.map(e => `${e.campo}: ${e.mensagem}`).join("; ") || p.erroImport || "Erro crítico",
    }));

    // Create sheet for warnings (imported with issues)
    const avisosData = comAvisos.map(p => ({
      "Linha": p.linhaOriginal,
      "Número do processo": p.numero,
      "Unidade": p.parteAtiva,
      "Parte Contrária": p.partePassiva,
      "Fase": p.fase,
      "VARA": p.orgaoJulgador,
      "STATUS": p.situacao,
      "Tipo": "IMPORTADO COM AVISOS",
      "Avisos": p.erros.map(e => `${e.campo}: ${e.mensagem}`).join("; "),
    }));

    const allData = [...rejeitadosData, ...avisosData];

    const ws = XLSX.utils.json_to_sheet(allData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Problemas");
    
    const colWidths = Object.keys(allData[0] || {}).map(key => ({
      wch: Math.max(key.length, 15)
    }));
    ws["!cols"] = colWidths;
    
    XLSX.writeFile(wb, `osmar_problemas_${new Date().toISOString().split('T')[0]}.xlsx`);
    
    toast({
      title: "Arquivo gerado",
      description: `${rejeitados.length} rejeitado(s), ${comAvisos.length} com avisos.`,
    });
  };

  const clearOsmar = () => {
    setOsmarFile(null);
    setOsmarProcessos([]);
    setOsmarProgress(0);
  };

  // Dra. Janaina (ACH Contingencial) file handling
  const handleJanainaFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setJanainaFile(selectedFile);
      parseJanainaExcel(selectedFile);
    }
  }, []);

  const parseJanainaExcel = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      const range = sheet["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]) : null;
      const expectedRows = range ? Math.max(0, range.e.r - range.s.r) : 0;

      // Lê como matriz (AOA) para preservar posição das linhas (inclui linhas vazias)
      const aoa = XLSX.utils.sheet_to_json<any[]>(sheet, {
        header: 1,
        defval: null,
        blankrows: true,
      }) as any[][];

      const headerRow = (aoa[0] || []).map((h) => String(h ?? "").trim());

      const normalizeHeaderKey = (value: string) =>
        value
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/\s+/g, " ")
          .trim();

      const getFromRow = (rowObj: Record<string, any>, keys: string[]) => {
        for (const k of keys) {
          if (k in rowObj) return rowObj[k];
        }

        // fallback com normalização (para cabeçalhos com quebras de linha/espaços)
        const normalizedRow: Record<string, any> = {};
        for (const [k, v] of Object.entries(rowObj)) {
          const nk = normalizeHeaderKey(k);
          if (!normalizedRow[nk]) normalizedRow[nk] = v;
        }

        for (const k of keys) {
          const nk = normalizeHeaderKey(k);
          if (nk in normalizedRow) return normalizedRow[nk];
        }

        return null;
      };

      const totalDataRows = expectedRows || Math.max(0, aoa.length - 1);

      const parsed: ProcessoImport[] = Array.from({ length: totalDataRows }).map((_, index) => {
        const rowArr = aoa[index + 1] || [];

        // Monta objeto por cabeçalho, mantendo null quando faltar coluna
        const row: Record<string, any> = {};
        headerRow.forEach((header, colIndex) => {
          if (!header) return;
          row[header] = rowArr[colIndex] ?? null;
        });

        const rowHasAnyValue = rowArr.some((v) => {
          if (v === null || v === undefined) return false;
          if (typeof v === "string") return v.trim() !== "";
          return true;
        });

        // Build periodo_condenacao from separate date fields if available
        const dataInicioCondenacao = row["Data início Período da Condenação"] || null;
        const dataFimCondenacao = row["Data fim Período da Condenação"] || null;
        let periodoCondenacao = null;
        if (dataInicioCondenacao || dataFimCondenacao) {
          periodoCondenacao = `${dataInicioCondenacao || ""} a ${dataFimCondenacao || ""}`.trim();
        }

        // Try multiple possible column names for the process number
        const numeroProcesso =
          getFromRow(row, [
            "Processo Judicial",
            "Nº Processo",
            "Nº do Processo",
            "Numero do Processo",
            "Número do Processo",
            "Processo",
            "N° Processo",
            "Nº Processo Judicial",
          ]) ||
          "";

        const processo: ProcessoImport = {
          numero: String(numeroProcesso ?? "").trim(),
          assunto: row["Assunto da Ação"] || null,
          situacao: row["Status"] || null,
          responsavel: row["Advogado"] || null,
          descricao: row["Justificativa"] || null,
          justica: null,
          cidade: null,
          estado: null,
          instancia: null,
          orgao: null,
          orgaoJulgador: row["Vara"] || null,
          sistema: null,
          area: row["Natureza"] || "trabalhista",
          fase: null,
          dataDistribuicao: row["Data do Ajuizamento"] || null,
          classeCNJ: null,
          valorAcao: row["Valor da Causa"] || null,
          parteAtiva: row["Reclamante"] || null,
          partePassiva: row["Reclamados"] || null,
          cpfCnpjAtivo: null,
          cpfCnpjPassivo: null,
          status: "pendente",
          erros: [],
          linhaOriginal: index + 2,
          identificadorProjuris: null,
          pastaFisica: null,
          pastaCliente: null,
          dataCitacao: null,
          dataRecebimento: null,
          dataArquivamento: null,
          valorProvisionado: null,
          probabilidade: null,
          risco: null,
          transitadoJulgado: null,
          resultado: null,
          valorCondenacao: parseNumber(row["Valor da Condenação"]),
        };

        // Store additional ACH (Janaina) fields - including new Cliente column
        (processo as any).janainaData = {
          cliente: row["Cliente"] || null, // Cliente (coluna 1)
          ativoPasso: row["Ativo/Passivo"] || null,
          reclamante: row["Reclamante"] || null,
          reclamados: row["Reclamados"] || null,
          comarca: row["Comarca"] || null,
          desligamento:
            row["Data Desligamento"] || row["Data\nDesligamento"] || row["Desligamento"] || null,
          responsabilidadeTipo: row["Responsabilidade: Exclusiva, Solidária, Subsidiária"] || null,
          pedidoValor: row["Pedido e Valor"] || null,
          andamento: row["Andamento"] || null,
          dataConsulta: row["Data da Consulta"] || null,
          periodoCondenacao: periodoCondenacao,
          riscoAnterior: row["Risco Perda Anterior"] || null,
          riscoAtual: row["Risco Perda Atual"] || null,
          mudancaRisco: row["Mudança (?)"] || null,
          justificativa: row["Justificativa"] || null,
          valorPerdaAnterior: parseNumber(row["Valor Perda Anterior"]),
          valorPerdaAtual: parseNumber(row["Valor Perda Atual"]),
          dataResponsabilidadeAte: row["Data responsabilidade até"] || null,
          valorResponsabilidadeAte: parseNumber(row["Valor responsabilidade até"]),
          dataResponsabilidadeApos: row["Data responsabilidade após"] || null,
          valorResponsabilidadeApos: parseNumber(row["Responsabilidade após"]),
          adicaoBaixa: row["Adição/baixa"] || null,
          depositosVinculados: row["Depósitos vinculados"] || null,
          epocaRazao: row["Época / Razão"] || null,
          funcao: row["Função"] || null,
          setor: row["Setor"] || null,
        };

        // Validação base
        processo.erros = validateProcesso(processo);

        // Regras de rejeição (críticas): linha vazia OU número inválido
        const numeroTrimmed = (processo.numero || "").trim();
        const isEmptyRow = !rowHasAnyValue;
        const hasInvalidNumero = !numeroTrimmed || numeroTrimmed.length < 5;

        if (isEmptyRow || hasInvalidNumero) {
          const motivo = isEmptyRow
            ? "Linha vazia na planilha"
            : !numeroTrimmed
              ? "Número do processo vazio ou não encontrado na planilha"
              : `Número do processo muito curto (${numeroTrimmed.length} caracteres, mínimo 5)`;

          processo.status = "invalido";
          processo.erroImport = motivo;
          processo.erros = [{ campo: "numero", mensagem: motivo }];
        } else {
          processo.status = "valido";
        }

        return processo;
      });

      setJanainaProcessos(parsed);

      const validCount = parsed.filter((p) => p.status === "valido").length;
      const invalidCount = parsed.filter((p) => p.status === "invalido").length;

      if (parsed.length === 0) {
        toast({
          title: "Nenhum processo encontrado",
          description: "A planilha não contém dados. Verifique se a primeira linha contém os cabeçalhos.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Planilha carregada",
          description: `${parsed.length} linha(s) lida(s) (esperado: ${totalDataRows}): ${validCount} importável(is), ${invalidCount} rejeitada(s).`,
          variant: invalidCount > 0 || parsed.length !== totalDataRows ? "destructive" : "default",
        });
      }
    } catch (error) {
      console.error("Erro ao ler planilha Dra. Janaina:", error);
      toast({
        title: "Erro ao ler planilha",
        description: "Verifique se o arquivo está no formato correto (.xlsx ou .xls).",
        variant: "destructive",
      });
    }
  };

  const handleJanainaImport = async () => {
    const validProcessos = janainaProcessos.filter(p => p.status === "valido");
    const invalidProcessos = janainaProcessos.filter(p => p.status === "invalido");
    
    if (validProcessos.length === 0 && invalidProcessos.length === 0) {
      toast({
        title: "Nenhum processo para processar",
        description: "A planilha não contém dados válidos.",
        variant: "destructive",
      });
      return;
    }

    setJanainaImporting(true);
    startImport("Importando ACH Contingencial");
    setJanainaProgress(0);

    const updatedProcessos = [...janainaProcessos];
    let successCountLocal = 0;
    let errorCountLocal = 0;
    let rejectedCountLocal = 0;
    
    // Create a mutable copy of clientes to track newly created clients during import
    const clientesCache: { id: string; nome: string; tipo: string }[] = [...clientes];

    for (let i = 0; i < updatedProcessos.length; i++) {
      const processo = updatedProcessos[i];
      
      // Process invalid records - mark them as rejected with clear reason
      if (processo.status === "invalido") {
        const motivo = !processo.numero || processo.numero.trim() === "" 
          ? "Número do processo vazio ou não encontrado na planilha"
          : processo.numero.trim().length < 5 
            ? `Número do processo muito curto (${processo.numero.trim().length} caracteres, mínimo 5)`
            : "Dados insuficientes para importação";
        
        updatedProcessos[i] = { 
          ...processo, 
          status: "invalido", 
          erroImport: motivo,
          erros: processo.erros.length > 0 ? processo.erros : [{ campo: "numero", mensagem: motivo }]
        };
        rejectedCountLocal++;
        setJanainaProgress(((i + 1) / updatedProcessos.length) * 100);
        setJanainaProcessos([...updatedProcessos]);
        continue;
      }

      try {
        const janainaData = (processo as any).janainaData || {};

        // Check if process already exists
        const { data: existingProcesso } = await supabase
          .from("processos")
          .select("id")
          .eq("numero", processo.numero.trim())
          .maybeSingle();

        const areaSlug = await ensureAreaExists(processo.area);

        // Determine cliente_id: use from spreadsheet column "Cliente" if available, otherwise use selected
        let clienteIdToUse = selectedCliente || null;
        let clienteNomeFromSheet: string | null = null;
        
        if (janainaData.cliente) {
          clienteNomeFromSheet = janainaData.cliente.trim();
          // Try to find existing client by name in our mutable cache
          const existingCliente = clientesCache.find(c => 
            c.nome.toLowerCase().trim() === clienteNomeFromSheet!.toLowerCase()
          );
          
          if (existingCliente) {
            clienteIdToUse = existingCliente.id;
          } else {
            // Create new client
            const { data: novoCliente, error: clienteError } = await supabase
              .from("clientes")
              .insert({
                nome: clienteNomeFromSheet,
                tipo: "pessoa_juridica",
              })
              .select("id, nome")
              .single();
            
            if (!clienteError && novoCliente) {
              clienteIdToUse = novoCliente.id;
              // Add to local cache so next rows can find it
              clientesCache.push({ id: novoCliente.id, nome: novoCliente.nome, tipo: "pessoa_juridica" });
            } else {
              console.warn(`Falha ao criar cliente ${clienteNomeFromSheet}:`, clienteError?.message);
            }
          }
        }

        const processoData: any = {
          numero: processo.numero.trim(),
          area: areaSlug,
          status: mapStatusToEnum(processo.situacao),
          situacao_original: getSituacaoOriginal(processo.situacao),
          assunto: processo.assunto,
          vara: processo.orgaoJulgador,
          comarca: janainaData.comarca,
          data_distribuicao: parseDate(processo.dataDistribuicao),
          valor_causa: parseNumber(processo.valorAcao),
          polo_ativo: janainaData.reclamante,
          polo_passivo: janainaData.reclamados,
          valor_condenacao: processo.valorCondenacao,
          coordenacao_id: selectedCoordenacao || null,
          advogado_responsavel_id: selectedMembro || null,
          cliente_id: clienteIdToUse,
          monitorar_andamentos: janainaBuscarAndamentos,
          // ACH specific fields
          ativo_passivo: janainaData.ativoPasso,
          reclamante: janainaData.reclamante,
          reclamados: janainaData.reclamados,
          data_desligamento: parseDate(janainaData.desligamento),
          responsabilidade_tipo: janainaData.responsabilidadeTipo,
          pedido_valor: janainaData.pedidoValor,
          andamento_atual: janainaData.andamento,
          data_consulta: parseDate(janainaData.dataConsulta),
          periodo_condenacao: janainaData.periodoCondenacao,
          risco_anterior: janainaData.riscoAnterior,
          risco_atual: janainaData.riscoAtual,
          mudanca_risco: janainaData.mudancaRisco === "Sim" || janainaData.mudancaRisco === "Não" ? janainaData.mudancaRisco === "Sim" : null,
          justificativa_risco: janainaData.justificativa,
          valor_perda_anterior: janainaData.valorPerdaAnterior,
          valor_perda_atual: janainaData.valorPerdaAtual,
          responsabilidade_antes_data: janainaData.valorResponsabilidadeAte,
          responsabilidade_apos_data: janainaData.valorResponsabilidadeApos,
          adicao_baixa: janainaData.adicaoBaixa,
          depositos_vinculados: janainaData.depositosVinculados,
          epoca_razao: janainaData.epocaRazao,
          funcao: janainaData.funcao,
          setor: janainaData.setor,
          advogado_externo: processo.responsavel,
        };

        let isUpdate = false;

        if (existingProcesso) {
          const { error } = await supabase
            .from("processos")
            .update(processoData)
            .eq("id", existingProcesso.id);

          if (error) {
            updatedProcessos[i] = { ...processo, status: "erro", erroImport: error.message };
            errorCountLocal++;
            continue;
          }
          isUpdate = true;
        } else {
          // Create pasta with pattern "Reclamante x Cliente"
          let pastaId: string | null = null;
          const reclamante = janainaData.reclamante || processo.parteAtiva || "Sem Reclamante";
          const clienteNome = clienteNomeFromSheet || clientes.find(c => c.id === clienteIdToUse)?.nome || "Sem Cliente";
          const nomePasta = `${reclamante} x ${clienteNome}`;
          
          // Get current user for pasta creation
          const { data: { user } } = await supabase.auth.getUser();
          
          if (user) {
            const { data: novaPasta, error: pastaError } = await supabase
              .from("pastas")
              .insert({
                nome: nomePasta,
                descricao: `Pasta criada automaticamente para o processo ${processo.numero}`,
                cliente_id: clienteIdToUse,
                coordenacao_id: selectedCoordenacao || null,
                criado_por: user.id,
              })
              .select("id")
              .single();
            
            if (!pastaError && novaPasta) {
              pastaId = novaPasta.id;
            } else {
              console.warn(`Falha ao criar pasta para processo ${processo.numero}:`, pastaError?.message);
            }
          }

          const { data: insertedProcesso, error } = await supabase
            .from("processos")
            .insert({ ...processoData, pasta_id: pastaId } as any)
            .select("id")
            .single();

          if (error) {
            updatedProcessos[i] = { ...processo, status: "erro", erroImport: translateDatabaseError(error.message) };
            errorCountLocal++;
            continue;
          }

          if (janainaBuscarAndamentos && insertedProcesso) {
            const andamentosRes = await buscarAndamentosExternos(insertedProcesso.id, processo.numero.trim());
            if (!andamentosRes.success) {
              console.warn(`Falha ao buscar andamentos do processo ${processo.numero}:`, andamentosRes.error);
            }
          }
        }
        
        updatedProcessos[i] = { 
          ...processo, 
          status: "sucesso", 
          erroImport: isUpdate ? "Atualizado (já existia)" : undefined 
        };
        successCountLocal++;
      } catch (err: any) {
        updatedProcessos[i] = { ...processo, status: "erro", erroImport: err.message };
        errorCountLocal++;
      }

      setJanainaProgress(((i + 1) / updatedProcessos.length) * 100);
      setJanainaProcessos([...updatedProcessos]);
    }

    setJanainaImporting(false);
    endImport();

    const totalProcessed = successCountLocal + errorCountLocal + rejectedCountLocal;
    toast({
      title: "Importação Dra. Janaina concluída",
      description: `${successCountLocal} importado(s), ${rejectedCountLocal} rejeitado(s), ${errorCountLocal} erro(s). Total: ${totalProcessed}/${updatedProcessos.length}`,
      variant: errorCountLocal > 0 || rejectedCountLocal > 0 ? "destructive" : "default",
    });

    // Se houve rejeições/erros, já gera o arquivo de problemas automaticamente
    // (garante conferência: rejeitados + gravados = total da planilha)
    if (rejectedCountLocal > 0 || errorCountLocal > 0) {
      setTimeout(() => downloadJanainaRejeitados(updatedProcessos), 0);
    }
  };

  const downloadJanainaRejeitados = (processosToExport: ProcessoImport[] = janainaProcessos) => {
    const rejeitados = processosToExport.filter((p) => p.status === "invalido" || p.status === "erro");
    const comAvisos = processosToExport.filter(
      (p) => (p.status === "sucesso" || p.status === "valido") && p.erros.length > 0
    );

    if (rejeitados.length === 0 && comAvisos.length === 0) {
      toast({
        title: "Nenhum problema encontrado",
        description: "Não há processos rejeitados ou com avisos para exportar.",
      });
      return;
    }

    const rejeitadosData = rejeitados.map((p) => ({
      Linha: p.linhaOriginal,
      "Número do processo": p.numero || "(vazio)",
      Reclamante: p.parteAtiva,
      Reclamados: p.partePassiva,
      Vara: p.orgaoJulgador,
      Status: p.situacao,
      Tipo: "REJEITADO",
      Motivo:
        p.erros.map((e) => `${e.campo}: ${e.mensagem}`).join("; ") ||
        p.erroImport ||
        "Erro crítico",
    }));

    const avisosData = comAvisos.map((p) => ({
      Linha: p.linhaOriginal,
      "Número do processo": p.numero,
      Reclamante: p.parteAtiva,
      Reclamados: p.partePassiva,
      Vara: p.orgaoJulgador,
      Status: p.situacao,
      Tipo: "IMPORTADO COM AVISOS",
      Avisos: p.erros.map((e) => `${e.campo}: ${e.mensagem}`).join("; "),
    }));

    const allData = [...rejeitadosData, ...avisosData];

    const ws = XLSX.utils.json_to_sheet(allData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Problemas");

    const colWidths = Object.keys(allData[0] || {}).map((key) => ({
      wch: Math.max(key.length, 15),
    }));
    ws["!cols"] = colWidths;

    XLSX.writeFile(wb, `janaina_problemas_${new Date().toISOString().split("T")[0]}.xlsx`);

    toast({
      title: "Arquivo gerado",
      description: `${rejeitados.length} rejeitado(s), ${comAvisos.length} com avisos.`,
    });
  };

  const clearJanaina = () => {
    setJanainaFile(null);
    setJanainaProcessos([]);
    setJanainaProgress(0);
  };

  return (
    <MainLayout title="Importar Processos" subtitle="Importe processos em lote">
      <div className="space-y-6">
        <Tabs defaultValue="lista" className="w-full">
          <TabsList className="grid w-full grid-cols-5 max-w-2xl">
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
            <TabsTrigger value="osmar" className="flex items-center gap-2">
              <Hospital className="h-4 w-4" />
              <span className="hidden sm:inline">Dr. Osmar</span>
            </TabsTrigger>
            <TabsTrigger value="janaina" className="flex items-center gap-2">
              <Scale className="h-4 w-4" />
              <span className="hidden sm:inline">Dra. Janaina</span>
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

                {/* Opção de buscar andamentos */}
                <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30">
                  <div className="space-y-0.5">
                    <Label htmlFor="buscar-andamentos" className="flex items-center gap-2 font-medium">
                      <Clock className="h-4 w-4" />
                      Buscar andamentos na importação
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {buscarAndamentos 
                        ? "Os andamentos serão buscados durante a importação e o processo ficará habilitado para monitoramento automático."
                        : "Os andamentos NÃO serão buscados e o processo ficará desabilitado para monitoramento. Você pode habilitar depois na lista de processos."}
                    </p>
                  </div>
                  <Switch
                    id="buscar-andamentos"
                    checked={buscarAndamentos}
                    onCheckedChange={setBuscarAndamentos}
                    disabled={batchImporting}
                  />
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

                {/* Opção de buscar andamentos - Planilha */}
                <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30 max-w-md">
                  <div className="space-y-0.5">
                    <Label htmlFor="buscar-andamentos-planilha" className="flex items-center gap-2 font-medium">
                      <Clock className="h-4 w-4" />
                      Buscar andamentos na importação
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {planilhaBuscarAndamentos 
                        ? "Os andamentos serão buscados durante a importação e o processo ficará habilitado para monitoramento automático."
                        : "Os andamentos NÃO serão buscados e o processo ficará desabilitado para monitoramento."}
                    </p>
                  </div>
                  <Switch
                    id="buscar-andamentos-planilha"
                    checked={planilhaBuscarAndamentos}
                    onCheckedChange={setPlanilhaBuscarAndamentos}
                    disabled={importing}
                  />
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
                      disabled={projurisImporting || projurisParsing}
                    />
                    {projurisFile && !projurisParsing && (
                      <Button variant="outline" onClick={clearProjuris} disabled={projurisImporting}>
                        Limpar
                      </Button>
                    )}
                  </div>
                  
                  {/* Progress bar during file parsing */}
                  {projurisParsing && (
                    <div className="mt-4 space-y-2 max-w-md">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Carregando planilha... {projurisParseProgress}%</span>
                      </div>
                      <Progress value={projurisParseProgress} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        Processando registros da planilha. Para arquivos grandes, isso pode levar alguns segundos.
                      </p>
                    </div>
                  )}
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

                {/* Opção de buscar andamentos - Projuris */}
                <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30 max-w-md">
                  <div className="space-y-0.5">
                    <Label htmlFor="buscar-andamentos-projuris" className="flex items-center gap-2 font-medium">
                      <Clock className="h-4 w-4" />
                      Buscar andamentos na importação
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {projurisBuscarAndamentos 
                        ? "Os andamentos serão buscados durante a importação e o processo ficará habilitado para monitoramento automático."
                        : "Os andamentos NÃO serão buscados e o processo ficará desabilitado para monitoramento."}
                    </p>
                  </div>
                  <Switch
                    id="buscar-andamentos-projuris"
                    checked={projurisBuscarAndamentos}
                    onCheckedChange={setProjurisBuscarAndamentos}
                    disabled={projurisImporting}
                  />
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
                        {projurisImporting ? (
                          <Button 
                            variant="destructive"
                            onClick={cancelProjurisImport}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Cancelar
                          </Button>
                        ) : (
                          <Button 
                            onClick={handleProjurisImport} 
                            disabled={projurisValidCount === 0}
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            Importar ({projurisValidCount})
                          </Button>
                        )}
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

          {/* Tab: Dr. Osmar (Rede D'Or) */}
          <TabsContent value="osmar" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Hospital className="h-5 w-5" />
                  Importar Dr. Osmar (Rede D'Or)
                </CardTitle>
                <CardDescription>
                  Importe processos usando a planilha no formato Rede D'Or. Processos existentes serão atualizados.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Faça upload da planilha</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    A planilha deve conter as colunas: ADVOGADO, UNIDADE, Sigla, Numero do processo, VARA, STATUS DO PROCESSO, etc.
                  </p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleOsmarFileChange}
                      className="max-w-xs"
                      disabled={osmarImporting}
                    />
                    {osmarFile && (
                      <Button variant="outline" onClick={clearOsmar} disabled={osmarImporting}>
                        Limpar
                      </Button>
                    )}
                  </div>
                </div>
                
                {/* Coordenação Selection */}
                <div className="space-y-2 pt-4 border-t">
                  <Label htmlFor="coordenacao-osmar" className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Coordenação Responsável
                  </Label>
                  <Select 
                    value={selectedCoordenacao} 
                    onValueChange={(value) => {
                      setSelectedCoordenacao(value);
                      setSelectedMembro("");
                    }}
                    disabled={osmarImporting}
                  >
                    <SelectTrigger id="coordenacao-osmar" className="max-w-md">
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
                </div>

                {/* Member Selection */}
                {selectedCoordenacao && membrosDisponiveis.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="membro-osmar" className="flex items-center gap-2">
                      Advogado Responsável (opcional)
                    </Label>
                    <Select 
                      value={selectedMembro} 
                      onValueChange={setSelectedMembro}
                      disabled={osmarImporting}
                    >
                      <SelectTrigger id="membro-osmar" className="max-w-md">
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
                  </div>
                )}

                {/* Cliente Selection */}
                <div className="space-y-2">
                  <Label htmlFor="cliente-osmar" className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Cliente (opcional)
                  </Label>
                  <Select 
                    value={selectedCliente} 
                    onValueChange={setSelectedCliente}
                    disabled={osmarImporting}
                  >
                    <SelectTrigger id="cliente-osmar" className="max-w-md">
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
                </div>

                {/* Opção de buscar andamentos - Dr. Osmar */}
                <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30 max-w-md">
                  <div className="space-y-0.5">
                    <Label htmlFor="buscar-andamentos-osmar" className="flex items-center gap-2 font-medium">
                      <Clock className="h-4 w-4" />
                      Buscar andamentos na importação
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {osmarBuscarAndamentos 
                        ? "Os andamentos serão buscados durante a importação e o processo ficará habilitado para monitoramento automático."
                        : "Os andamentos NÃO serão buscados e o processo ficará desabilitado para monitoramento."}
                    </p>
                  </div>
                  <Switch
                    id="buscar-andamentos-osmar"
                    checked={osmarBuscarAndamentos}
                    onCheckedChange={setOsmarBuscarAndamentos}
                    disabled={osmarImporting}
                  />
                </div>
                
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Colunas reconhecidas:</strong> ADVOGADO, UNIDADE, Sigla, Controladora / Consolidado, Parte Contrária, CPF / CNPJ, Distribuição, Numero do processo, Fase do Processo, VARA, PEDIDOS, FUNÇÃO, ANDAMENTO, Esfera, Natureza, Matéria, 3º, Estado, STATUS DO PROCESSO, Provável, Possível, Remoto, Valor do pagamento, Valor pago, Depósito judicial, Observações.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Osmar File Preview */}
            {osmarFile && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <CardTitle>Pré-visualização Dr. Osmar</CardTitle>
                      <CardDescription>
                        {osmarProcessos.length} processo(s) encontrado(s) em "{osmarFile.name}"
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      {osmarProcessos.length > 0 && (
                        <div className="flex items-center gap-2 text-sm flex-wrap">
                          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">
                            {osmarValidCount} importáveis
                          </Badge>
                          {osmarWarningCount > 0 && (
                            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-200">
                              {osmarWarningCount} com avisos
                            </Badge>
                          )}
                          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-200">
                            {osmarInvalidCount} rejeitados
                          </Badge>
                          {osmarSuccessCount > 0 && (
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-200">
                              {osmarSuccessCount} importados
                            </Badge>
                          )}
                          {osmarErrorCount > 0 && (
                            <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-200">
                              {osmarErrorCount} erros
                            </Badge>
                          )}
                        </div>
                      )}
                      <div className="flex gap-2">
                        {osmarTotalProblemas > 0 && (
                          <Button variant="outline" onClick={downloadOsmarRejeitados}>
                            <FileDown className="h-4 w-4 mr-2" />
                            Baixar Problemas ({osmarTotalProblemas})
                          </Button>
                        )}
                        <Button 
                          onClick={handleOsmarImport} 
                          disabled={osmarImporting || osmarValidCount === 0}
                        >
                          {osmarImporting ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Importando...
                            </>
                          ) : (
                            <>
                              <Upload className="h-4 w-4 mr-2" />
                              Importar ({osmarValidCount})
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                  {osmarImporting && (
                    <Progress value={osmarProgress} className="mt-4" />
                  )}
                </CardHeader>
                <CardContent>
                  {osmarProcessos.length === 0 ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Nenhum processo encontrado na planilha. Verifique se é uma planilha no formato Rede D'Or.
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
                              <TableHead>Unidade</TableHead>
                              <TableHead>Parte Contrária</TableHead>
                              <TableHead>Fase</TableHead>
                              <TableHead>Status Proc.</TableHead>
                              <TableHead className="min-w-[300px]">Avisos/Erros</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {osmarProcessos.map((processo, index) => (
                              <TableRow key={index} className={
                                processo.status === "invalido" ? "bg-red-50 dark:bg-red-950/20" : 
                                processo.status === "erro" ? "bg-orange-50 dark:bg-orange-950/20" : 
                                (processo.status === "valido" || processo.status === "sucesso") && processo.erros.length > 0 ? "bg-yellow-50 dark:bg-yellow-950/20" : ""
                              }>
                                <TableCell className="text-muted-foreground">
                                  {processo.linhaOriginal}
                                </TableCell>
                                <TableCell>
                                  {processo.status === "valido" && processo.erros.length === 0 && (
                                    <div className="w-3 h-3 rounded-full bg-green-500" />
                                  )}
                                  {processo.status === "valido" && processo.erros.length > 0 && (
                                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                                  )}
                                  {processo.status === "invalido" && (
                                    <XCircle className="h-4 w-4 text-red-500" />
                                  )}
                                  {processo.status === "sucesso" && processo.erros.length === 0 && (
                                    <CheckCircle2 className="h-4 w-4 text-blue-500" />
                                  )}
                                  {processo.status === "sucesso" && processo.erros.length > 0 && (
                                    <CheckCircle2 className="h-4 w-4 text-yellow-500" />
                                  )}
                                  {processo.status === "erro" && (
                                    <XCircle className="h-4 w-4 text-orange-500" />
                                  )}
                                </TableCell>
                                <TableCell className="font-mono text-sm">
                                  {processo.numero || <span className="text-red-500 italic">vazio</span>}
                                </TableCell>
                                <TableCell className="max-w-[150px] truncate">
                                  {processo.parteAtiva || "-"}
                                </TableCell>
                                <TableCell className="max-w-[150px] truncate">
                                  {processo.partePassiva || "-"}
                                </TableCell>
                                <TableCell>{processo.fase || "-"}</TableCell>
                                <TableCell>{processo.situacao || "-"}</TableCell>
                                <TableCell className="text-sm">
                                  {processo.status === "invalido" && processo.erros.length > 0 && (
                                    <div className="text-red-600 space-y-1">
                                      {processo.erros.map((erro, i) => (
                                        <div key={i}>• {erro.campo}: {erro.mensagem}</div>
                                      ))}
                                    </div>
                                  )}
                                  {(processo.status === "valido" || processo.status === "sucesso") && processo.erros.length > 0 && (
                                    <div className="text-yellow-600 space-y-1">
                                      {processo.erros.map((erro, i) => (
                                        <div key={i}>⚠ {erro.campo}: {erro.mensagem}</div>
                                      ))}
                                    </div>
                                  )}
                                  {processo.erroImport && (
                                    <div className="text-orange-600">• Importação: {processo.erroImport}</div>
                                  )}
                                  {processo.status === "valido" && processo.erros.length === 0 && "-"}
                                  {processo.status === "sucesso" && processo.erros.length === 0 && <span className="text-blue-600">Importado com sucesso</span>}
                                  {processo.status === "sucesso" && processo.erros.length > 0 && <span className="text-yellow-600 block mt-1">Importado com avisos</span>}
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

          {/* Tab: Dra. Janaina (ACH Contingencial) */}
          <TabsContent value="janaina" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scale className="h-5 w-5" />
                  Importar Dra. Janaina (ACH Contingencial)
                </CardTitle>
                <CardDescription>
                  Importe processos trabalhistas usando a planilha de controle contingencial ACH. Processos existentes serão atualizados.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Faça upload da planilha</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    A planilha deve conter as colunas: Processo Judicial, Status, Comarca, Vara, Data do Ajuizamento, Reclamante, Reclamados, etc.
                  </p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleJanainaFileChange}
                      className="max-w-xs"
                      disabled={janainaImporting}
                    />
                    {janainaFile && (
                      <Button variant="outline" onClick={clearJanaina} disabled={janainaImporting}>
                        Limpar
                      </Button>
                    )}
                  </div>
                </div>
                
                {/* Coordenação Selection */}
                <div className="space-y-2 pt-4 border-t">
                  <Label htmlFor="coordenacao-janaina" className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Coordenação Responsável
                  </Label>
                  <Select 
                    value={selectedCoordenacao} 
                    onValueChange={(value) => {
                      setSelectedCoordenacao(value);
                      setSelectedMembro("");
                    }}
                    disabled={janainaImporting}
                  >
                    <SelectTrigger id="coordenacao-janaina" className="max-w-md">
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
                </div>

                {/* Member Selection */}
                {selectedCoordenacao && membrosDisponiveis.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="membro-janaina" className="flex items-center gap-2">
                      Advogado Responsável (opcional)
                    </Label>
                    <Select 
                      value={selectedMembro} 
                      onValueChange={setSelectedMembro}
                      disabled={janainaImporting}
                    >
                      <SelectTrigger id="membro-janaina" className="max-w-md">
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
                  </div>
                )}

                {/* Cliente Selection */}
                <div className="space-y-2">
                  <Label htmlFor="cliente-janaina" className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Cliente (opcional)
                  </Label>
                  <Select 
                    value={selectedCliente} 
                    onValueChange={setSelectedCliente}
                    disabled={janainaImporting}
                  >
                    <SelectTrigger id="cliente-janaina" className="max-w-md">
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
                </div>

                {/* Opção de buscar andamentos */}
                <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30 max-w-md">
                  <div className="space-y-0.5">
                    <Label htmlFor="buscar-andamentos-janaina" className="flex items-center gap-2 font-medium">
                      <Clock className="h-4 w-4" />
                      Buscar andamentos na importação
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {janainaBuscarAndamentos 
                        ? "Os andamentos serão buscados durante a importação e o processo ficará habilitado para monitoramento automático."
                        : "Os andamentos NÃO serão buscados e o processo ficará desabilitado para monitoramento."}
                    </p>
                  </div>
                  <Switch
                    id="buscar-andamentos-janaina"
                    checked={janainaBuscarAndamentos}
                    onCheckedChange={setJanainaBuscarAndamentos}
                    disabled={janainaImporting}
                  />
                </div>
                
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Colunas reconhecidas:</strong> Processo Judicial, Status, Comarca, Vara, Data do Ajuizamento, Ativo/Passivo, Reclamante, Reclamados, Natureza, Desligamento, Responsabilidade, Assunto da Ação, Pedido e Valor, Andamento, Data da Consulta, Período da Condenação, Risco Perda, Justificativa, Valor da Causa, Valor Perda, Valor da Condenação, Depósitos vinculados, Função, Advogado, Setor.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Janaina File Preview */}
            {janainaFile && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <CardTitle>Pré-visualização Dra. Janaina</CardTitle>
                      <CardDescription>
                        {janainaProcessos.length} processo(s) encontrado(s) em "{janainaFile.name}"
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      {janainaProcessos.length > 0 && (
                        <div className="flex items-center gap-2 text-sm flex-wrap">
                          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">
                            {janainaValidCount} importáveis
                          </Badge>
                          {janainaWarningCount > 0 && (
                            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-200">
                              {janainaWarningCount} com avisos
                            </Badge>
                          )}
                          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-200">
                            {janainaInvalidCount} rejeitados
                          </Badge>
                          {janainaSuccessCount > 0 && (
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-200">
                              {janainaSuccessCount} importados
                            </Badge>
                          )}
                          {janainaErrorCount > 0 && (
                            <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-200">
                              {janainaErrorCount} erros
                            </Badge>
                          )}
                        </div>
                      )}
                      <div className="flex gap-2">
                        {janainaTotalProblemas > 0 && (
                          <Button variant="outline" onClick={() => downloadJanainaRejeitados()}>
                            <FileDown className="h-4 w-4 mr-2" />
                            Baixar Problemas ({janainaTotalProblemas})
                          </Button>
                        )}
                        <Button 
                          onClick={handleJanainaImport} 
                          disabled={janainaImporting || janainaValidCount === 0}
                        >
                          {janainaImporting ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Importando...
                            </>
                          ) : (
                            <>
                              <Upload className="h-4 w-4 mr-2" />
                              Importar ({janainaValidCount})
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                  {janainaImporting && (
                    <Progress value={janainaProgress} className="mt-4" />
                  )}
                </CardHeader>
                <CardContent>
                  {janainaProcessos.length === 0 ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Nenhum processo encontrado na planilha. Verifique se é uma planilha no formato ACH Contingencial.
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
                              <TableHead>Reclamante</TableHead>
                              <TableHead>Reclamados</TableHead>
                              <TableHead>Vara</TableHead>
                              <TableHead>Status Proc.</TableHead>
                              <TableHead className="min-w-[300px]">Avisos/Erros</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {janainaProcessos.map((processo, index) => (
                              <TableRow key={index} className={
                                processo.status === "invalido" ? "bg-red-50 dark:bg-red-950/20" : 
                                processo.status === "erro" ? "bg-orange-50 dark:bg-orange-950/20" : 
                                (processo.status === "valido" || processo.status === "sucesso") && processo.erros.length > 0 ? "bg-yellow-50 dark:bg-yellow-950/20" : ""
                              }>
                                <TableCell className="text-muted-foreground">
                                  {processo.linhaOriginal}
                                </TableCell>
                                <TableCell>
                                  {processo.status === "valido" && processo.erros.length === 0 && (
                                    <div className="w-3 h-3 rounded-full bg-green-500" />
                                  )}
                                  {processo.status === "valido" && processo.erros.length > 0 && (
                                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                                  )}
                                  {processo.status === "invalido" && (
                                    <XCircle className="h-4 w-4 text-red-500" />
                                  )}
                                  {processo.status === "sucesso" && processo.erros.length === 0 && (
                                    <CheckCircle2 className="h-4 w-4 text-blue-500" />
                                  )}
                                  {processo.status === "sucesso" && processo.erros.length > 0 && (
                                    <CheckCircle2 className="h-4 w-4 text-yellow-500" />
                                  )}
                                  {processo.status === "erro" && (
                                    <XCircle className="h-4 w-4 text-orange-500" />
                                  )}
                                </TableCell>
                                <TableCell className="font-mono text-sm">
                                  {processo.numero || <span className="text-red-500 italic">vazio</span>}
                                </TableCell>
                                <TableCell className="max-w-[150px] truncate">
                                  {processo.parteAtiva || "-"}
                                </TableCell>
                                <TableCell className="max-w-[150px] truncate">
                                  {processo.partePassiva || "-"}
                                </TableCell>
                                <TableCell>{processo.orgaoJulgador || "-"}</TableCell>
                                <TableCell>{processo.situacao || "-"}</TableCell>
                                <TableCell className="text-sm">
                                  {processo.status === "invalido" && processo.erros.length > 0 && (
                                    <div className="text-red-600 space-y-1">
                                      {processo.erros.map((erro, i) => (
                                        <div key={i}>• {erro.campo}: {erro.mensagem}</div>
                                      ))}
                                    </div>
                                  )}
                                  {(processo.status === "valido" || processo.status === "sucesso") && processo.erros.length > 0 && (
                                    <div className="text-yellow-600 space-y-1">
                                      {processo.erros.map((erro, i) => (
                                        <div key={i}>⚠ {erro.campo}: {erro.mensagem}</div>
                                      ))}
                                    </div>
                                  )}
                                  {processo.erroImport && (
                                    <div className="text-orange-600">• Importação: {processo.erroImport}</div>
                                  )}
                                  {processo.status === "valido" && processo.erros.length === 0 && "-"}
                                  {processo.status === "sucesso" && processo.erros.length === 0 && <span className="text-blue-600">Importado com sucesso</span>}
                                  {processo.status === "sucesso" && processo.erros.length > 0 && <span className="text-yellow-600 block mt-1">Importado com avisos</span>}
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
