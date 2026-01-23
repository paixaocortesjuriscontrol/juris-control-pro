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
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2, XCircle, Loader2, FileDown, List, Building2, Users, ArrowRightLeft, Hospital, Clock, Scale, Gavel, FileText, FileBarChart } from "lucide-react";
import { useRelatorioPedidos, TipoPedido } from "@/hooks/useRelatorioPedidos";
import { 
  downloadProjurisTemplate, 
  downloadOsmarTemplate, 
  downloadJanainaTemplate, 
  downloadPolyanaTemplate, 
  downloadMptTemplate, 
  downloadPedidosTemplate 
} from "@/utils/generateTemplates";
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
  const [forcarAtualizacao, setForcarAtualizacao] = useState(false);

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
  const osmarCancelledRef = useRef(false);

  // Dra. Janaina (ACH Contingencial) import states
  const [janainaFile, setJanainaFile] = useState<File | null>(null);
  const [janainaProcessos, setJanainaProcessos] = useState<ProcessoImport[]>([]);
  const [janainaImporting, setJanainaImporting] = useState(false);
  const [janainaProgress, setJanainaProgress] = useState(0);
  const [janainaBuscarAndamentos, setJanainaBuscarAndamentos] = useState(true);
  const janainaCancelledRef = useRef(false);

  // Dra. Polyana import states
  const [polyanaFile, setPolyanaFile] = useState<File | null>(null);
  const [polyanaProcessos, setPolyanaProcessos] = useState<ProcessoImport[]>([]);
  const [polyanaImporting, setPolyanaImporting] = useState(false);
  const [polyanaProgress, setPolyanaProgress] = useState(0);
  const [polyanaBuscarAndamentos, setPolyanaBuscarAndamentos] = useState(true);
  const polyanaCancelledRef = useRef(false);

  // Ministério Público import states
  const [mptFile, setMptFile] = useState<File | null>(null);
  const [mptProcessos, setMptProcessos] = useState<ProcessoImport[]>([]);
  const [mptImporting, setMptImporting] = useState(false);
  const [mptProgress, setMptProgress] = useState(0);
  const [mptBuscarAndamentos, setMptBuscarAndamentos] = useState(true);
  const mptCancelledRef = useRef(false);

  // Pedidos import states
  const [pedidosFile, setPedidosFile] = useState<File | null>(null);
  const [pedidosProcessos, setPedidosProcessos] = useState<ProcessoImport[]>([]);
  const [pedidosImporting, setPedidosImporting] = useState(false);
  const [pedidosProgress, setPedidosProgress] = useState(0);
  const [pedidosBuscarAndamentos, setPedidosBuscarAndamentos] = useState(true);
  const pedidosCancelledRef = useRef(false);

  // Astrea import states
  const [astreaFile, setAstreaFile] = useState<File | null>(null);
  const [astreaProcessos, setAstreaProcessos] = useState<ProcessoImport[]>([]);
  const [astreaImporting, setAstreaImporting] = useState(false);
  const [astreaProgress, setAstreaProgress] = useState(0);
  const [astreaBuscarAndamentos, setAstreaBuscarAndamentos] = useState(true);
  const astreaCancelledRef = useRef(false);

  // Excel/Planilha import state for andamentos
  const planilhaCancelledRef = useRef(false);
  const [pedidosRelatorioTipo, setPedidosRelatorioTipo] = useState<TipoPedido>("todos");
  const { exportarRelatorioPedidos } = useRelatorioPedidos();

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
    planilhaCancelledRef.current = false;
    startImport("Importando planilha");
    setProgress(0);

    const updatedProcessos = [...processos];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < updatedProcessos.length; i++) {
      // Check for cancellation
      if (planilhaCancelledRef.current) {
        toast({
          title: "Importação cancelada",
          description: `Cancelada após processar ${i} de ${updatedProcessos.length} registros.`,
        });
        setImporting(false);
        endImport();
        return;
      }

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
          // Fetch current process data to check empty fields
          const { data: currentProcesso } = await supabase
            .from("processos")
            .select("*")
            .eq("id", existingProcesso.id)
            .single();

          // Update existing process - only fill empty fields, preserve responsáveis/coordenação
          const updateData: Record<string, any> = {};
          
          // Only update coordination if currently empty AND user selected one
          if (selectedCoordenacao && !currentProcesso?.coordenacao_id) {
            updateData.coordenacao_id = selectedCoordenacao;
          }
          // Only update member if currently empty AND user selected one
          if (selectedMembro && !currentProcesso?.advogado_responsavel_id) {
            updateData.advogado_responsavel_id = selectedMembro;
          }
          // Only update cliente if currently empty AND user selected one
          if (selectedCliente && !currentProcesso?.cliente_id) {
            updateData.cliente_id = selectedCliente;
          }

          // Smart merge: update only empty fields in the database with spreadsheet data
          if (!currentProcesso?.assunto && processo.assunto) {
            updateData.assunto = processo.assunto;
          }
          if (!currentProcesso?.descricao && processo.descricao) {
            updateData.descricao = processo.descricao;
          }
          if (!currentProcesso?.tribunal && processo.orgao) {
            updateData.tribunal = processo.orgao;
          }
          if (!currentProcesso?.vara && processo.orgaoJulgador) {
            updateData.vara = processo.orgaoJulgador;
          }
          if (!currentProcesso?.comarca && processo.cidade) {
            updateData.comarca = processo.cidade;
          }
          if (!currentProcesso?.classe && processo.classeCNJ) {
            updateData.classe = processo.classeCNJ;
          }
          if (!currentProcesso?.data_distribuicao && parseDate(processo.dataDistribuicao)) {
            updateData.data_distribuicao = parseDate(processo.dataDistribuicao);
          }
          if (!currentProcesso?.valor_causa && parseNumber(processo.valorAcao)) {
            updateData.valor_causa = parseNumber(processo.valorAcao);
          }
          if (!currentProcesso?.polo_ativo && processo.parteAtiva) {
            updateData.polo_ativo = processo.parteAtiva;
          }
          if (!currentProcesso?.polo_passivo && processo.partePassiva) {
            updateData.polo_passivo = processo.partePassiva;
          }
          if (!currentProcesso?.justica && processo.justica) {
            updateData.justica = processo.justica;
          }
          if (!currentProcesso?.instancia && processo.instancia) {
            updateData.instancia = processo.instancia;
          }
          if (!currentProcesso?.fase && processo.fase) {
            updateData.fase = processo.fase;
          }
          if (!currentProcesso?.uf && processo.estado) {
            updateData.uf = processo.estado;
          }
          // Update area only if current is default "civil" and spreadsheet has different area
          if (processo.area && currentProcesso?.area === "civil") {
            const newArea = mapAreaToEnum(processo.area);
            if (newArea !== "civil") {
              updateData.area = newArea;
            }
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

        // Buscar dados adicionais da API (tribunal/partes/classe) somente se a opção estiver habilitada
        if (!isUpdate && planilhaBuscarAndamentos) {
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

    const normalizeNumeroCnj = (numero: string) => numero.replace(/\D/g, "").padStart(20, "0");

    const pickProcessoFromApi = (apiData: any, numeroInput: string) => {
      if (!apiData?.found) return null;
      if (apiData?.processo) return apiData.processo;

      const processos = Array.isArray(apiData?.processos) ? apiData.processos : [];
      if (processos.length === 0) return null;

      const target = normalizeNumeroCnj(numeroInput);
      return (
        processos.find((p: any) => normalizeNumeroCnj(p?.numero ?? p?.numeroProcesso ?? "") === target) ||
        processos[0]
      );
    };

    const toDateOnly = (raw: any): string | null => {
      if (!raw) return null;
      const str = String(raw);
      const isoLike = str.includes("-") ? str : str.replace(/(\d{4})(\d{2})(\d{2}).*/, "$1-$2-$3");
      const d = new Date(isoLike);
      if (Number.isNaN(d.getTime())) return null;
      return d.toISOString().split("T")[0];
    };

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
          processoId = existingProcesso.id;
          isUpdate = true;

          // Fetch current process data to check empty fields
          const { data: currentProcesso } = await supabase
            .from("processos")
            .select("*")
            .eq("id", existingProcesso.id)
            .single();

          const updateData: Record<string, any> = {};

          // Update coordination and member if selected
          if (selectedCoordenacao) {
            updateData.coordenacao_id = selectedCoordenacao;
          }
          if (selectedMembro) {
            updateData.advogado_responsavel_id = selectedMembro;
          }
          if (selectedCliente && (forcarAtualizacao || !currentProcesso?.cliente_id)) {
            updateData.cliente_id = selectedCliente;
          }

          // Só consulta API externa se a opção estiver habilitada
          if (buscarAndamentos) {
            const { data: apiData, error: apiError } = await supabase.functions.invoke(
              "consultar-processo",
              {
                body: { numeroProcesso: processo.numero },
              }
            );
            if (apiError) throw apiError;

            const processoApi = pickProcessoFromApi(apiData, processo.numero);

            // Update with API data (force update all or only empty ones)
            if (processoApi) {
              const poloAtivoArr = Array.isArray(processoApi.poloAtivo) ? processoApi.poloAtivo : [];
              const poloPassivoArr = Array.isArray(processoApi.poloPassivo) ? processoApi.poloPassivo : [];

              const poloAtivo = poloAtivoArr.length > 0 ? poloAtivoArr.join(", ") : null;
              const poloPassivo = poloPassivoArr.length > 0 ? poloPassivoArr.join(", ") : null;

              const varaApi = processoApi.orgaoJulgador ?? processoApi.vara ?? null;
              const dataAjuizamentoApi = processoApi.dataAjuizamento ?? processoApi.dataDistribuicao ?? null;
              const valorCausaApi = processoApi.valorCausa ?? processoApi.valor_causa ?? null;

              if ((forcarAtualizacao || !currentProcesso?.tribunal) && (processoApi.tribunal || apiData?.tribunal)) {
                updateData.tribunal = processoApi.tribunal || apiData?.tribunal;
              }
              if ((forcarAtualizacao || !currentProcesso?.vara) && varaApi) {
                updateData.vara = varaApi;
              }
              if ((forcarAtualizacao || !currentProcesso?.classe) && processoApi.classe) {
                updateData.classe = processoApi.classe;
              }
              if ((forcarAtualizacao || !currentProcesso?.assunto) && processoApi.assunto) {
                updateData.assunto = processoApi.assunto;
              }
              if ((forcarAtualizacao || !currentProcesso?.polo_ativo) && poloAtivo) {
                updateData.polo_ativo = poloAtivo;
              }
              if ((forcarAtualizacao || !currentProcesso?.polo_passivo) && poloPassivo) {
                updateData.polo_passivo = poloPassivo;
              }

              const dataDistribuicao = toDateOnly(dataAjuizamentoApi);
              if ((forcarAtualizacao || !currentProcesso?.data_distribuicao) && dataDistribuicao) {
                updateData.data_distribuicao = dataDistribuicao;
              }

              if ((forcarAtualizacao || !currentProcesso?.valor_causa) && valorCausaApi) {
                updateData.valor_causa = valorCausaApi;
              }

              // Determine area based on tribunal if current is default or force update
              if (forcarAtualizacao || currentProcesso?.area === "civil" || !currentProcesso?.area) {
                const tribunalLower = String(processoApi.tribunal || apiData?.tribunal || "").toLowerCase();
                if (
                  tribunalLower.includes("trt") ||
                  tribunalLower.includes("tst") ||
                  tribunalLower.includes("trabalho")
                ) {
                  updateData.area = "trabalhista";
                }
              }
            }
          }

          if (Object.keys(updateData).length > 0) {
            const { error: updateError } = await supabase
              .from("processos")
              .update(updateData)
              .eq("id", existingProcesso.id);
            if (updateError) throw updateError;
          }
        } else {
          // Insert process with minimal data - system will fetch details from API
          const { data: insertedProcesso, error } = await supabase
            .from("processos")
            .insert({
              numero: processo.numero,
              area: "civil", // Default area
              status: "ativo",
              coordenacao_id: selectedCoordenacao || null,
              advogado_responsavel_id: selectedMembro || null,
              cliente_id: selectedCliente || null,
              monitorar_andamentos: buscarAndamentos,
            })
            .select("id")
            .single();

          if (error) {
            updatedProcessos[i] = {
              ...processo,
              status: "erro",
              erroMensagem: error.message,
            };
            errorCount++;
            continue;
          }

          processoId = insertedProcesso.id;

          // Fetch process details from external API (somente se a opção estiver habilitada)
          if (buscarAndamentos) {
            const { data: apiData, error: apiError } = await supabase.functions.invoke("consultar-processo", {
              body: { numeroProcesso: processo.numero },
            });
            if (apiError) throw apiError;

            const processoApi = pickProcessoFromApi(apiData, processo.numero);

            // Update process with API data if found
            if (processoApi) {
              const poloAtivoArr = Array.isArray(processoApi.poloAtivo) ? processoApi.poloAtivo : [];
              const poloPassivoArr = Array.isArray(processoApi.poloPassivo) ? processoApi.poloPassivo : [];

              const poloAtivo = poloAtivoArr.length > 0 ? poloAtivoArr.join(", ") : null;
              const poloPassivo = poloPassivoArr.length > 0 ? poloPassivoArr.join(", ") : null;

              // Determine area based on tribunal
              let area: string = "civil";
              const tribunalLower = String(processoApi.tribunal || apiData?.tribunal || "").toLowerCase();
              if (tribunalLower.includes("trt") || tribunalLower.includes("tst") || tribunalLower.includes("trabalho")) {
                area = "trabalhista";
              }

              const varaApi = processoApi.orgaoJulgador ?? processoApi.vara ?? null;
              const dataAjuizamentoApi = processoApi.dataAjuizamento ?? processoApi.dataDistribuicao ?? null;
              const dataDistribuicao = toDateOnly(dataAjuizamentoApi);

              const { error: updateError } = await supabase
                .from("processos")
                .update({
                  tribunal: processoApi.tribunal || apiData?.tribunal || null,
                  vara: varaApi,
                  classe: processoApi.classe || null,
                  assunto: processoApi.assunto || null,
                  polo_ativo: poloAtivo,
                  polo_passivo: poloPassivo,
                  area,
                  valor_causa: processoApi.valorCausa ?? null,
                  data_distribuicao: dataDistribuicao,
                })
                .eq("id", processoId);
              if (updateError) throw updateError;
            }
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
          erroMensagem: err.message,
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

    // Permite o React pintar o estado de "Importando..." antes de loops pesados
    console.log("[Projuris] Iniciando importação", {
      buscarAndamentos: projurisBuscarAndamentos,
      totalValidos: validProcessos.length,
    });
    await new Promise((r) => setTimeout(r, 0));

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

      // 3) Pre-create pastas and responsaveis for all processes - OPTIMIZED BATCH
      const { data: { user } } = await supabase.auth.getUser();
      const pastaCache = new Map<string, string>();
      const responsavelCache = new Map<string, string>();
      
      // Collect all unique pasta names and responsaveis names needed
      const allNomesPasta = new Set<string>();
      const allNomesResponsaveis = new Set<string>();
      
      for (const idx of [...toInsertIndices, ...toUpdateIndices]) {
        const processo = updatedProcessos[idx];
        const parteAtivaTrimmed = processo.parteAtiva?.trim() || "Sem Parte Ativa";
        const partePassivaTrimmed = processo.partePassiva?.trim() || "Sem Parte Passiva";
        const nomePasta = `${parteAtivaTrimmed} x ${partePassivaTrimmed}`;
        allNomesPasta.add(nomePasta);
        
        if (processo.responsavel?.trim()) {
          allNomesResponsaveis.add(processo.responsavel.trim().toUpperCase());
        }
      }
      
      // BATCH: Load all existing pastas at once
      const nomesPastaArray = Array.from(allNomesPasta);
      for (let i = 0; i < nomesPastaArray.length; i += CHUNK_SIZE) {
        const chunk = nomesPastaArray.slice(i, i + CHUNK_SIZE);
        const { data: pastasExistentes } = await supabase
          .from("pastas")
          .select("id, nome")
          .in("nome", chunk);
        for (const pasta of pastasExistentes || []) {
          pastaCache.set(pasta.nome, pasta.id);
        }
      }
      
      // BATCH: Load all existing profiles at once
      const nomesResponsaveisArray = Array.from(allNomesResponsaveis);
      for (let i = 0; i < nomesResponsaveisArray.length; i += CHUNK_SIZE) {
        const chunk = nomesResponsaveisArray.slice(i, i + CHUNK_SIZE);
        const orConditions = chunk.map(nome => `nome.ilike.${nome}`).join(",");
        const { data: profilesExistentes } = await supabase.from("profiles").select("id, nome").or(orConditions);
        for (const profile of profilesExistentes || []) {
          if (profile.nome) {
            responsavelCache.set(profile.nome.toUpperCase(), profile.id);
          }
        }
      }
      
      // Create missing pastas in BATCH using INSERT with ON CONFLICT (via upsert-like behavior)
      const pastasFaltantes = nomesPastaArray.filter(nome => !pastaCache.has(nome));
      if (pastasFaltantes.length > 0 && user) {
        // Insert all at once - duplicates will fail silently due to unique constraint
        const pastasToInsert = pastasFaltantes.map(nomePasta => ({
          nome: nomePasta,
          descricao: `Pasta criada automaticamente para padronização`,
          cliente_id: selectedCliente || null,
          coordenacao_id: selectedCoordenacao || null,
          criado_por: user.id,
        }));
        
        // Insert in batches to avoid payload limits
        for (let i = 0; i < pastasToInsert.length; i += BATCH_SIZE) {
          if (projurisCancelledRef.current) break;
          const batch = pastasToInsert.slice(i, i + BATCH_SIZE);
          await supabase.from("pastas").insert(batch).select(); // ignore errors (duplicates)
        }
        
        // Reload pastas cache after creation
        for (let i = 0; i < nomesPastaArray.length; i += CHUNK_SIZE) {
          const chunk = nomesPastaArray.slice(i, i + CHUNK_SIZE);
          const { data: pastasExistentes } = await supabase
            .from("pastas")
            .select("id, nome")
            .in("nome", chunk);
          for (const pasta of pastasExistentes || []) {
            pastaCache.set(pasta.nome, pasta.id);
          }
        }
      }
      
      // Create missing responsaveis using batch Edge Function
      const responsaveisFaltantes = nomesResponsaveisArray.filter(nome => !responsavelCache.has(nome));
      if (responsaveisFaltantes.length > 0 && selectedCoordenacao) {
        // Call batch Edge Function
        const perfisToCreate = responsaveisFaltantes.map(nome => ({
          nome,
          coordenacao_id: selectedCoordenacao,
          cargo: "advogado",
        }));
        
        // Process in batches of 100 (Edge Function limit)
        for (let i = 0; i < perfisToCreate.length; i += 100) {
          if (projurisCancelledRef.current) break;
          const batch = perfisToCreate.slice(i, i + 100);
          
          const { data: loteResult, error: loteError } = await supabase.functions.invoke("cadastrar-perfis-lote", {
            body: { perfis: batch },
          });
          
          if (!loteError && loteResult?.resultados) {
            // Merge results into cache
            for (const [nome, id] of Object.entries(loteResult.resultados)) {
              responsavelCache.set(nome as string, id as string);
            }
          }
        }
      }
      
      // Build full payload for all processes (insert + update)
      const allIndices = [...toInsertIndices, ...toUpdateIndices];
      const processoExtras = new Map<number, { pastaId: string | null; responsavelId: string | null }>();
      
      for (const idx of allIndices) {
        const processo = updatedProcessos[idx];
        const parteAtivaTrimmed = processo.parteAtiva?.trim() || "Sem Parte Ativa";
        const partePassivaTrimmed = processo.partePassiva?.trim() || "Sem Parte Passiva";
        const nomePasta = `${parteAtivaTrimmed} x ${partePassivaTrimmed}`;
        
        const pastaId = pastaCache.get(nomePasta) || null;
        let responsavelId = selectedMembro || null;
        
        if (processo.responsavel?.trim()) {
          const nomeResp = processo.responsavel.trim().toUpperCase();
          const cachedResp = responsavelCache.get(nomeResp);
          if (cachedResp) {
            responsavelId = cachedResp;
          }
        }
        
        processoExtras.set(idx, { pastaId, responsavelId });
      }

      // Build UPSERT payload
      const buildUpsertPayload = (p: ProcessoImport, idx: number) => {
        const extras = processoExtras.get(idx);
        return {
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
          advogado_responsavel_id: extras?.responsavelId || selectedMembro || null,
          cliente_id: selectedCliente || null,
          pasta_id: extras?.pastaId || null,
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
        };
      };

      // 4) UPSERT all processes in batches (insert or update by numero)
      let processed = 0;
      const totalToProcess = allIndices.length;

      for (let i = 0; i < allIndices.length; i += BATCH_SIZE) {
        if (projurisCancelledRef.current) break;

        const batchIndices = allIndices.slice(i, i + BATCH_SIZE);
        const upsertPayload = batchIndices.map((idx) => buildUpsertPayload(updatedProcessos[idx], idx));

        // Use upsert with onConflict to handle both insert and update
        const { error } = await supabase
          .from("processos")
          .upsert(upsertPayload, { 
            onConflict: "numero",
            ignoreDuplicates: false // We want to update on conflict
          });
        
        if (error) {
          // If batch fails, try one-by-one to identify problematic records
          for (const idx of batchIndices) {
            if (projurisCancelledRef.current) break;
            
            const singlePayload = buildUpsertPayload(updatedProcessos[idx], idx);
            const { error: singleError } = await supabase
              .from("processos")
              .upsert([singlePayload], { onConflict: "numero" });
            
            if (singleError) {
              const translatedError = translateDatabaseError(singleError.message);
              updatedProcessos[idx] = { ...updatedProcessos[idx], status: "erro", erroImport: translatedError };
              errorCount++;
            } else {
              const wasUpdate = existingMap.has(updatedProcessos[idx].numero.trim());
              updatedProcessos[idx] = { 
                ...updatedProcessos[idx], 
                status: "sucesso", 
                erroImport: wasUpdate ? "Atualizado" : undefined 
              };
              successCount++;
            }
          }
        } else {
          // Batch succeeded
          for (const idx of batchIndices) {
            const wasUpdate = existingMap.has(updatedProcessos[idx].numero.trim());
            updatedProcessos[idx] = { 
              ...updatedProcessos[idx], 
              status: "sucesso",
              erroImport: wasUpdate ? "Atualizado" : undefined
            };
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
          .select("id, pasta_id")
          .eq("numero", processo.numero.trim())
          .maybeSingle();

        let processoId: string;
        let isUpdate = false;

        // Build pasta name from "Parte Ativa x Parte Passiva"
        const parteAtiva = processo.parteAtiva?.trim() || "Sem Parte Ativa";
        const partePassiva = processo.partePassiva?.trim() || "Sem Parte Passiva";
        const nomePasta = `${parteAtiva} x ${partePassiva}`;

        // Helper to find or create responsavel via Edge Function
        const findOrCreateResponsavel = async (nomeResponsavel: string): Promise<string | null> => {
          if (!nomeResponsavel?.trim()) return null;
          
          const nomeTrimmed = nomeResponsavel.trim().toUpperCase();
          
          // Try to find by name (case-insensitive)
          const { data: existingProfile } = await supabase
            .from("profiles")
            .select("id")
            .ilike("nome", nomeTrimmed)
            .maybeSingle();
          
          if (existingProfile) {
            return existingProfile.id;
          }
          
          // Create new profile via Edge Function
          if (selectedCoordenacao) {
            const { data: novoProfile, error: profileError } = await supabase.functions.invoke("cadastrar-perfil", {
              body: {
                nome: nomeTrimmed,
                coordenacao_id: selectedCoordenacao,
                cargo: "advogado",
              },
            });
            
            if (!profileError && novoProfile?.profile?.id) {
              return novoProfile.profile.id;
            }
            console.warn(`Falha ao criar perfil ${nomeTrimmed}:`, profileError);
          }
          
          return null;
        };

        // Helper to create or find pasta
        const findOrCreatePasta = async (coordenacaoId: string | null): Promise<string | null> => {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return null;
          
          // Check if pasta with this name already exists
          const { data: pastaExistente } = await supabase
            .from("pastas")
            .select("id")
            .eq("nome", nomePasta)
            .maybeSingle();
          
          if (pastaExistente) {
            return pastaExistente.id;
          }
          
          // Create new pasta
          const { data: novaPasta, error: pastaError } = await supabase
            .from("pastas")
            .insert({
              nome: nomePasta,
              descricao: `Pasta criada automaticamente para padronização - ${processo.numero}`,
              cliente_id: selectedCliente || null,
              coordenacao_id: coordenacaoId || selectedCoordenacao || null,
              criado_por: user.id,
            })
            .select("id")
            .single();
          
          if (!pastaError && novaPasta) {
            return novaPasta.id;
          }
          console.warn(`Falha ao criar pasta ${nomePasta}:`, pastaError?.message);
          return null;
        };

        if (existingProcesso) {
          // Fetch current process data for smart merge
          const { data: currentProcesso } = await supabase
            .from("processos")
            .select("*")
            .eq("id", existingProcesso.id)
            .single();

          // Smart merge: update only empty fields, preserve responsáveis/coordenação
          const updateData: Record<string, any> = {};
          
          // Only update if currently empty AND user selected / spreadsheet has data
          if (selectedCoordenacao && !currentProcesso?.coordenacao_id) updateData.coordenacao_id = selectedCoordenacao;
          if (selectedCliente && !currentProcesso?.cliente_id) updateData.cliente_id = selectedCliente;
          
          // Find or create responsavel from spreadsheet if not already set
          if (!currentProcesso?.advogado_responsavel_id && processo.responsavel) {
            const responsavelId = await findOrCreateResponsavel(processo.responsavel);
            if (responsavelId) {
              updateData.advogado_responsavel_id = responsavelId;
            }
          } else if (selectedMembro && !currentProcesso?.advogado_responsavel_id) {
            updateData.advogado_responsavel_id = selectedMembro;
          }
          
          // Update pasta_id - always create pasta with "Parte Ativa x Parte Passiva" pattern
          const pastaId = await findOrCreatePasta(currentProcesso?.coordenacao_id);
          if (pastaId) {
            updateData.pasta_id = pastaId;
          }
          
          // Merge spreadsheet data into empty fields
          if (!currentProcesso?.assunto && processo.assunto) updateData.assunto = processo.assunto;
          if (!currentProcesso?.descricao && processo.descricao) updateData.descricao = processo.descricao;
          if (!currentProcesso?.tribunal && processo.orgao) updateData.tribunal = processo.orgao;
          if (!currentProcesso?.vara && processo.orgaoJulgador) updateData.vara = processo.orgaoJulgador;
          if (!currentProcesso?.comarca && processo.cidade) updateData.comarca = processo.cidade;
          if (!currentProcesso?.classe && processo.classeCNJ) updateData.classe = processo.classeCNJ;
          if (!currentProcesso?.data_distribuicao && parseDate(processo.dataDistribuicao)) updateData.data_distribuicao = parseDate(processo.dataDistribuicao);
          if (!currentProcesso?.valor_causa && parseNumber(processo.valorAcao)) updateData.valor_causa = parseNumber(processo.valorAcao);
          if (!currentProcesso?.polo_ativo && processo.parteAtiva) updateData.polo_ativo = processo.parteAtiva;
          if (!currentProcesso?.polo_passivo && processo.partePassiva) updateData.polo_passivo = processo.partePassiva;
          if (!currentProcesso?.justica && processo.justica) updateData.justica = processo.justica;
          if (!currentProcesso?.instancia && processo.instancia) updateData.instancia = processo.instancia;
          if (!currentProcesso?.fase && processo.fase) updateData.fase = processo.fase;
          if (!currentProcesso?.uf && processo.estado) updateData.uf = processo.estado;
          // Projuris-specific fields
          if (!currentProcesso?.identificador_projuris && processo.identificadorProjuris) updateData.identificador_projuris = processo.identificadorProjuris;
          if (!currentProcesso?.pasta_fisica && processo.pastaFisica) updateData.pasta_fisica = processo.pastaFisica;
          if (!currentProcesso?.pasta_cliente && processo.pastaCliente) updateData.pasta_cliente = processo.pastaCliente;
          if (!currentProcesso?.data_citacao && parseDate(processo.dataCitacao)) updateData.data_citacao = parseDate(processo.dataCitacao);
          if (!currentProcesso?.data_recebimento && parseDate(processo.dataRecebimento)) updateData.data_recebimento = parseDate(processo.dataRecebimento);
          if (!currentProcesso?.data_arquivamento && parseDate(processo.dataArquivamento)) updateData.data_arquivamento = parseDate(processo.dataArquivamento);
          if (!currentProcesso?.valor_provisionado && parseNumber(processo.valorProvisionado)) updateData.valor_provisionado = parseNumber(processo.valorProvisionado);
          if (!currentProcesso?.probabilidade && processo.probabilidade) updateData.probabilidade = processo.probabilidade;
          if (!currentProcesso?.risco && processo.risco) updateData.risco = processo.risco;
          if (!currentProcesso?.resultado && processo.resultado) updateData.resultado = processo.resultado;
          if (!currentProcesso?.valor_condenacao && parseNumber(processo.valorCondenacao)) updateData.valor_condenacao = parseNumber(processo.valorCondenacao);
          if (!currentProcesso?.responsaveis_projuris && processo.responsavel) updateData.responsaveis_projuris = processo.responsavel;
          // Update area only if current is default
          if (processo.area && currentProcesso?.area === "civil") {
            const newArea = mapAreaToEnum(processo.area);
            if (newArea !== "civil") updateData.area = newArea;
          }

          if (Object.keys(updateData).length > 0) {
            await supabase.from("processos").update(updateData).eq("id", existingProcesso.id);
          }

          processoId = existingProcesso.id;
          isUpdate = true;
        } else {
          // Create pasta for new process
          const pastaId = await findOrCreatePasta(selectedCoordenacao);
          
          // Find or create responsavel for new process
          let responsavelId = selectedMembro || null;
          if (processo.responsavel) {
            const foundResponsavel = await findOrCreateResponsavel(processo.responsavel);
            if (foundResponsavel) {
              responsavelId = foundResponsavel;
            }
          }

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
              advogado_responsavel_id: responsavelId,
              cliente_id: selectedCliente || null,
              pasta_id: pastaId,
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

        // Fetch additional data from API for new processes (somente se a opção estiver habilitada)
        if (!isUpdate && projurisBuscarAndamentos) {
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
        if (projurisBuscarAndamentos) {
          const andamentosRes = await buscarAndamentosExternos(processoId, processo.numero.trim());
          if (!andamentosRes.success) {
            console.warn(`Falha ao buscar andamentos do processo ${processo.numero}:`, andamentosRes.error);
          }
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
    osmarCancelledRef.current = false;
    startImport("Importando Dr. Osmar");
    setOsmarProgress(0);

    const updatedProcessos = [...osmarProcessos];
    let successCountLocal = 0;
    let updateCountLocal = 0;
    let errorCountLocal = 0;

    // Create a mutable copy of clientes to track newly created clients during import
    const clientesCache: { id: string; nome: string; tipo: string }[] = [...clientes];

    for (let i = 0; i < updatedProcessos.length; i++) {
      // Check for cancellation
      if (osmarCancelledRef.current) {
        toast({
          title: "Importação cancelada",
          description: `Cancelada após processar ${i} de ${updatedProcessos.length} registros.`,
        });
        setOsmarImporting(false);
        endImport();
        return;
      }

      const processo = updatedProcessos[i];
      
      if (processo.status === "invalido") {
        continue;
      }
      
      try {
        const osmarData = (processo as any).osmarData || {};
        
        // Check if process already exists by numero
        const { data: existingProcesso } = await supabase
          .from("processos")
          .select("id, coordenacao_id, advogado_responsavel_id, pasta_id")
          .eq("numero", processo.numero.trim())
          .maybeSingle();

        // Determine cliente_id using UNIDADE column
        let clienteIdToUse = selectedCliente || null;
        let clienteNomeFromSheet: string | null = null;
        
        if (osmarData.unidadeCliente) {
          clienteNomeFromSheet = osmarData.unidadeCliente.trim();
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
          cliente_id: clienteIdToUse,
          monitorar_andamentos: osmarBuscarAndamentos,
          // Dr. Osmar specific fields
          unidade_cliente: osmarData.unidadeCliente,
          sigla_unidade: osmarData.siglaUnidade,
          tipo_controladora: osmarData.tipoControladora,
          cpf_cnpj_parte_contraria: osmarData.cpfCnpjParteContraria,
          data_fato_gerador: parseDate(osmarData.dataFatoGerador),
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
          // Criar ou encontrar pasta com pattern "Parte Contrária x Unidade"
          let pastaId: string | null = existingProcesso.pasta_id;
          
          // Se não tem pasta vinculada, criar uma nova
          if (!pastaId) {
            const parteContraria = processo.partePassiva || osmarData.unidadeCliente || "Sem Parte";
            const unidadeNome = clienteNomeFromSheet || osmarData.unidadeCliente || "Sem Unidade";
            const nomePasta = `${parteContraria} x ${unidadeNome}`;
            
            const { data: { user } } = await supabase.auth.getUser();
            
            if (user) {
              // Verificar se já existe uma pasta com esse nome
              const { data: pastaExistente } = await supabase
                .from("pastas")
                .select("id")
                .eq("nome", nomePasta)
                .maybeSingle();
              
              if (pastaExistente) {
                pastaId = pastaExistente.id;
              } else {
                const { data: novaPasta, error: pastaError } = await supabase
                  .from("pastas")
                  .insert({
                    nome: nomePasta,
                    descricao: `Pasta criada automaticamente para o processo ${processo.numero}`,
                    cliente_id: clienteIdToUse,
                    coordenacao_id: selectedCoordenacao || existingProcesso.coordenacao_id || null,
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
            }
          }

          // Não sobrescrever coordenacao_id e advogado_responsavel_id se já existem no processo
          // Apenas atualiza se o usuário selecionou explicitamente valores
          const updateData: Record<string, any> = { ...processoData, pasta_id: pastaId };
          
          // Se o processo já tem coordenação/responsável e o usuário não selecionou nada, preservar
          if ((existingProcesso as any).coordenacao_id && !selectedCoordenacao) {
            delete updateData.coordenacao_id;
          }
          if ((existingProcesso as any).advogado_responsavel_id && !selectedMembro) {
            delete updateData.advogado_responsavel_id;
          }

          const { error } = await supabase
            .from("processos")
            .update(updateData)
            .eq("id", existingProcesso.id);

          if (error) {
            updatedProcessos[i] = { ...processo, status: "erro", erroImport: translateDatabaseError(error.message) };
            errorCountLocal++;
            continue;
          }
          isUpdate = true;
          updateCountLocal++;
        } else {
          // Create pasta with pattern "Parte Contrária x Unidade"
          let pastaId: string | null = null;
          const parteContraria = processo.partePassiva || osmarData.unidadeCliente || "Sem Parte";
          const unidadeNome = clienteNomeFromSheet || osmarData.unidadeCliente || "Sem Unidade";
          const nomePasta = `${parteContraria} x ${unidadeNome}`;
          
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

          // Insert new process with pasta_id
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

          // Buscar e inserir andamentos (somente se a opção estiver habilitada e for processo novo)
          if (osmarBuscarAndamentos && insertedProcesso) {
            const andamentosRes = await buscarAndamentosExternos(insertedProcesso.id, processo.numero.trim());
            if (!andamentosRes.success) {
              console.warn(`Falha ao buscar andamentos do processo ${processo.numero}:`, andamentosRes.error);
            }
          }
          successCountLocal++;
        }
        
        updatedProcessos[i] = { 
          ...processo, 
          status: "sucesso", 
          erroImport: isUpdate ? "Atualizado (já existia)" : undefined 
        };
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
      description: `${successCountLocal} novo(s), ${updateCountLocal} atualizado(s), ${errorCountLocal} erro(s).`,
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
    janainaCancelledRef.current = false;
    startImport("Importando ACH Contingencial");
    setJanainaProgress(0);

    const updatedProcessos = [...janainaProcessos];
    let successCountLocal = 0;
    let updateCountLocal = 0;
    let errorCountLocal = 0;
    let rejectedCountLocal = 0;
    
    // Create a mutable copy of clientes to track newly created clients during import
    const clientesCache: { id: string; nome: string; tipo: string }[] = [...clientes];

    for (let i = 0; i < updatedProcessos.length; i++) {
      // Check for cancellation
      if (janainaCancelledRef.current) {
        toast({
          title: "Importação cancelada",
          description: `Cancelada após processar ${i} de ${updatedProcessos.length} registros.`,
        });
        setJanainaImporting(false);
        endImport();
        return;
      }

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
          // Não sobrescrever coordenacao_id e advogado_responsavel_id se já existem no processo
          // Apenas atualiza se o usuário selecionou explicitamente valores
          const updateData = { ...processoData };
          
          // Buscar os dados atuais do processo para preservar distribuições existentes
          const { data: currentProcesso } = await supabase
            .from("processos")
            .select("coordenacao_id, advogado_responsavel_id")
            .eq("id", existingProcesso.id)
            .single();
          
          // Se o processo já tem coordenação/responsável e o usuário não selecionou nada, preservar
          if (currentProcesso) {
            if (currentProcesso.coordenacao_id && !selectedCoordenacao) {
              delete updateData.coordenacao_id;
            }
            if (currentProcesso.advogado_responsavel_id && !selectedMembro) {
              delete updateData.advogado_responsavel_id;
            }
          }

          const { error } = await supabase
            .from("processos")
            .update(updateData)
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
        if (isUpdate) {
          updateCountLocal++;
        } else {
          successCountLocal++;
        }
      } catch (err: any) {
        updatedProcessos[i] = { ...processo, status: "erro", erroImport: err.message };
        errorCountLocal++;
      }

      setJanainaProgress(((i + 1) / updatedProcessos.length) * 100);
      setJanainaProcessos([...updatedProcessos]);
    }

    setJanainaImporting(false);
    endImport();

    const totalProcessed = successCountLocal + updateCountLocal + errorCountLocal + rejectedCountLocal;
    const newRecords = successCountLocal;
    const updatedRecords = updateCountLocal;
    
    toast({
      title: "Importação Dra. Janaina concluída",
      description: `${newRecords} novo(s), ${updatedRecords} atualizado(s), ${rejectedCountLocal} rejeitado(s), ${errorCountLocal} erro(s). Total: ${totalProcessed}/${updatedProcessos.length}`,
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

  // Dra. Polyana file handling
  const POLYANA_COORDENACAO_ID = "f73e8ee7-924c-4518-bbdc-62dd77df93a1";
  const POLYANA_ADVOGADA_ID = "c3bb1df8-ea39-4cc9-9496-39d68df3f1f4";

  const handlePolyanaFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setPolyanaFile(selectedFile);
      parsePolyanaExcel(selectedFile);
    }
  }, []);

  const parsePolyanaExcel = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      const range = sheet["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]) : null;
      const expectedRows = range ? Math.max(0, range.e.r - range.s.r) : 0;

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

        const numeroProcesso = getFromRow(row, [
          "Numero do processo",
          "Número do processo",
          "Numero do Processo",
          "Número do Processo",
          "Processo",
          "Nº Processo",
        ]) || "";

        const processo: ProcessoImport = {
          numero: String(numeroProcesso ?? "").trim(),
          assunto: row["DESCRIÇÃO DO OBJETO"] || row["Descrição do Objeto"] || row["DESCRICAO DO OBJETO"] || null,
          situacao: row["Fase do Processo"] || null,
          responsavel: null,
          descricao: row["DESCRIÇÃO DO OBJETO"] || row["Descrição do Objeto"] || null,
          justica: null,
          cidade: null,
          estado: null,
          instancia: null,
          orgao: null,
          orgaoJulgador: null,
          sistema: null,
          area: "trabalhista",
          fase: row["Fase do Processo"] || null,
          dataDistribuicao: null,
          classeCNJ: null,
          valorAcao: row["VALOR DA CAUSA"] || row["Valor da Causa"] || null,
          parteAtiva: row["HOSPITAL"] || row["Hospital"] || null,
          partePassiva: row["Parte Contrária"] || row["Parte Contraria"] || row["PARTE CONTRÁRIA"] || null,
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
          valorCondenacao: null,
        };

        // Store Polyana-specific data
        (processo as any).polyanaData = {
          hospital: row["HOSPITAL"] || row["Hospital"] || null,
          parteContraria: row["Parte Contrária"] || row["Parte Contraria"] || null,
          faseProcesso: row["Fase do Processo"] || null,
          descricaoObjeto: row["DESCRIÇÃO DO OBJETO"] || row["Descrição do Objeto"] || null,
          andamentoAtualizado: row["ANDAMENTO ATUALIZADO"] || row["Andamento Atualizado"] || null,
          valorCausa: row["VALOR DA CAUSA"] || row["Valor da Causa"] || null,
        };

        // Validação
        processo.erros = validateProcesso(processo);

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

      setPolyanaProcessos(parsed);

      const validCount = parsed.filter((p) => p.status === "valido").length;
      const invalidCount = parsed.filter((p) => p.status === "invalido").length;

      if (parsed.length === 0) {
        toast({
          title: "Nenhum processo encontrado",
          description: "A planilha não contém dados.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Planilha carregada",
          description: `${parsed.length} linha(s) lida(s): ${validCount} importável(is), ${invalidCount} rejeitada(s).`,
          variant: invalidCount > 0 ? "destructive" : "default",
        });
      }
    } catch (error) {
      console.error("Erro ao ler planilha Dra. Polyana:", error);
      toast({
        title: "Erro ao ler planilha",
        description: "Verifique se o arquivo está no formato correto (.xlsx ou .xls).",
        variant: "destructive",
      });
    }
  };

  const handlePolyanaImport = async () => {
    const validProcessos = polyanaProcessos.filter(p => p.status === "valido");
    const invalidProcessos = polyanaProcessos.filter(p => p.status === "invalido");
    
    if (validProcessos.length === 0 && invalidProcessos.length === 0) {
      toast({
        title: "Nenhum processo para processar",
        description: "A planilha não contém dados válidos.",
        variant: "destructive",
      });
      return;
    }

    setPolyanaImporting(true);
    polyanaCancelledRef.current = false;
    startImport("Importando Dra. Polyana");
    setPolyanaProgress(0);

    const updatedProcessos = [...polyanaProcessos];
    let successCountLocal = 0;
    let updateCountLocal = 0;
    let errorCountLocal = 0;
    let rejectedCountLocal = 0;
    
    // Cache de clientes criados
    const clientesCache: { id: string; nome: string; tipo: string }[] = [...clientes];

    for (let i = 0; i < updatedProcessos.length; i++) {
      // Check for cancellation
      if (polyanaCancelledRef.current) {
        toast({
          title: "Importação cancelada",
          description: `Cancelada após processar ${i} de ${updatedProcessos.length} registros.`,
        });
        setPolyanaImporting(false);
        endImport();
        return;
      }

      const processo = updatedProcessos[i];
      
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
        setPolyanaProgress(((i + 1) / updatedProcessos.length) * 100);
        setPolyanaProcessos([...updatedProcessos]);
        continue;
      }

      try {
        const polyanaData = (processo as any).polyanaData || {};

        // Verificar se processo já existe
        const { data: existingProcesso } = await supabase
          .from("processos")
          .select("id")
          .eq("numero", processo.numero.trim())
          .maybeSingle();

        const areaSlug = await ensureAreaExists("trabalhista");

        // Determinar cliente - criar automaticamente pelo HOSPITAL
        let clienteIdToUse: string | null = null;
        const hospitalNome = polyanaData.hospital?.trim();
        
        if (hospitalNome) {
          const existingCliente = clientesCache.find(c => 
            c.nome.toLowerCase().trim() === hospitalNome.toLowerCase()
          );
          
          if (existingCliente) {
            clienteIdToUse = existingCliente.id;
          } else {
            const { data: novoCliente, error: clienteError } = await supabase
              .from("clientes")
              .insert({
                nome: hospitalNome,
                tipo: "pessoa_juridica",
              })
              .select("id, nome")
              .single();
            
            if (!clienteError && novoCliente) {
              clienteIdToUse = novoCliente.id;
              clientesCache.push({ id: novoCliente.id, nome: novoCliente.nome, tipo: "pessoa_juridica" });
            } else {
              console.warn(`Falha ao criar cliente ${hospitalNome}:`, clienteError?.message);
            }
          }
        }

        const processoData: any = {
          numero: processo.numero.trim(),
          area: areaSlug,
          status: mapStatusToEnum(processo.situacao),
          situacao_original: getSituacaoOriginal(processo.situacao),
          assunto: polyanaData.descricaoObjeto,
          pedidos: polyanaData.descricaoObjeto,
          fase: polyanaData.faseProcesso,
          valor_causa: parseNumber(polyanaData.valorCausa),
          polo_ativo: polyanaData.hospital,
          polo_passivo: polyanaData.parteContraria,
          andamento_atual: polyanaData.andamentoAtualizado,
          // SEMPRE atribuir à coordenação da Dra. Janaina e à Dra. Polyana
          coordenacao_id: POLYANA_COORDENACAO_ID,
          advogado_responsavel_id: POLYANA_ADVOGADA_ID,
          cliente_id: clienteIdToUse,
          monitorar_andamentos: polyanaBuscarAndamentos,
        };

        let isUpdate = false;

        if (existingProcesso) {
          // Update existente e redistribuir para Polyana
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
          // Criar pasta automaticamente
          let pastaId: string | null = null;
          const parteContraria = polyanaData.parteContraria || "Sem Parte Contrária";
          const clienteNome = hospitalNome || "Sem Cliente";
          const nomePasta = `${parteContraria} x ${clienteNome}`;
          
          const { data: { user } } = await supabase.auth.getUser();
          
          if (user) {
            const { data: novaPasta, error: pastaError } = await supabase
              .from("pastas")
              .insert({
                nome: nomePasta,
                descricao: `Pasta criada automaticamente para o processo ${processo.numero}`,
                cliente_id: clienteIdToUse,
                coordenacao_id: POLYANA_COORDENACAO_ID,
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

          if (polyanaBuscarAndamentos && insertedProcesso) {
            const andamentosRes = await buscarAndamentosExternos(insertedProcesso.id, processo.numero.trim());
            if (!andamentosRes.success) {
              console.warn(`Falha ao buscar andamentos do processo ${processo.numero}:`, andamentosRes.error);
            }
          }
        }
        
        updatedProcessos[i] = { 
          ...processo, 
          status: "sucesso", 
          erroImport: isUpdate ? "Atualizado e redistribuído para Dra. Polyana" : undefined 
        };
        if (isUpdate) {
          updateCountLocal++;
        } else {
          successCountLocal++;
        }
      } catch (err: any) {
        updatedProcessos[i] = { ...processo, status: "erro", erroImport: err.message };
        errorCountLocal++;
      }

      setPolyanaProgress(((i + 1) / updatedProcessos.length) * 100);
      setPolyanaProcessos([...updatedProcessos]);
    }

    setPolyanaImporting(false);
    endImport();

    const totalProcessed = successCountLocal + updateCountLocal + errorCountLocal + rejectedCountLocal;
    
    toast({
      title: "Importação Dra. Polyana concluída",
      description: `${successCountLocal} novo(s), ${updateCountLocal} atualizado(s) e redistribuído(s), ${rejectedCountLocal} rejeitado(s), ${errorCountLocal} erro(s). Total: ${totalProcessed}/${updatedProcessos.length}`,
      variant: errorCountLocal > 0 || rejectedCountLocal > 0 ? "destructive" : "default",
    });

    if (rejectedCountLocal > 0 || errorCountLocal > 0) {
      setTimeout(() => downloadPolyanaRejeitados(updatedProcessos), 0);
    }
  };

  const downloadPolyanaRejeitados = (processosToExport: ProcessoImport[] = polyanaProcessos) => {
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
      Hospital: p.parteAtiva,
      "Parte Contrária": p.partePassiva,
      Fase: (p as any).polyanaData?.faseProcesso || p.fase,
      Tipo: "REJEITADO",
      Motivo:
        p.erros.map((e) => `${e.campo}: ${e.mensagem}`).join("; ") ||
        p.erroImport ||
        "Erro crítico",
    }));

    const avisosData = comAvisos.map((p) => ({
      Linha: p.linhaOriginal,
      "Número do processo": p.numero,
      Hospital: p.parteAtiva,
      "Parte Contrária": p.partePassiva,
      Fase: (p as any).polyanaData?.faseProcesso || p.fase,
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

    XLSX.writeFile(wb, `polyana_problemas_${new Date().toISOString().split("T")[0]}.xlsx`);

    toast({
      title: "Arquivo gerado",
      description: `${rejeitados.length} rejeitado(s), ${comAvisos.length} com avisos.`,
    });
  };

  const clearPolyana = () => {
    setPolyanaFile(null);
    setPolyanaProcessos([]);
    setPolyanaProgress(0);
  };

  // Polyana counts
  const polyanaValidCount = polyanaProcessos.filter(p => p.status === "valido").length;
  const polyanaInvalidCount = polyanaProcessos.filter(p => p.status === "invalido").length;
  const polyanaWarningCount = polyanaProcessos.filter(p => (p.status === "valido" || p.status === "sucesso") && p.erros.length > 0).length;
  const polyanaSuccessCount = polyanaProcessos.filter(p => p.status === "sucesso").length;
  const polyanaErrorCount = polyanaProcessos.filter(p => p.status === "erro").length;
  const polyanaTotalProblemas = polyanaInvalidCount + polyanaErrorCount + polyanaWarningCount;

  // Ministério Público file handling
  const handleMptFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setMptFile(selectedFile);
      parseMptExcel(selectedFile);
    }
  }, []);

  const parseMptExcel = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      const range = sheet["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]) : null;
      const expectedRows = range ? Math.max(0, range.e.r - range.s.r) : 0;

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

        // PROCEDIMENTO vai para o campo "numero" (processo)
        const procedimento = getFromRow(row, [
          "PROCEDIMENTO",
          "Procedimento",
          "procedimento",
        ]) || "";

        const processo: ProcessoImport = {
          numero: String(procedimento ?? "").trim(),
          assunto: row["MATÉRIA"] || row["Matéria"] || row["MATERIA"] || null,
          situacao: row["STATUS"] || row["Status"] || null,
          responsavel: null,
          descricao: row["Observação Advogado Responsável"] || row["OBSERVAÇÃO ADVOGADO RESPONSÁVEL"] || null,
          justica: null,
          cidade: row["LOCALIDADE"] || row["Localidade"] || null,
          estado: row["UF"] || row["Uf"] || null,
          instancia: null,
          orgao: null,
          orgaoJulgador: null,
          sistema: null,
          area: "trabalhista",
          fase: null,
          dataDistribuicao: null,
          classeCNJ: null,
          valorAcao: null,
          parteAtiva: row["AUTOR"] || row["Autor"] || null,
          partePassiva: row["REQUERIDO"] || row["Requerido"] || null,
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
          valorCondenacao: null,
        };

        // Store MPT-specific data
        (processo as any).mptData = {
          procedimento: procedimento,
          localidade: row["LOCALIDADE"] || row["Localidade"] || null,
          uf: row["UF"] || row["Uf"] || null,
          autor: row["AUTOR"] || row["Autor"] || null,
          requerido: row["REQUERIDO"] || row["Requerido"] || null,
          materia: row["MATÉRIA"] || row["Matéria"] || row["MATERIA"] || null,
          ultimoAndamento: row["ÚLTIMO ANDAMENTO"] || row["Último Andamento"] || row["ULTIMO ANDAMENTO"] || null,
          status: row["STATUS"] || row["Status"] || null,
          observacaoAdvogado: row["Observação Advogado Responsável"] || row["OBSERVAÇÃO ADVOGADO RESPONSÁVEL"] || null,
        };

        // Validação
        processo.erros = validateProcesso(processo);

        const numeroTrimmed = (processo.numero || "").trim();
        const isEmptyRow = !rowHasAnyValue;
        const hasInvalidNumero = !numeroTrimmed || numeroTrimmed.length < 5;

        if (isEmptyRow || hasInvalidNumero) {
          const motivo = isEmptyRow
            ? "Linha vazia na planilha"
            : !numeroTrimmed
              ? "Procedimento vazio ou não encontrado na planilha"
              : `Procedimento muito curto (${numeroTrimmed.length} caracteres, mínimo 5)`;

          processo.status = "invalido";
          processo.erroImport = motivo;
          processo.erros = [{ campo: "numero", mensagem: motivo }];
        } else {
          processo.status = "valido";
        }

        return processo;
      });

      setMptProcessos(parsed);

      const validCount = parsed.filter((p) => p.status === "valido").length;
      const invalidCount = parsed.filter((p) => p.status === "invalido").length;

      if (parsed.length === 0) {
        toast({
          title: "Nenhum processo encontrado",
          description: "A planilha não contém dados.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Planilha carregada",
          description: `${parsed.length} linha(s) lida(s): ${validCount} importável(is), ${invalidCount} rejeitada(s).`,
          variant: invalidCount > 0 ? "destructive" : "default",
        });
      }
    } catch (error) {
      console.error("Erro ao ler planilha MPT:", error);
      toast({
        title: "Erro ao ler planilha",
        description: "Verifique se o arquivo está no formato correto (.xlsx ou .xls).",
        variant: "destructive",
      });
    }
  };

  const handleMptImport = async () => {
    const validProcessos = mptProcessos.filter(p => p.status === "valido");
    const invalidProcessos = mptProcessos.filter(p => p.status === "invalido");
    
    if (validProcessos.length === 0 && invalidProcessos.length === 0) {
      toast({
        title: "Nenhum processo para processar",
        description: "A planilha não contém dados válidos.",
        variant: "destructive",
      });
      return;
    }

    setMptImporting(true);
    mptCancelledRef.current = false;
    startImport("Importando Ministério Público");
    setMptProgress(0);

    const updatedProcessos = [...mptProcessos];
    let successCountLocal = 0;
    let updateCountLocal = 0;
    let errorCountLocal = 0;
    let rejectedCountLocal = 0;

    for (let i = 0; i < updatedProcessos.length; i++) {
      // Check for cancellation
      if (mptCancelledRef.current) {
        toast({
          title: "Importação cancelada",
          description: `Cancelada após processar ${i} de ${updatedProcessos.length} registros.`,
        });
        setMptImporting(false);
        endImport();
        return;
      }

      const processo = updatedProcessos[i];
      
      if (processo.status === "invalido") {
        const motivo = !processo.numero || processo.numero.trim() === ""
          ? "Procedimento vazio ou não encontrado na planilha"
          : processo.numero.trim().length < 5 
            ? `Procedimento muito curto (${processo.numero.trim().length} caracteres, mínimo 5)`
            : "Dados insuficientes para importação";
        
        updatedProcessos[i] = { 
          ...processo, 
          status: "invalido", 
          erroImport: motivo,
          erros: processo.erros.length > 0 ? processo.erros : [{ campo: "numero", mensagem: motivo }]
        };
        rejectedCountLocal++;
        setMptProgress(((i + 1) / updatedProcessos.length) * 100);
        setMptProcessos([...updatedProcessos]);
        continue;
      }

      try {
        const mptData = (processo as any).mptData || {};

        // Verificar se processo já existe
        const { data: existingProcesso } = await supabase
          .from("processos")
          .select("id")
          .eq("numero", processo.numero.trim())
          .maybeSingle();

        const areaSlug = await ensureAreaExists("trabalhista");

        const processoData: any = {
          numero: processo.numero.trim(),
          area: areaSlug,
          status: mapStatusToEnum(mptData.status),
          situacao_original: getSituacaoOriginal(mptData.status),
          assunto: mptData.materia,
          polo_ativo: mptData.autor,
          polo_passivo: mptData.requerido,
          uf: mptData.uf,
          // Novos campos específicos do MPT
          localidade: mptData.localidade,
          autor: mptData.autor,
          requerido: mptData.requerido,
          materia_mpt: mptData.materia || "Ministério Público",
          ultimo_andamento_mpt: mptData.ultimoAndamento,
          observacao_advogado: mptData.observacaoAdvogado,
          monitorar_andamentos: mptBuscarAndamentos,
          // Coordenação e advogado podem ser selecionados
          coordenacao_id: selectedCoordenacao || null,
          advogado_responsavel_id: selectedMembro || null,
          cliente_id: selectedCliente || null,
        };

        let isUpdate = false;

        if (existingProcesso) {
          // Update existente
          const { error } = await supabase
            .from("processos")
            .update(processoData)
            .eq("id", existingProcesso.id);

          if (error) {
            updatedProcessos[i] = { ...processo, status: "erro", erroImport: translateDatabaseError(error.message) };
            errorCountLocal++;
            continue;
          }
          isUpdate = true;
        } else {
          // Insert novo
          const { data: insertedProcesso, error } = await supabase
            .from("processos")
            .insert(processoData as any)
            .select("id")
            .single();

          if (error) {
            updatedProcessos[i] = { ...processo, status: "erro", erroImport: translateDatabaseError(error.message) };
            errorCountLocal++;
            continue;
          }

          if (mptBuscarAndamentos && insertedProcesso) {
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
        if (isUpdate) {
          updateCountLocal++;
        } else {
          successCountLocal++;
        }
      } catch (err: any) {
        updatedProcessos[i] = { ...processo, status: "erro", erroImport: err.message };
        errorCountLocal++;
      }

      setMptProgress(((i + 1) / updatedProcessos.length) * 100);
      setMptProcessos([...updatedProcessos]);
    }

    setMptImporting(false);
    endImport();

    const totalProcessed = successCountLocal + updateCountLocal + errorCountLocal + rejectedCountLocal;
    const newRecords = successCountLocal;
    const updatedRecords = updateCountLocal;
    
    toast({
      title: "Importação MPT concluída",
      description: `${newRecords} novo(s), ${updatedRecords} atualizado(s), ${rejectedCountLocal} rejeitado(s), ${errorCountLocal} erro(s). Total: ${totalProcessed}/${updatedProcessos.length}`,
      variant: errorCountLocal > 0 || rejectedCountLocal > 0 ? "destructive" : "default",
    });

    if (rejectedCountLocal > 0 || errorCountLocal > 0) {
      setTimeout(() => downloadMptRejeitados(updatedProcessos), 0);
    }
  };

  const downloadMptRejeitados = (processosToExport: ProcessoImport[] = mptProcessos) => {
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
      "Procedimento": p.numero || "(vazio)",
      Autor: p.parteAtiva,
      Requerido: p.partePassiva,
      UF: p.estado,
      Status: p.situacao,
      Tipo: "REJEITADO",
      Motivo:
        p.erros.map((e) => `${e.campo}: ${e.mensagem}`).join("; ") ||
        p.erroImport ||
        "Erro crítico",
    }));

    const avisosData = comAvisos.map((p) => ({
      Linha: p.linhaOriginal,
      "Procedimento": p.numero,
      Autor: p.parteAtiva,
      Requerido: p.partePassiva,
      UF: p.estado,
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

    XLSX.writeFile(wb, `mpt_problemas_${new Date().toISOString().split("T")[0]}.xlsx`);

    toast({
      title: "Arquivo gerado",
      description: `${rejeitados.length} rejeitado(s), ${comAvisos.length} com avisos.`,
    });
  };

  const clearMpt = () => {
    setMptFile(null);
    setMptProcessos([]);
    setMptProgress(0);
  };

  // MPT counts
  const mptValidCount = mptProcessos.filter(p => p.status === "valido").length;
  const mptInvalidCount = mptProcessos.filter(p => p.status === "invalido").length;
  const mptWarningCount = mptProcessos.filter(p => (p.status === "valido" || p.status === "sucesso") && p.erros.length > 0).length;
  const mptSuccessCount = mptProcessos.filter(p => p.status === "sucesso").length;
  const mptErrorCount = mptProcessos.filter(p => p.status === "erro").length;
  const mptTotalProblemas = mptInvalidCount + mptErrorCount + mptWarningCount;

  // Pedidos file handling
  const handlePedidosFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setPedidosFile(selectedFile);
      parsePedidosExcel(selectedFile);
    }
  }, []);

  const parsePedidosExcel = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      const range = sheet["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]) : null;
      const expectedRows = range ? Math.max(0, range.e.r - range.s.r) : 0;

      const aoa = XLSX.utils.sheet_to_json<any[]>(sheet, {
        header: 1,
        defval: null,
        blankrows: true,
      }) as any[][];

      // A planilha tem 2 linhas de cabeçalho agrupado
      // A linha 2 (index 1) contém os cabeçalhos detalhados das colunas
      const headerRow = (aoa[1] || aoa[0] || []).map((h) => String(h ?? "").trim());

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

      // Dados começam após o cabeçalho na linha 3 (index 2)
      const dataStartIndex = 2;
      const totalDataRows = expectedRows ? Math.max(0, aoa.length - dataStartIndex) : Math.max(0, aoa.length - dataStartIndex);

      const parsed: ProcessoImport[] = [];

      for (let index = 0; index < totalDataRows; index++) {
        const rowArr = aoa[dataStartIndex + index] || [];

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

        const numeroProcesso = getFromRow(row, [
          "NÚMERO",
          "Número",
          "Numero",
          "PROCESSO",
          "Processo",
          "processo",
        ]) || "";

        const processo: ProcessoImport = {
          numero: String(numeroProcesso ?? "").trim(),
          assunto: null,
          situacao: getFromRow(row, ["STATUS", "Status", "status"]) || null,
          responsavel: null,
          descricao: getFromRow(row, ["OBSERVAÇÃO ADVOGADO", "Observação Advogado", "observacao advogado"]) || null,
          justica: null,
          cidade: getFromRow(row, ["COMARCA", "Comarca", "comarca"]) || null,
          estado: null,
          instancia: null,
          orgao: null,
          orgaoJulgador: getFromRow(row, ["VARA", "Vara", "vara"]) || null,
          sistema: null,
          area: "trabalhista",
          fase: null,
          dataDistribuicao: null,
          classeCNJ: null,
          valorAcao: null,
          parteAtiva: getFromRow(row, ["RECLAMANTE", "Reclamante", "reclamante"]) || null,
          partePassiva: getFromRow(row, ["RECLAMADO", "Reclamado", "reclamado"]) || null,
          cpfCnpjAtivo: null,
          cpfCnpjPassivo: null,
          status: "pendente",
          erros: [],
          linhaOriginal: dataStartIndex + index + 2,
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

        // Store Pedidos-specific data - mapeando para os nomes reais da planilha
        (processo as any).pedidosData = {
          reclamante: getFromRow(row, ["RECLAMANTE", "Reclamante"]) || null,
          funcao: getFromRow(row, ["FUNÇÃO", "Funcao", "Função"]) || null,
          setor: getFromRow(row, ["SETOR", "Setor"]) || null,
          reclamado: getFromRow(row, ["RECLAMADO", "Reclamado"]) || null,
          vara: getFromRow(row, ["VARA", "Vara"]) || null,
          comarca: getFromRow(row, ["COMARCA", "Comarca"]) || null,
          // Contrato Trabalho
          periodo_contratacao: getFromRow(row, ["PERÍODO CONTRATAÇÃO", "Período Contratação"]) || null,
          tipo_contrato: getFromRow(row, ["TIPO CONTRATO TRABALHO", "Tipo Contrato Trabalho"]) || null,
          // Responsabilidade Subsidiária
          responsabilidade_subsidiaria: getFromRow(row, ["POSSUI (SIM/NÃO)", "Possui (Sim/Não)"]) || null,
          observacao_resp_subsidiaria: getFromRow(row, ["OBSERVAÇÃO RESPONSABILIDADE SUBSIDIÁRIA", "Observação Responsabilidade Subsidiária"]) || null,
          // Horas Extras
          excesso_jornada: getFromRow(row, ["EXCESSO JORNADA", "Excesso Jornada"]) || null,
          plantoes_extras: getFromRow(row, ["PLANTÕES EXTRAS", "Plantões Extras"]) || null,
          dobras: getFromRow(row, ["DOBRAS", "Dobras"]) || null,
          intervalo_intrajornada: getFromRow(row, ["INTERVALO INTRAJORNADA", "Intervalo Intrajornada"]) || null,
          intervalo_interjornada: getFromRow(row, ["INTERVALO INTERJORNADA", "Intervalo Interjornada"]) || null,
          descaract_jornada_12_36: getFromRow(row, ["DESCARACTERIZAÇÃO JORNADA 12/36", "Descaracterização Jornada 12/36"]) || null,
          domingos_feriados: getFromRow(row, ["Domingos/Feriados", "DOMINGOS/FERIADOS"]) || null,
          // Insalubridade/Periculosidade
          insalubridade_periculosidade: getFromRow(row, ["PEDIDO (OBSERVAÇÃO)", "Pedido (Observação)"]) || null,
          diferencas_salariais: getFromRow(row, ["DIFERENÇAS SALARIAIS", "Diferenças Salariais"]) || null,
          adicional_noturno: getFromRow(row, ["ADICIONAL NOTURNO", "Adicional Noturno"]) || null,
          sobrecarga_trabalho: getFromRow(row, ["SOBRECARGA DE TRABALHO", "Sobrecarga de Trabalho"]) || null,
          // Reconhecimento de Vínculo
          reconhecimento_vinculo: getFromRow(row, ["RECONHECIMENTO DE VÍNCULO", "Reconhecimento de Vínculo"]) || null,
          cargo_reconhecimento_vinculo: getFromRow(row, ["CARGO RECONHECIMENTO VÍNCULO", "Cargo Reconhecimento Vínculo"]) || null,
          // Danos Morais
          danos_morais_assedio: getFromRow(row, ["ASSÉDIO", "Assédio"]) || null,
          danos_morais_outros: getFromRow(row, ["OUTROS", "Outros"]) || null,
          // Acidente/Doença
          acidente_doenca: getFromRow(row, ["ACIDENTE/DOENÇA", "Acidente/Doença"]) || null,
          danos_materiais: getFromRow(row, ["DANOS MATERIAIS", "Danos Materiais"]) || null,
          pensao_vitalicia: getFromRow(row, ["PENSÃO VITALÍCIA", "Pensão Vitalícia"]) || null,
          danos_morais_acidente: getFromRow(row, ["DANOS MORAIS", "Danos Morais"]) || null,
          limbo_previdenciario: getFromRow(row, ["LIMBO PREVIDENCIÁRIO", "Limbo Previdenciário"]) || null,
          // Estabilidade
          tipo_estabilidade: getFromRow(row, ["TIPO", "Tipo"]) || null,
          possui_estabilidade: getFromRow(row, ["POSSUI", "Possui"]) || null,
          // Indenização
          indenizacao_substitutiva: getFromRow(row, ["INDENIZAÇÃO SUBSTITUTIVA", "Indenização Substitutiva"]) || null,
          reversao_justa_causa: getFromRow(row, ["REVERSÃO JUSTA CAUSA", "Reversão Justa Causa"]) || null,
          rescisao_indireta: getFromRow(row, ["RESCISÃO INDIRETA", "Rescisão Indireta"]) || null,
          reversao_pedido_demissao: getFromRow(row, ["REVERSÃO PEDIDO DEMISSÃO", "Reversão Pedido Demissão"]) || null,
          // Multas
          multas_clt: getFromRow(row, ["Multas CLT", "MULTAS CLT"]) || null,
          // Situação
          situacao: getFromRow(row, ["SITUAÇÃO", "Situação"]) || null,
          data_situacao: getFromRow(row, ["DATA SITUAÇÃO", "Data Situação"]) || null,
          // Encerramento - colunas repetidas na planilha
          tipo_encerramento: (() => {
            // Pegar a coluna TIPO que está no grupo ENCERRAMENTO (última ocorrência)
            const headers = headerRow;
            const tipoIndices = headers.map((h, i) => h.toUpperCase() === "TIPO" ? i : -1).filter(i => i !== -1);
            const lastTipoIndex = tipoIndices[tipoIndices.length - 1];
            return lastTipoIndex !== undefined ? rowArr[lastTipoIndex] : null;
          })(),
          custo_encerramento: getFromRow(row, ["CUSTO", "Custo"]) || null,
        };

        // Validação
        processo.erros = validateProcesso(processo);

        const numeroTrimmed = (processo.numero || "").trim();
        const isEmptyRow = !rowHasAnyValue;
        const hasInvalidNumero = !numeroTrimmed || numeroTrimmed.length < 5;

        if (isEmptyRow || hasInvalidNumero) {
          const motivo = isEmptyRow
            ? "Linha vazia na planilha"
            : !numeroTrimmed
              ? "Processo vazio ou não encontrado na planilha"
              : `Processo muito curto (${numeroTrimmed.length} caracteres, mínimo 5)`;

          processo.status = "invalido";
          processo.erroImport = motivo;
          processo.erros = [{ campo: "numero", mensagem: motivo }];
        } else {
          processo.status = "valido";
        }

        parsed.push(processo);
      }

      setPedidosProcessos(parsed);

      const validCount = parsed.filter((p) => p.status === "valido").length;
      const invalidCount = parsed.filter((p) => p.status === "invalido").length;

      if (parsed.length === 0) {
        toast({
          title: "Nenhum processo encontrado",
          description: "A planilha não contém dados.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Planilha carregada",
          description: `${parsed.length} linha(s) lida(s): ${validCount} importável(is), ${invalidCount} rejeitada(s).`,
          variant: invalidCount > 0 ? "destructive" : "default",
        });
      }
    } catch (error) {
      console.error("Erro ao ler planilha Pedidos:", error);
      toast({
        title: "Erro ao ler planilha",
        description: "Verifique se o arquivo está no formato correto (.xlsx ou .xls).",
        variant: "destructive",
      });
    }
  };

  const handlePedidosImport = async () => {
    const validProcessos = pedidosProcessos.filter(p => p.status === "valido");
    const invalidProcessos = pedidosProcessos.filter(p => p.status === "invalido");
    
    if (validProcessos.length === 0 && invalidProcessos.length === 0) {
      toast({
        title: "Nenhum processo para processar",
        description: "A planilha não contém dados válidos.",
        variant: "destructive",
      });
      return;
    }

    setPedidosImporting(true);
    pedidosCancelledRef.current = false;
    startImport("Importando Pedidos");
    setPedidosProgress(0);

    const updatedProcessos = [...pedidosProcessos];
    let successCountLocal = 0;
    let updateCountLocal = 0;
    let errorCountLocal = 0;
    let rejectedCountLocal = 0;
    
    // Cache de clientes criados
    const clientesCache: { id: string; nome: string; tipo: string }[] = [...clientes];

    for (let i = 0; i < updatedProcessos.length; i++) {
      // Check for cancellation
      if (pedidosCancelledRef.current) {
        toast({
          title: "Importação cancelada",
          description: `Cancelada após processar ${i} de ${updatedProcessos.length} registros.`,
        });
        setPedidosImporting(false);
        endImport();
        return;
      }

      const processo = updatedProcessos[i];
      
      if (processo.status === "invalido") {
        const motivo = !processo.numero || processo.numero.trim() === ""
          ? "Processo vazio ou não encontrado na planilha"
          : processo.numero.trim().length < 5 
            ? `Processo muito curto (${processo.numero.trim().length} caracteres, mínimo 5)`
            : "Dados insuficientes para importação";
        
        updatedProcessos[i] = { 
          ...processo, 
          status: "invalido", 
          erroImport: motivo,
          erros: processo.erros.length > 0 ? processo.erros : [{ campo: "numero", mensagem: motivo }]
        };
        rejectedCountLocal++;
        setPedidosProgress(((i + 1) / updatedProcessos.length) * 100);
        setPedidosProcessos([...updatedProcessos]);
        continue;
      }

      try {
        const pedidosData = (processo as any).pedidosData || {};

        // Verificar se processo já existe
        const { data: existingProcesso } = await supabase
          .from("processos")
          .select("id")
          .eq("numero", processo.numero.trim())
          .maybeSingle();

        const areaSlug = await ensureAreaExists("trabalhista");

        // Determinar cliente - criar automaticamente pelo RECLAMADO
        let clienteIdToUse: string | null = null;
        const reclamadoNome = pedidosData.reclamado?.trim();
        
        if (reclamadoNome) {
          const existingCliente = clientesCache.find(c => 
            c.nome.toLowerCase().trim() === reclamadoNome.toLowerCase()
          );
          
          if (existingCliente) {
            clienteIdToUse = existingCliente.id;
          } else {
            const { data: novoCliente, error: clienteError } = await supabase
              .from("clientes")
              .insert({
                nome: reclamadoNome,
                tipo: "pessoa_juridica",
              })
              .select("id, nome")
              .single();
            
            if (!clienteError && novoCliente) {
              clienteIdToUse = novoCliente.id;
              clientesCache.push({ id: novoCliente.id, nome: novoCliente.nome, tipo: "pessoa_juridica" });
            } else {
              console.warn(`Falha ao criar cliente ${reclamadoNome}:`, clienteError?.message);
            }
          }
        }

        // Converter valores booleanos
        const parseBoolean = (value: any): boolean => {
          if (!value) return false;
          const str = String(value).toLowerCase().trim();
          return str === "sim" || str === "s" || str === "true" || str === "1" || str === "x";
        };

        const processoData: any = {
          numero: processo.numero.trim(),
          area: areaSlug,
          status: mapStatusToEnum(pedidosData.situacao),
          situacao_original: getSituacaoOriginal(pedidosData.situacao),
          polo_ativo: pedidosData.reclamante,
          polo_passivo: pedidosData.reclamado,
          vara: pedidosData.vara,
          comarca: pedidosData.comarca,
          funcao: pedidosData.funcao,
          setor: pedidosData.setor,
          cliente_id: clienteIdToUse,
          coordenacao_id: selectedCoordenacao || null,
          advogado_responsavel_id: selectedMembro || null,
          monitorar_andamentos: pedidosBuscarAndamentos,
          categoria_importacao: "pedidos",
          // Contrato Trabalho
          periodo_contratacao: pedidosData.periodo_contratacao,
          lei_13467_2017: pedidosData.tipo_contrato,
          // Responsabilidade Subsidiária
          responsabilidade_subsidiaria: pedidosData.responsabilidade_subsidiaria,
          observacao_resp_subsidiaria: pedidosData.observacao_resp_subsidiaria,
          // Horas Extras - todos text agora
          pedido_excesso_jornada: pedidosData.excesso_jornada,
          pedido_plantoes_extras: pedidosData.plantoes_extras,
          pedido_dobras: pedidosData.dobras,
          pedido_intervalo_intrajornada: pedidosData.intervalo_intrajornada,
          pedido_intervalo_interjornada: pedidosData.intervalo_interjornada,
          pedido_descaract_jornada_12_36: pedidosData.descaract_jornada_12_36,
          pedido_domingos_feriados: pedidosData.domingos_feriados,
          // Insalubridade/Periculosidade e Adicionais
          pedido_insalubridade_periculosidade: pedidosData.insalubridade_periculosidade,
          pedido_diferencas_salariais: pedidosData.diferencas_salariais,
          pedido_adicional_noturno: pedidosData.adicional_noturno,
          pedido_sobrecarga_trabalho: pedidosData.sobrecarga_trabalho,
          // Reconhecimento de Vínculo - text
          pedido_reconhecimento_vinculo: pedidosData.reconhecimento_vinculo,
          cargo_reconhecimento_vinculo: pedidosData.cargo_reconhecimento_vinculo,
          // Danos Morais - todos text
          pedido_danos_morais_assedio: pedidosData.danos_morais_assedio,
          pedido_danos_morais_outros: pedidosData.danos_morais_outros,
          // Acidente/Doença - todos text agora
          pedido_acidente_doenca: pedidosData.acidente_doenca,
          pedido_danos_materiais: pedidosData.danos_materiais,
          pedido_pensao_vitalicia: pedidosData.pensao_vitalicia,
          pedido_danos_morais_acidente: pedidosData.danos_morais_acidente,
          pedido_limbo_previdenciario: pedidosData.limbo_previdenciario,
          // Estabilidade
          tipo_estabilidade: pedidosData.tipo_estabilidade,
          pedido_estabilidade: pedidosData.possui_estabilidade,
          // Indenização - todos text agora
          pedido_indenizacao_substitutiva: pedidosData.indenizacao_substitutiva,
          pedido_reversao_justa_causa: pedidosData.reversao_justa_causa,
          pedido_rescisao_indireta: pedidosData.rescisao_indireta,
          pedido_reversao_pedido_demissao: pedidosData.reversao_pedido_demissao,
          // Multas - text
          pedido_multas_clt: pedidosData.multas_clt,
          // Situação/Encerramento
          status_pedido: pedidosData.situacao,
          data_situacao: parseDate(pedidosData.data_situacao),
          motivo_encerramento: pedidosData.tipo_encerramento,
          custo_encerramento: parseNumber(pedidosData.custo_encerramento),
        };

        let isUpdate = false;

        if (existingProcesso) {
          // Update existente
          const { error } = await supabase
            .from("processos")
            .update(processoData)
            .eq("id", existingProcesso.id);

          if (error) {
            updatedProcessos[i] = { ...processo, status: "erro", erroImport: translateDatabaseError(error.message) };
            errorCountLocal++;
            continue;
          }
          isUpdate = true;
        } else {
          // Criar pasta automaticamente
          let pastaId: string | null = null;
          const reclamante = pedidosData.reclamante || "Sem Reclamante";
          const clienteNome = reclamadoNome || "Sem Cliente";
          const nomePasta = `${reclamante} x ${clienteNome}`;
          
          const { data: { user } } = await supabase.auth.getUser();
          
          if (user) {
            const { data: novaPasta, error: pastaError } = await supabase
              .from("pastas")
              .insert({
                nome: nomePasta,
                descricao: `Pasta criada automaticamente para o processo ${processo.numero}`,
                cliente_id: clienteIdToUse,
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

          if (pedidosBuscarAndamentos && insertedProcesso) {
            const andamentosRes = await buscarAndamentosExternos(insertedProcesso.id, processo.numero.trim());
            if (!andamentosRes.success) {
              console.warn(`Falha ao buscar andamentos do processo ${processo.numero}:`, andamentosRes.error);
            }
          }
        }
        
        updatedProcessos[i] = { 
          ...processo, 
          status: "sucesso", 
          erroImport: isUpdate ? "Atualizado" : undefined 
        };
        if (isUpdate) {
          updateCountLocal++;
        } else {
          successCountLocal++;
        }
      } catch (err: any) {
        updatedProcessos[i] = { ...processo, status: "erro", erroImport: err.message };
        errorCountLocal++;
      }

      setPedidosProgress(((i + 1) / updatedProcessos.length) * 100);
      setPedidosProcessos([...updatedProcessos]);
    }

    setPedidosImporting(false);
    endImport();

    const totalProcessed = successCountLocal + updateCountLocal + errorCountLocal + rejectedCountLocal;
    
    toast({
      title: "Importação Pedidos concluída",
      description: `${successCountLocal} novo(s), ${updateCountLocal} atualizado(s), ${rejectedCountLocal} rejeitado(s), ${errorCountLocal} erro(s). Total: ${totalProcessed}/${updatedProcessos.length}`,
      variant: errorCountLocal > 0 || rejectedCountLocal > 0 ? "destructive" : "default",
    });

    if (rejectedCountLocal > 0 || errorCountLocal > 0) {
      setTimeout(() => downloadPedidosRejeitados(updatedProcessos), 0);
    }
  };

  const downloadPedidosRejeitados = (processosToExport: ProcessoImport[] = pedidosProcessos) => {
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
      "Reclamado (Cliente)": p.partePassiva,
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
      "Reclamado (Cliente)": p.partePassiva,
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

    XLSX.writeFile(wb, `pedidos_problemas_${new Date().toISOString().split("T")[0]}.xlsx`);

    toast({
      title: "Arquivo gerado",
      description: `${rejeitados.length} rejeitado(s), ${comAvisos.length} com avisos.`,
    });
  };

  const clearPedidos = () => {
    setPedidosFile(null);
    setPedidosProcessos([]);
    setPedidosProgress(0);
  };

  // Pedidos counts
  const pedidosValidCount = pedidosProcessos.filter(p => p.status === "valido").length;
  const pedidosInvalidCount = pedidosProcessos.filter(p => p.status === "invalido").length;
  const pedidosWarningCount = pedidosProcessos.filter(p => (p.status === "valido" || p.status === "sucesso") && p.erros.length > 0).length;
  const pedidosSuccessCount = pedidosProcessos.filter(p => p.status === "sucesso").length;
  const pedidosErrorCount = pedidosProcessos.filter(p => p.status === "erro").length;
  const pedidosTotalProblemas = pedidosInvalidCount + pedidosErrorCount + pedidosWarningCount;

  // Astrea file handling
  const handleAstreaFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setAstreaFile(selectedFile);
      parseAstreaExcel(selectedFile);
    }
  }, []);

  // Função para encontrar cliente similar por nome
  const findSimilarClient = (clienteNome: string, clientesList: { id: string; nome: string; tipo: string }[]): { id: string; nome: string } | null => {
    if (!clienteNome || !clienteNome.trim()) return null;
    
    const normalizeForComparison = (text: string) => {
      return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\b(ltda|s\/?a|me|epp|eireli|ss|empresa|cia|companhia)\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();
    };
    
    const normalizedInput = normalizeForComparison(clienteNome);
    
    // 1. Busca exata pelo nome original (case insensitive)
    const exactMatch = clientesList.find(c => 
      c.nome.toLowerCase().trim() === clienteNome.toLowerCase().trim()
    );
    if (exactMatch) return { id: exactMatch.id, nome: exactMatch.nome };
    
    // 2. Busca por nome normalizado (remove acentos, sufixos corporativos)
    const normalizedMatch = clientesList.find(c => {
      const normalizedCliente = normalizeForComparison(c.nome);
      return normalizedCliente === normalizedInput;
    });
    if (normalizedMatch) return { id: normalizedMatch.id, nome: normalizedMatch.nome };
    
    // 3. Busca parcial (um contém o outro)
    const partialMatch = clientesList.find(c => {
      const normalizedCliente = normalizeForComparison(c.nome);
      if (normalizedCliente.length < 3 || normalizedInput.length < 3) return false;
      return normalizedCliente.includes(normalizedInput) || normalizedInput.includes(normalizedCliente);
    });
    if (partialMatch) return { id: partialMatch.id, nome: partialMatch.nome };
    
    // 4. Busca por palavras-chave principais (ignora palavras pequenas)
    const keywords = normalizedInput.split(/\s+/).filter(w => w.length > 3);
    if (keywords.length >= 2) {
      const keywordMatch = clientesList.find(c => {
        const normalizedCliente = normalizeForComparison(c.nome);
        // Pelo menos 70% das palavras-chave devem estar presentes
        const matchCount = keywords.filter(keyword => normalizedCliente.includes(keyword)).length;
        return matchCount >= Math.ceil(keywords.length * 0.7);
      });
      if (keywordMatch) return { id: keywordMatch.id, nome: keywordMatch.nome };
    }
    
    return null;
  };

  const parseAstreaExcel = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      const range = sheet["!ref"] ? XLSX.utils.decode_range(sheet["!ref"]) : null;
      const expectedRows = range ? Math.max(0, range.e.r - range.s.r) : 0;

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

        // Extrair número do processo
        const numeroProcesso = getFromRow(row, [
          "Número",
          "Numero",
          "numero",
          "Processo",
          "processo",
        ]) || "";

        // Extrair título (será usado como nome da pasta)
        const titulo = getFromRow(row, ["Título", "Titulo", "titulo", "TÍTULO", "TITULO"]) || "";
        
        // Extrair cliente - priorizar coluna "Cliente" que contém o nome da empresa
        const cliente = getFromRow(row, [
          "Cliente", "cliente", "CLIENTE",
          "Nome do Cliente", "Nome cliente", "nome_cliente",
          "Empresa", "empresa", "EMPRESA"
        ]) || "";
        
        // Extrair outros envolvidos (para polos ativo/passivo)
        const outrosEnvolvidos = getFromRow(row, ["Outros envolvidos", "Outros Envolvidos"]) || "";
        
        // Extrair responsável
        const responsavel = getFromRow(row, ["Responsável", "Responsavel", "responsavel"]) || "";

        // Determinar polo ativo e passivo baseado no papel do cliente e outros envolvidos
        const papelCliente = getFromRow(row, ["Papel do cliente", "Papel Cliente"]) || "";
        let poloAtivo = "";
        let poloPassivo = "";
        
        // Parse outros envolvidos para extrair partes
        if (outrosEnvolvidos) {
          const partes = outrosEnvolvidos.split(/,\s*/).map((p: string) => p.trim());
          partes.forEach((parte: string) => {
            if (parte.includes("(Reclamante)") || parte.includes("(Autor)") || parte.includes("(Requerente)") || parte.includes("(Exequente)")) {
              poloAtivo = parte.replace(/\s*\([^)]+\)\s*/g, "").trim();
            } else if (parte.includes("(Reclamado)") || parte.includes("(Réu)") || parte.includes("(Requerido)") || parte.includes("(Executado)")) {
              if (poloPassivo) poloPassivo += ", ";
              poloPassivo += parte.replace(/\s*\([^)]+\)\s*/g, "").trim();
            }
          });
        }
        
        // Se o cliente é reclamado/réu, ele vai pro polo passivo
        const papelLower = papelCliente.toLowerCase();
        if (papelLower.includes("reclamado") || papelLower.includes("réu") || papelLower.includes("reu") || papelLower.includes("requerido") || papelLower.includes("executado")) {
          if (!poloPassivo) poloPassivo = cliente;
        } else if (papelLower.includes("reclamante") || papelLower.includes("autor") || papelLower.includes("requerente") || papelLower.includes("exequente")) {
          if (!poloAtivo) poloAtivo = cliente;
        }

        const processo: ProcessoImport = {
          numero: String(numeroProcesso ?? "").trim(),
          assunto: getFromRow(row, ["Objeto", "objeto", "Matéria", "Materia"]) || null,
          situacao: null,
          responsavel: responsavel,
          descricao: getFromRow(row, ["Observações", "Observacoes", "observacoes"]) || null,
          justica: null,
          cidade: null,
          estado: null,
          instancia: getFromRow(row, ["Instância Atual", "Instancia Atual"]) || null,
          orgao: getFromRow(row, ["Foro", "foro"]) || null,
          orgaoJulgador: getFromRow(row, ["Vara", "vara"]) || null,
          sistema: null,
          area: "trabalhista", // Default trabalhista para Astrea
          fase: null,
          dataDistribuicao: getFromRow(row, ["Data de distribuição", "Data de Distribuição", "Data distribuição"]) || null,
          classeCNJ: getFromRow(row, ["Ação", "Acao", "acao"]) || null,
          valorAcao: parseNumber(getFromRow(row, ["Valor da causa", "Valor da Causa"]) || null),
          parteAtiva: poloAtivo,
          partePassiva: poloPassivo,
          cpfCnpjAtivo: null,
          cpfCnpjPassivo: null,
          status: "pendente",
          erros: [],
          linhaOriginal: index + 2,
          valorCondenacao: parseNumber(getFromRow(row, ["Valor da condenação", "Valor da Condenação"]) || null),
          valorProvisionado: parseNumber(getFromRow(row, ["Valor total da provisão", "Valor Total da Provisão"]) || null),
        };

        // Store Astrea-specific data
        (processo as any).astreaData = {
          tipo: getFromRow(row, ["Tipo", "tipo"]) || null,
          titulo: titulo,
          papelCliente: papelCliente,
          cliente: cliente,
          outrosClientes: getFromRow(row, ["Outros clientes", "Outros Clientes"]) || null,
          outrosEnvolvidos: outrosEnvolvidos,
          pasta: getFromRow(row, ["Pasta", "pasta"]) || null,
          acao: getFromRow(row, ["Ação", "Acao"]) || null,
          valorOriginal: parseNumber(getFromRow(row, ["Valor original", "Valor Original"]) || null),
          valorTotalEnvolvido: parseNumber(getFromRow(row, ["Valor total envolvido", "Valor Total Envolvido"]) || null),
          decisaoProcesso: getFromRow(row, ["Decisão do processo", "Decisao do processo"]) || null,
          resultadoProcesso: getFromRow(row, ["Resultado do processo", "Resultado do Processo"]) || null,
          etiquetas: getFromRow(row, ["Etiquetas", "etiquetas"]) || null,
          dataCriacao: getFromRow(row, ["Data de Criação", "Data de Criacao"]) || null,
          dataEncerramento: getFromRow(row, ["Data de Encerramento", "Data Encerramento"]) || null,
          dataUltimoHistorico: getFromRow(row, ["Data do último histórico", "Data do Ultimo Historico"]) || null,
          descricaoUltimoHistorico: getFromRow(row, ["Descrição do último histórico", "Descricao do ultimo historico"]) || null,
          instanciaOriginal: getFromRow(row, ["Instância Original", "Instancia Original"]) || null,
          urlProcesso: getFromRow(row, ["URL do Processo", "url do processo"]) || null,
          numeroJuizo: getFromRow(row, ["Número do Juízo", "Numero do Juizo"]) || null,
          acesso: getFromRow(row, ["Acesso", "acesso"]) || null,
          responsavel: responsavel,
        };

        // Validação
        processo.erros = validateProcesso(processo);

        const numeroTrimmed = (processo.numero || "").trim();
        const isEmptyRow = !rowHasAnyValue;
        const hasInvalidNumero = !numeroTrimmed || numeroTrimmed.length < 5;

        // Ignorar linhas do tipo "Caso" (não são processos judiciais)
        const tipo = (processo as any).astreaData?.tipo || "";
        if (tipo.toLowerCase() === "caso") {
          processo.status = "invalido";
          processo.erroImport = "Tipo 'Caso' não é processo judicial";
          processo.erros = [{ campo: "Tipo", mensagem: "Casos não são importados como processos" }];
        } else if (isEmptyRow || hasInvalidNumero) {
          const motivo = isEmptyRow
            ? "Linha vazia na planilha"
            : !numeroTrimmed
              ? "Número vazio ou não encontrado na planilha"
              : `Número muito curto (${numeroTrimmed.length} caracteres, mínimo 5)`;

          processo.status = "invalido";
          processo.erroImport = motivo;
          processo.erros = [{ campo: "numero", mensagem: motivo }];
        } else {
          processo.status = "valido";
        }

        return processo;
      });

      setAstreaProcessos(parsed);

      const validCount = parsed.filter((p) => p.status === "valido").length;
      const invalidCount = parsed.filter((p) => p.status === "invalido").length;

      if (parsed.length === 0) {
        toast({
          title: "Nenhum processo encontrado",
          description: "A planilha não contém dados.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Planilha Astrea carregada",
          description: `${parsed.length} linha(s) lida(s): ${validCount} importável(is), ${invalidCount} rejeitada(s).`,
          variant: invalidCount > 0 ? "destructive" : "default",
        });
      }
    } catch (error) {
      console.error("Erro ao ler planilha Astrea:", error);
      toast({
        title: "Erro ao ler planilha",
        description: "Verifique se o arquivo está no formato correto (.xlsx ou .xls).",
        variant: "destructive",
      });
    }
  };

  const handleAstreaImport = async () => {
    const validProcessos = astreaProcessos.filter(p => p.status === "valido");
    const invalidProcessos = astreaProcessos.filter(p => p.status === "invalido");
    
    if (validProcessos.length === 0 && invalidProcessos.length === 0) {
      toast({
        title: "Nenhum processo para processar",
        description: "A planilha não contém dados válidos.",
        variant: "destructive",
      });
      return;
    }

    setAstreaImporting(true);
    astreaCancelledRef.current = false;
    startImport("Importando Astrea");
    setAstreaProgress(0);

    const updatedProcessos = [...astreaProcessos];
    let successCountLocal = 0;
    let updateCountLocal = 0;
    let errorCountLocal = 0;
    let rejectedCountLocal = 0;
    
    // Create a mutable copy of clientes to track newly created clients during import
    const clientesCache: { id: string; nome: string; tipo: string }[] = [...clientes];

    for (let i = 0; i < updatedProcessos.length; i++) {
      // Check for cancellation
      if (astreaCancelledRef.current) {
        toast({
          title: "Importação cancelada",
          description: `Cancelada após processar ${i} de ${updatedProcessos.length} registros.`,
        });
        setAstreaImporting(false);
        endImport();
        return;
      }

      const processo = updatedProcessos[i];
      
      // Process invalid records - mark them as rejected with clear reason
      if (processo.status === "invalido") {
        rejectedCountLocal++;
        setAstreaProgress(((i + 1) / updatedProcessos.length) * 100);
        setAstreaProcessos([...updatedProcessos]);
        continue;
      }

      try {
        const astreaData = (processo as any).astreaData || {};

        // Check if process already exists
        const { data: existingProcesso } = await supabase
          .from("processos")
          .select("id, coordenacao_id, advogado_responsavel_id, cliente_id, pasta_id")
          .eq("numero", processo.numero.trim())
          .maybeSingle();

        const areaSlug = await ensureAreaExists(processo.area);

        // Determinar cliente - buscar por similaridade primeiro
        let clienteIdToUse: string | null = null;
        const clienteNomeFromSheet = astreaData.cliente?.trim() || null;
        
        console.log(`[Astrea Import] Processo ${processo.numero}:`, {
          clienteColuna: clienteNomeFromSheet,
          titulo: astreaData.titulo,
          papelCliente: astreaData.papelCliente,
        });
        
        if (clienteNomeFromSheet) {
          // Buscar cliente similar existente
          const similarClient = findSimilarClient(clienteNomeFromSheet, clientesCache);
          
          if (similarClient) {
            clienteIdToUse = similarClient.id;
            console.log(`[Astrea Import] Cliente "${clienteNomeFromSheet}" mapeado para existente: "${similarClient.nome}"`);
          } else {
            // Verificar no banco se já existe (pode ter sido criado em outra sessão)
            const { data: existingCliente } = await supabase
              .from("clientes")
              .select("id, nome")
              .ilike("nome", clienteNomeFromSheet)
              .maybeSingle();
            
            if (existingCliente) {
              clienteIdToUse = existingCliente.id;
              clientesCache.push({ id: existingCliente.id, nome: existingCliente.nome, tipo: "pessoa_juridica" });
              console.log(`[Astrea Import] Cliente encontrado no banco: "${existingCliente.nome}"`);
            } else {
              // Criar novo cliente apenas se não encontrou
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
                clientesCache.push({ id: novoCliente.id, nome: novoCliente.nome, tipo: "pessoa_juridica" });
                console.log(`[Astrea Import] Novo cliente criado: ${novoCliente.nome}`);
              } else {
                console.warn(`[Astrea Import] Falha ao criar cliente ${clienteNomeFromSheet}:`, clienteError?.message);
              }
            }
          }
        } else {
          console.warn(`[Astrea Import] Coluna Cliente vazia para processo ${processo.numero}`);
        }

        let isUpdate = false;

        if (existingProcesso) {
          // SMART MERGE: Processo já existe - atualizar apenas campos vazios, NÃO alterar responsáveis
          const { data: currentProcesso } = await supabase
            .from("processos")
            .select("*")
            .eq("id", existingProcesso.id)
            .single();
          
          if (!currentProcesso) {
            throw new Error("Processo não encontrado após verificação");
          }

          const updateData: Record<string, any> = {};
          
          // Só atualiza campos que estão vazios no banco
          if (!currentProcesso.assunto && processo.assunto) {
            updateData.assunto = processo.assunto;
          }
          if (!currentProcesso.descricao && processo.descricao) {
            updateData.descricao = processo.descricao;
          }
          if (!currentProcesso.vara && processo.orgaoJulgador) {
            updateData.vara = processo.orgaoJulgador;
          }
          if (!currentProcesso.tribunal && processo.orgao) {
            updateData.tribunal = processo.orgao;
          }
          if (!currentProcesso.instancia && processo.instancia) {
            updateData.instancia = processo.instancia;
          }
          if (!currentProcesso.classe && processo.classeCNJ) {
            updateData.classe = processo.classeCNJ;
          }
          if (!currentProcesso.data_distribuicao && parseDate(processo.dataDistribuicao)) {
            updateData.data_distribuicao = parseDate(processo.dataDistribuicao);
          }
          if (!currentProcesso.valor_causa && processo.valorAcao) {
            updateData.valor_causa = processo.valorAcao;
          }
          if (!currentProcesso.valor_condenacao && processo.valorCondenacao) {
            updateData.valor_condenacao = processo.valorCondenacao;
          }
          if (!currentProcesso.valor_provisionado && processo.valorProvisionado) {
            updateData.valor_provisionado = processo.valorProvisionado;
          }
          if (!currentProcesso.polo_ativo && processo.parteAtiva) {
            updateData.polo_ativo = processo.parteAtiva;
          }
          if (!currentProcesso.polo_passivo && processo.partePassiva) {
            updateData.polo_passivo = processo.partePassiva;
          }
          // Cliente só atualiza se estiver vazio
          if (!currentProcesso.cliente_id && clienteIdToUse) {
            updateData.cliente_id = clienteIdToUse;
          }
          // Astrea specific
          if (!currentProcesso.resultado && astreaData.resultadoProcesso) {
            updateData.resultado = astreaData.resultadoProcesso;
          }
          if (!currentProcesso.andamento_atual && astreaData.descricaoUltimoHistorico) {
            updateData.andamento_atual = astreaData.descricaoUltimoHistorico;
          }
          // Guardar etiquetas e url nas observações se não existir
          if (!currentProcesso.observacoes_processo) {
            const extras: string[] = [];
            if (astreaData.etiquetas) extras.push(`Etiquetas: ${astreaData.etiquetas}`);
            if (astreaData.urlProcesso) extras.push(`URL: ${astreaData.urlProcesso}`);
            if (extras.length > 0) {
              updateData.observacoes_processo = extras.join("\n");
            }
          }

          // NÃO alterar coordenacao_id ou advogado_responsavel_id existentes
          
          if (Object.keys(updateData).length > 0) {
            const { error } = await supabase
              .from("processos")
              .update(updateData)
              .eq("id", existingProcesso.id);

            if (error) {
              updatedProcessos[i] = { ...processo, status: "erro", erroImport: translateDatabaseError(error.message) };
              errorCountLocal++;
              continue;
            }
          }
          
          isUpdate = true;
          updatedProcessos[i] = { 
            ...processo, 
            status: "sucesso", 
            erroImport: "Atualizado (campos vazios preenchidos)" 
          };
          updateCountLocal++;
        } else {
          // Novo processo - criar pasta usando o título da planilha
          let pastaId: string | null = null;
          const nomePasta = astreaData.titulo || `${processo.parteAtiva || "Sem Parte"} x ${clienteNomeFromSheet || "Sem Cliente"}`;
          
          const { data: { user } } = await supabase.auth.getUser();
          
          if (user) {
            // Verificar se pasta já existe com esse nome
            const { data: pastaExistente } = await supabase
              .from("pastas")
              .select("id")
              .eq("nome", nomePasta)
              .maybeSingle();
            
            if (pastaExistente) {
              pastaId = pastaExistente.id;
            } else {
              const { data: novaPasta, error: pastaError } = await supabase
                .from("pastas")
                .insert({
                  nome: nomePasta,
                  descricao: `Pasta importada do Astrea para o processo ${processo.numero}`,
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
          }

          const processoData: any = {
            numero: processo.numero.trim(),
            area: areaSlug,
            status: mapStatusToEnum(processo.situacao),
            assunto: processo.assunto,
            descricao: processo.descricao,
            vara: processo.orgaoJulgador,
            tribunal: processo.orgao,
            instancia: processo.instancia,
            classe: processo.classeCNJ,
            data_distribuicao: parseDate(processo.dataDistribuicao),
            valor_causa: processo.valorAcao,
            valor_condenacao: processo.valorCondenacao,
            valor_provisionado: processo.valorProvisionado,
            polo_ativo: processo.parteAtiva,
            polo_passivo: processo.partePassiva,
            cliente_id: clienteIdToUse,
            coordenacao_id: selectedCoordenacao || null,
            advogado_responsavel_id: selectedMembro || null,
            pasta_id: pastaId,
            monitorar_andamentos: astreaBuscarAndamentos,
            // Astrea specific fields (etiquetas stored in observacoes since column doesn't exist)
            resultado: astreaData.resultadoProcesso,
            andamento_atual: astreaData.descricaoUltimoHistorico,
            advogado_externo: astreaData.responsavel,
            observacoes_processo: (() => {
              const extras: string[] = [];
              if (astreaData.etiquetas) extras.push(`Etiquetas: ${astreaData.etiquetas}`);
              if (astreaData.urlProcesso) extras.push(`URL: ${astreaData.urlProcesso}`);
              return extras.length > 0 ? extras.join("\n") : null;
            })(),
          };

          const { data: insertedProcesso, error } = await supabase
            .from("processos")
            .insert(processoData)
            .select("id")
            .single();

          if (error) {
            updatedProcessos[i] = { ...processo, status: "erro", erroImport: translateDatabaseError(error.message) };
            errorCountLocal++;
            continue;
          }

          // Vincular responsável na tabela processos_responsaveis se selecionado
          if (selectedMembro && insertedProcesso) {
            await supabase
              .from("processos_responsaveis")
              .insert({
                processo_id: insertedProcesso.id,
                usuario_id: selectedMembro,
                papel: "responsavel",
              })
              .select()
              .maybeSingle();
          }

          if (astreaBuscarAndamentos && insertedProcesso) {
            const andamentosRes = await buscarAndamentosExternos(insertedProcesso.id, processo.numero.trim());
            if (!andamentosRes.success) {
              console.warn(`Falha ao buscar andamentos do processo ${processo.numero}:`, andamentosRes.error);
            }
          }
          
          updatedProcessos[i] = { 
            ...processo, 
            status: "sucesso", 
          };
          successCountLocal++;
        }
      } catch (err: any) {
        updatedProcessos[i] = { ...processo, status: "erro", erroImport: err.message };
        errorCountLocal++;
      }

      setAstreaProgress(((i + 1) / updatedProcessos.length) * 100);
      setAstreaProcessos([...updatedProcessos]);
    }

    setAstreaImporting(false);
    endImport();

    const totalProcessed = successCountLocal + updateCountLocal + errorCountLocal + rejectedCountLocal;
    
    toast({
      title: "Importação Astrea concluída",
      description: `${successCountLocal} novo(s), ${updateCountLocal} atualizado(s), ${rejectedCountLocal} rejeitado(s), ${errorCountLocal} erro(s). Total: ${totalProcessed}/${updatedProcessos.length}`,
      variant: errorCountLocal > 0 || rejectedCountLocal > 0 ? "destructive" : "default",
    });

    if (rejectedCountLocal > 0 || errorCountLocal > 0) {
      setTimeout(() => downloadAstreaRejeitados(updatedProcessos), 0);
    }
  };

  const downloadAstreaRejeitados = (processosToExport: ProcessoImport[] = astreaProcessos) => {
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
      Título: (p as any).astreaData?.titulo || "",
      Cliente: (p as any).astreaData?.cliente || "",
      Responsável: (p as any).astreaData?.responsavel || "",
      Tipo: "REJEITADO",
      Motivo:
        p.erros.map((e) => `${e.campo}: ${e.mensagem}`).join("; ") ||
        p.erroImport ||
        "Erro crítico",
    }));

    const avisosData = comAvisos.map((p) => ({
      Linha: p.linhaOriginal,
      "Número do processo": p.numero,
      Título: (p as any).astreaData?.titulo || "",
      Cliente: (p as any).astreaData?.cliente || "",
      Responsável: (p as any).astreaData?.responsavel || "",
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

    XLSX.writeFile(wb, `astrea_problemas_${new Date().toISOString().split("T")[0]}.xlsx`);

    toast({
      title: "Arquivo gerado",
      description: `${rejeitados.length} rejeitado(s), ${comAvisos.length} com avisos.`,
    });
  };

  const clearAstrea = () => {
    setAstreaFile(null);
    setAstreaProcessos([]);
    setAstreaProgress(0);
  };

  // Astrea counts
  const astreaValidCount = astreaProcessos.filter(p => p.status === "valido").length;
  const astreaInvalidCount = astreaProcessos.filter(p => p.status === "invalido").length;
  const astreaWarningCount = astreaProcessos.filter(p => (p.status === "valido" || p.status === "sucesso") && p.erros.length > 0).length;
  const astreaSuccessCount = astreaProcessos.filter(p => p.status === "sucesso").length;
  const astreaErrorCount = astreaProcessos.filter(p => p.status === "erro").length;
  const astreaTotalProblemas = astreaInvalidCount + astreaErrorCount + astreaWarningCount;

  return (
    <MainLayout title="Importar Processos" subtitle="Importe processos em lote">
      <div className="space-y-6">
        <Tabs defaultValue="lista" className="w-full">
          <TabsList className="grid w-full grid-cols-9 max-w-6xl">
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
            <TabsTrigger value="astrea" className="flex items-center gap-2">
              <Scale className="h-4 w-4" />
              <span className="hidden sm:inline">Astrea</span>
            </TabsTrigger>
            <TabsTrigger value="osmar" className="flex items-center gap-2">
              <Hospital className="h-4 w-4" />
              <span className="hidden sm:inline">Dr. Osmar</span>
            </TabsTrigger>
            <TabsTrigger value="janaina" className="flex items-center gap-2">
              <Scale className="h-4 w-4" />
              <span className="hidden sm:inline">Dra. Janaina</span>
            </TabsTrigger>
            <TabsTrigger value="polyana" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Dra. Polyana</span>
            </TabsTrigger>
            <TabsTrigger value="mpt" className="flex items-center gap-2">
              <Gavel className="h-4 w-4" />
              <span className="hidden sm:inline">Min. Público</span>
            </TabsTrigger>
            <TabsTrigger value="pedidos" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Pedidos</span>
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

                {/* Opção de forçar atualização */}
                <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30">
                  <div className="space-y-0.5">
                    <Label htmlFor="forcar-atualizacao" className="flex items-center gap-2 font-medium">
                      <ArrowRightLeft className="h-4 w-4" />
                      Forçar atualização de todos os campos
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {forcarAtualizacao 
                        ? "Os dados serão sobrescritos com as informações mais recentes da API (tribunal, vara, partes, valor, etc.)."
                        : "Somente os campos vazios serão preenchidos com dados da API. Campos já preenchidos não serão alterados."}
                    </p>
                  </div>
                  <Switch
                    id="forcar-atualizacao"
                    checked={forcarAtualizacao}
                    onCheckedChange={setForcarAtualizacao}
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
                    {importing ? (
                      <Button 
                        variant="destructive" 
                        onClick={() => {
                          planilhaCancelledRef.current = true;
                        }}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Cancelar
                      </Button>
                    ) : (
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setFile(null);
                          setProcessos([]);
                          setProgress(0);
                        }}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Limpar
                      </Button>
                    )}
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
                  <h4 className="font-medium mb-2">1. Baixe o modelo de planilha</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Utilize o modelo padrão para preencher os dados dos processos.
                  </p>
                  <Button variant="outline" onClick={downloadProjurisTemplate}>
                    <Download className="h-4 w-4 mr-2" />
                    Baixar Modelo Projuris
                  </Button>
                </div>
                <div>
                  <h4 className="font-medium mb-2">2. Faça upload da planilha do Projuris</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Preencha e faça o upload da planilha aqui.
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

          {/* Tab: Astrea */}
          <TabsContent value="astrea" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scale className="h-5 w-5" />
                  Importar Astrea
                </CardTitle>
                <CardDescription>
                  Importe processos exportados do sistema Astrea. Processos existentes terão apenas campos vazios atualizados (responsáveis e coordenações não são alterados).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">1. Faça upload da planilha Astrea</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    A planilha deve conter as colunas: Número, Título, Cliente, Outros envolvidos, Vara, Foro, Responsável, etc.
                  </p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleAstreaFileChange}
                      className="max-w-xs"
                      disabled={astreaImporting}
                    />
                    {astreaFile && (
                      <Button variant="outline" onClick={clearAstrea} disabled={astreaImporting}>
                        Limpar
                      </Button>
                    )}
                  </div>
                </div>

                {/* Coordenação Selection */}
                <div className="space-y-2 pt-4 border-t">
                  <Label htmlFor="coordenacao-astrea" className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Coordenação Responsável (apenas para novos processos)
                  </Label>
                  <Select 
                    value={selectedCoordenacao} 
                    onValueChange={(value) => {
                      setSelectedCoordenacao(value);
                      setSelectedMembro("");
                    }}
                    disabled={astreaImporting}
                  >
                    <SelectTrigger id="coordenacao-astrea" className="max-w-md">
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
                    <Label htmlFor="membro-astrea" className="flex items-center gap-2">
                      Advogado Responsável (apenas para novos processos)
                    </Label>
                    <Select 
                      value={selectedMembro} 
                      onValueChange={setSelectedMembro}
                      disabled={astreaImporting}
                    >
                      <SelectTrigger id="membro-astrea" className="max-w-md">
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

                {/* Opção de buscar andamentos */}
                <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30 max-w-md">
                  <div className="space-y-0.5">
                    <Label htmlFor="buscar-andamentos-astrea" className="flex items-center gap-2 font-medium">
                      <Clock className="h-4 w-4" />
                      Buscar andamentos na importação
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {astreaBuscarAndamentos 
                        ? "Andamentos serão buscados e processos ficarão habilitados para monitoramento."
                        : "Andamentos NÃO serão buscados."}
                    </p>
                  </div>
                  <Switch
                    id="buscar-andamentos-astrea"
                    checked={astreaBuscarAndamentos}
                    onCheckedChange={setAstreaBuscarAndamentos}
                    disabled={astreaImporting}
                  />
                </div>

                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Smart Merge:</strong> Processos já existentes terão apenas campos vazios preenchidos. Responsáveis e coordenações existentes NÃO são alterados. O "Título" será usado como nome da pasta para novos processos.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Astrea Preview */}
            {astreaFile && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <CardTitle>Pré-visualização Astrea</CardTitle>
                      <CardDescription>
                        {astreaProcessos.length} linha(s) em "{astreaFile.name}"
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      {astreaProcessos.length > 0 && (
                        <div className="flex items-center gap-2 text-sm flex-wrap">
                          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">
                            {astreaValidCount} importáveis
                          </Badge>
                          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-200">
                            {astreaInvalidCount} rejeitados
                          </Badge>
                          {astreaSuccessCount > 0 && (
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-200">
                              {astreaSuccessCount} importados
                            </Badge>
                          )}
                        </div>
                      )}
                      <div className="flex gap-2">
                        {astreaImporting ? (
                          <Button 
                            variant="destructive" 
                            onClick={() => {
                              astreaCancelledRef.current = true;
                            }}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Cancelar
                          </Button>
                        ) : (
                          <Button 
                            variant="outline" 
                            onClick={() => {
                              setAstreaFile(null);
                              setAstreaProcessos([]);
                              setAstreaProgress(0);
                            }}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Limpar
                          </Button>
                        )}
                        {astreaTotalProblemas > 0 && (
                          <Button variant="outline" onClick={() => downloadAstreaRejeitados()}>
                            <FileDown className="h-4 w-4 mr-2" />
                            Baixar Problemas ({astreaTotalProblemas})
                          </Button>
                        )}
                        <Button 
                          onClick={handleAstreaImport} 
                          disabled={astreaImporting || astreaValidCount === 0}
                        >
                          {astreaImporting ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Importando...
                            </>
                          ) : (
                            <>
                              <Upload className="h-4 w-4 mr-2" />
                              Importar ({astreaValidCount})
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                  {astreaImporting && (
                    <Progress value={astreaProgress} className="mt-4" />
                  )}
                </CardHeader>
                <CardContent>
                  {astreaProcessos.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <div className="max-h-[400px] overflow-auto">
                        <Table>
                          <TableHeader className="sticky top-0 bg-background">
                            <TableRow>
                              <TableHead className="w-[60px]">Linha</TableHead>
                              <TableHead className="w-[60px]">Status</TableHead>
                              <TableHead>Número</TableHead>
                              <TableHead>Título</TableHead>
                              <TableHead>Cliente</TableHead>
                              <TableHead>Responsável</TableHead>
                              <TableHead className="min-w-[200px]">Avisos/Erros</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {astreaProcessos.map((processo, index) => (
                              <TableRow key={index} className={
                                processo.status === "invalido" ? "bg-red-50 dark:bg-red-950/20" : 
                                processo.status === "erro" ? "bg-orange-50 dark:bg-orange-950/20" : ""
                              }>
                                <TableCell className="text-muted-foreground">
                                  {processo.linhaOriginal}
                                </TableCell>
                                <TableCell>
                                  {processo.status === "valido" && <div className="w-3 h-3 rounded-full bg-green-500" />}
                                  {processo.status === "invalido" && <XCircle className="h-4 w-4 text-red-500" />}
                                  {processo.status === "sucesso" && <CheckCircle2 className="h-4 w-4 text-blue-500" />}
                                  {processo.status === "erro" && <XCircle className="h-4 w-4 text-orange-500" />}
                                </TableCell>
                                <TableCell className="font-mono text-sm">
                                  {processo.numero || <span className="text-red-500 italic">vazio</span>}
                                </TableCell>
                                <TableCell className="max-w-[200px] truncate">
                                  {(processo as any).astreaData?.titulo || "-"}
                                </TableCell>
                                <TableCell className="max-w-[150px] truncate">
                                  {(processo as any).astreaData?.cliente || "-"}
                                </TableCell>
                                <TableCell>
                                  {(processo as any).astreaData?.responsavel || "-"}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {processo.status === "invalido" && processo.erros.length > 0 && (
                                    <div className="text-red-600 space-y-1">
                                      {processo.erros.map((erro, i) => (
                                        <div key={i}>• {erro.campo}: {erro.mensagem}</div>
                                      ))}
                                    </div>
                                  )}
                                  {processo.erroImport && (
                                    <div className="text-orange-600">• {processo.erroImport}</div>
                                  )}
                                  {processo.status === "valido" && processo.erros.length === 0 && "-"}
                                  {processo.status === "sucesso" && processo.erros.length === 0 && <span className="text-blue-600">Importado</span>}
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
                  <h4 className="font-medium mb-2">1. Baixe o modelo de planilha</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Utilize o modelo padrão para preencher os dados dos processos.
                  </p>
                  <Button variant="outline" onClick={downloadOsmarTemplate}>
                    <Download className="h-4 w-4 mr-2" />
                    Baixar Modelo Dr. Osmar
                  </Button>
                </div>
                <div>
                  <h4 className="font-medium mb-2">2. Faça upload da planilha</h4>
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
                        {osmarImporting ? (
                          <Button 
                            variant="destructive" 
                            onClick={() => {
                              osmarCancelledRef.current = true;
                            }}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Cancelar
                          </Button>
                        ) : (
                          <Button 
                            variant="outline" 
                            onClick={() => {
                              setOsmarFile(null);
                              setOsmarProcessos([]);
                              setOsmarProgress(0);
                            }}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Limpar
                          </Button>
                        )}
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
                  <h4 className="font-medium mb-2">1. Baixe o modelo de planilha</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Utilize o modelo padrão para preencher os dados dos processos.
                  </p>
                  <Button variant="outline" onClick={downloadJanainaTemplate}>
                    <Download className="h-4 w-4 mr-2" />
                    Baixar Modelo Dra. Janaína
                  </Button>
                </div>
                <div>
                  <h4 className="font-medium mb-2">2. Faça upload da planilha</h4>
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
                        {janainaImporting ? (
                          <Button 
                            variant="destructive" 
                            onClick={() => {
                              janainaCancelledRef.current = true;
                            }}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Cancelar
                          </Button>
                        ) : (
                          <Button 
                            variant="outline" 
                            onClick={() => {
                              setJanainaFile(null);
                              setJanainaProcessos([]);
                              setJanainaProgress(0);
                            }}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Limpar
                          </Button>
                        )}
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

          {/* Tab: Dra. Polyana */}
          <TabsContent value="polyana" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Importar Dra. Polyana
                </CardTitle>
                <CardDescription>
                  Importe processos trabalhistas da Dra. Polyana. Todos os processos serão atribuídos automaticamente à Coordenação da Dra. Janaína e à Dra. Polyana como advogada responsável. Processos existentes serão atualizados e redistribuídos.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">1. Baixe o modelo de planilha</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Utilize o modelo padrão para preencher os dados dos processos.
                  </p>
                  <Button variant="outline" onClick={downloadPolyanaTemplate}>
                    <Download className="h-4 w-4 mr-2" />
                    Baixar Modelo Dra. Polyana
                  </Button>
                </div>
                <div>
                  <h4 className="font-medium mb-2">2. Faça upload da planilha</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    A planilha deve conter as colunas: HOSPITAL, Parte Contrária, Numero do processo, Fase do Processo, DESCRIÇÃO DO OBJETO, ANDAMENTO ATUALIZADO, VALOR DA CAUSA.
                  </p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handlePolyanaFileChange}
                      className="max-w-xs"
                      disabled={polyanaImporting}
                    />
                    {polyanaFile && (
                      <Button variant="outline" onClick={clearPolyana} disabled={polyanaImporting}>
                        Limpar
                      </Button>
                    )}
                  </div>
                </div>

                {/* Opção de buscar andamentos */}
                <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30 max-w-md">
                  <div className="space-y-0.5">
                    <Label htmlFor="buscar-andamentos-polyana" className="flex items-center gap-2 font-medium">
                      <Clock className="h-4 w-4" />
                      Buscar andamentos na importação
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {polyanaBuscarAndamentos 
                        ? "Os andamentos serão buscados durante a importação e o processo ficará habilitado para monitoramento automático."
                        : "Os andamentos NÃO serão buscados e o processo ficará desabilitado para monitoramento."}
                    </p>
                  </div>
                  <Switch
                    id="buscar-andamentos-polyana"
                    checked={polyanaBuscarAndamentos}
                    onCheckedChange={setPolyanaBuscarAndamentos}
                    disabled={polyanaImporting}
                  />
                </div>
                
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Atribuição automática:</strong> Todos os processos serão atribuídos à Coordenação da Dra. Janaína e à Dra. Polyana como advogada responsável. O cliente será criado automaticamente baseado na coluna HOSPITAL.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Polyana File Preview */}
            {polyanaFile && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <CardTitle>Pré-visualização Dra. Polyana</CardTitle>
                      <CardDescription>
                        {polyanaProcessos.length} processo(s) encontrado(s) em "{polyanaFile.name}"
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      {polyanaProcessos.length > 0 && (
                        <div className="flex items-center gap-2 text-sm flex-wrap">
                          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">
                            {polyanaValidCount} importáveis
                          </Badge>
                          {polyanaWarningCount > 0 && (
                            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-200">
                              {polyanaWarningCount} com avisos
                            </Badge>
                          )}
                          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-200">
                            {polyanaInvalidCount} rejeitados
                          </Badge>
                          {polyanaSuccessCount > 0 && (
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-200">
                              {polyanaSuccessCount} importados
                            </Badge>
                          )}
                          {polyanaErrorCount > 0 && (
                            <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-200">
                              {polyanaErrorCount} erros
                            </Badge>
                          )}
                        </div>
                      )}
                      <div className="flex gap-2">
                        {polyanaImporting ? (
                          <Button 
                            variant="destructive" 
                            onClick={() => {
                              polyanaCancelledRef.current = true;
                            }}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Cancelar
                          </Button>
                        ) : (
                          <Button 
                            variant="outline" 
                            onClick={() => {
                              setPolyanaFile(null);
                              setPolyanaProcessos([]);
                              setPolyanaProgress(0);
                            }}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Limpar
                          </Button>
                        )}
                        {polyanaTotalProblemas > 0 && (
                          <Button variant="outline" onClick={() => downloadPolyanaRejeitados()}>
                            <FileDown className="h-4 w-4 mr-2" />
                            Baixar Problemas ({polyanaTotalProblemas})
                          </Button>
                        )}
                        <Button 
                          onClick={handlePolyanaImport} 
                          disabled={polyanaImporting || polyanaValidCount === 0}
                        >
                          {polyanaImporting ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Importando...
                            </>
                          ) : (
                            <>
                              <Upload className="h-4 w-4 mr-2" />
                              Importar ({polyanaValidCount})
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                  {polyanaImporting && (
                    <Progress value={polyanaProgress} className="mt-4" />
                  )}
                </CardHeader>
                <CardContent>
                  {polyanaProcessos.length === 0 ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Nenhum processo encontrado na planilha. Verifique se é uma planilha no formato correto.
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
                              <TableHead>Hospital</TableHead>
                              <TableHead>Parte Contrária</TableHead>
                              <TableHead>Fase</TableHead>
                              <TableHead>Valor Causa</TableHead>
                              <TableHead className="min-w-[300px]">Avisos/Erros</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {polyanaProcessos.map((processo, index) => (
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
                                <TableCell>{(processo as any).polyanaData?.faseProcesso || processo.fase || "-"}</TableCell>
                                <TableCell>{(processo as any).polyanaData?.valorCausa || "-"}</TableCell>
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

          {/* Tab: Ministério Público */}
          <TabsContent value="mpt" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gavel className="h-5 w-5" />
                  Importar Ministério Público
                </CardTitle>
                <CardDescription>
                  Importe processos do Ministério Público do Trabalho. Processos existentes serão atualizados.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">1. Baixe o modelo de planilha</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Utilize o modelo padrão para preencher os dados dos processos.
                  </p>
                  <Button variant="outline" onClick={downloadMptTemplate}>
                    <Download className="h-4 w-4 mr-2" />
                    Baixar Modelo MPT
                  </Button>
                </div>
                <div>
                  <h4 className="font-medium mb-2">2. Faça upload da planilha</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    A planilha deve conter as colunas: PROCEDIMENTO, LOCALIDADE, UF, AUTOR, REQUERIDO, MATÉRIA, ÚLTIMO ANDAMENTO, STATUS, Observação Advogado Responsável.
                  </p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleMptFileChange}
                      className="max-w-xs"
                      disabled={mptImporting}
                    />
                    {mptFile && (
                      <Button variant="outline" onClick={clearMpt} disabled={mptImporting}>
                        Limpar
                      </Button>
                    )}
                  </div>
                </div>
                
                {/* Coordenação Selection */}
                <div className="space-y-2 pt-4 border-t">
                  <Label htmlFor="coordenacao-mpt" className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Coordenação Responsável
                  </Label>
                  <Select 
                    value={selectedCoordenacao} 
                    onValueChange={(value) => {
                      setSelectedCoordenacao(value);
                      setSelectedMembro("");
                    }}
                    disabled={mptImporting}
                  >
                    <SelectTrigger id="coordenacao-mpt" className="max-w-md">
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
                    <Label htmlFor="membro-mpt" className="flex items-center gap-2">
                      Advogado Responsável (opcional)
                    </Label>
                    <Select 
                      value={selectedMembro} 
                      onValueChange={setSelectedMembro}
                      disabled={mptImporting}
                    >
                      <SelectTrigger id="membro-mpt" className="max-w-md">
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
                  <Label htmlFor="cliente-mpt" className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Cliente (opcional)
                  </Label>
                  <Select 
                    value={selectedCliente} 
                    onValueChange={setSelectedCliente}
                    disabled={mptImporting}
                  >
                    <SelectTrigger id="cliente-mpt" className="max-w-md">
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
                    <Label htmlFor="buscar-andamentos-mpt" className="flex items-center gap-2 font-medium">
                      <Clock className="h-4 w-4" />
                      Buscar andamentos na importação
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {mptBuscarAndamentos 
                        ? "Os andamentos serão buscados durante a importação e o processo ficará habilitado para monitoramento automático."
                        : "Os andamentos NÃO serão buscados e o processo ficará desabilitado para monitoramento."}
                    </p>
                  </div>
                  <Switch
                    id="buscar-andamentos-mpt"
                    checked={mptBuscarAndamentos}
                    onCheckedChange={setMptBuscarAndamentos}
                    disabled={mptImporting}
                  />
                </div>
                
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Colunas reconhecidas:</strong> PROCEDIMENTO (número do processo), LOCALIDADE, UF, AUTOR, REQUERIDO, MATÉRIA, ÚLTIMO ANDAMENTO, STATUS, Observação Advogado Responsável.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* MPT File Preview */}
            {mptFile && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <CardTitle>Pré-visualização MPT</CardTitle>
                      <CardDescription>
                        {mptProcessos.length} processo(s) encontrado(s) em "{mptFile.name}"
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      {mptProcessos.length > 0 && (
                        <div className="flex items-center gap-2 text-sm flex-wrap">
                          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">
                            {mptValidCount} importáveis
                          </Badge>
                          {mptWarningCount > 0 && (
                            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-200">
                              {mptWarningCount} com avisos
                            </Badge>
                          )}
                          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-200">
                            {mptInvalidCount} rejeitados
                          </Badge>
                          {mptSuccessCount > 0 && (
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-200">
                              {mptSuccessCount} importados
                            </Badge>
                          )}
                          {mptErrorCount > 0 && (
                            <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-200">
                              {mptErrorCount} erros
                            </Badge>
                          )}
                        </div>
                      )}
                      <div className="flex gap-2">
                        {mptImporting ? (
                          <Button 
                            variant="destructive" 
                            onClick={() => {
                              mptCancelledRef.current = true;
                            }}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Cancelar
                          </Button>
                        ) : (
                          <Button 
                            variant="outline" 
                            onClick={() => {
                              setMptFile(null);
                              setMptProcessos([]);
                              setMptProgress(0);
                            }}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Limpar
                          </Button>
                        )}
                        {mptTotalProblemas > 0 && (
                          <Button variant="outline" onClick={() => downloadMptRejeitados()}>
                            <FileDown className="h-4 w-4 mr-2" />
                            Baixar Problemas ({mptTotalProblemas})
                          </Button>
                        )}
                        <Button 
                          onClick={handleMptImport} 
                          disabled={mptImporting || mptValidCount === 0}
                        >
                          {mptImporting ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Importando...
                            </>
                          ) : (
                            <>
                              <Upload className="h-4 w-4 mr-2" />
                              Importar ({mptValidCount})
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                  {mptImporting && (
                    <Progress value={mptProgress} className="mt-4" />
                  )}
                </CardHeader>
                <CardContent>
                  {mptProcessos.length === 0 ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Nenhum processo encontrado na planilha. Verifique se é uma planilha no formato correto.
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
                              <TableHead>Procedimento</TableHead>
                              <TableHead>Autor</TableHead>
                              <TableHead>Requerido</TableHead>
                              <TableHead>UF</TableHead>
                              <TableHead>Status Proc.</TableHead>
                              <TableHead className="min-w-[300px]">Avisos/Erros</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {mptProcessos.map((processo, index) => (
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
                                <TableCell>{processo.estado || "-"}</TableCell>
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

          {/* Tab: Pedidos */}
          <TabsContent value="pedidos" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Importar Pedidos Trabalhistas
                </CardTitle>
                <CardDescription>
                  Importe processos de reclamações trabalhistas com detalhamento de pedidos. A coluna "Reclamado" será usada como Cliente.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">1. Baixe o modelo de planilha</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Utilize o modelo padrão para preencher os dados dos processos.
                  </p>
                  <Button variant="outline" onClick={downloadPedidosTemplate}>
                    <Download className="h-4 w-4 mr-2" />
                    Baixar Modelo Pedidos
                  </Button>
                </div>
                <div>
                  <h4 className="font-medium mb-2">2. Faça upload da planilha de Pedidos</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    A planilha deve conter as colunas: PROCESSO, RECLAMANTE, FUNÇÃO, SETOR, RECLAMADO, VARA, COMARCA, além das colunas de pedidos.
                  </p>
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handlePedidosFileChange}
                      className="max-w-xs"
                      disabled={pedidosImporting}
                    />
                    {pedidosFile && (
                      <Button variant="outline" onClick={clearPedidos} disabled={pedidosImporting}>
                        Limpar
                      </Button>
                    )}
                  </div>
                </div>

                {/* Coordenação Selection */}
                <div className="space-y-2">
                  <Label htmlFor="coordenacao-pedidos" className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Coordenação Responsável
                  </Label>
                  <Select 
                    value={selectedCoordenacao} 
                    onValueChange={(value) => {
                      setSelectedCoordenacao(value);
                      setSelectedMembro("");
                    }}
                    disabled={pedidosImporting}
                  >
                    <SelectTrigger id="coordenacao-pedidos" className="max-w-md">
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
                    <Label htmlFor="membro-pedidos" className="flex items-center gap-2">
                      Advogado Responsável (opcional)
                    </Label>
                    <Select 
                      value={selectedMembro} 
                      onValueChange={setSelectedMembro}
                      disabled={pedidosImporting}
                    >
                      <SelectTrigger id="membro-pedidos" className="max-w-md">
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

                {/* Opção de buscar andamentos */}
                <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30 max-w-md">
                  <div className="space-y-0.5">
                    <Label htmlFor="buscar-andamentos-pedidos" className="flex items-center gap-2 font-medium">
                      <Clock className="h-4 w-4" />
                      Buscar andamentos na importação
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {pedidosBuscarAndamentos 
                        ? "Os andamentos serão buscados durante a importação e o processo ficará habilitado para monitoramento automático."
                        : "Os andamentos NÃO serão buscados e o processo ficará desabilitado para monitoramento."}
                    </p>
                  </div>
                  <Switch
                    id="buscar-andamentos-pedidos"
                    checked={pedidosBuscarAndamentos}
                    onCheckedChange={setPedidosBuscarAndamentos}
                    disabled={pedidosImporting}
                  />
                </div>
                
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Colunas reconhecidas:</strong> PROCESSO, RECLAMANTE, FUNÇÃO, SETOR, RECLAMADO (salvo como cliente), VARA, COMARCA, Lei 13.467/2017, Responsabilidade Subsidiária, Horas Extras (Excesso Jornada, Plantões, Dobras, Intervalos, Domingos/Feriados), Insalubridade/Periculosidade, Diferenças Salariais, Adicional Noturno, Sobrecarga, Vínculo, Danos Morais (Assédio, Outros, Acidente), Acidente/Doença, Estabilidade, Multas, Status, Motivo Encerramento, Custo Encerramento.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>

            {/* Exportar Relatório de Pedidos */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileBarChart className="h-5 w-5" />
                  Exportar Relatório de Pedidos
                </CardTitle>
                <CardDescription>
                  Exporte um relatório Excel com os processos de pedidos já importados, filtrados por tipo.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="space-y-1">
                    <Label>Tipo de Pedido</Label>
                    <Select 
                      value={pedidosRelatorioTipo} 
                      onValueChange={(v) => setPedidosRelatorioTipo(v as TipoPedido)}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos os Pedidos</SelectItem>
                        <SelectItem value="horas_extras">Horas Extras</SelectItem>
                        <SelectItem value="adicionais">Adicionais e Benefícios</SelectItem>
                        <SelectItem value="danos_morais">Danos Morais</SelectItem>
                        <SelectItem value="acidente_doenca">Acidente / Doença</SelectItem>
                        <SelectItem value="estabilidade">Estabilidade e Justa Causa</SelectItem>
                        <SelectItem value="multas">Multas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button onClick={() => exportarRelatorioPedidos(pedidosRelatorioTipo)}>
                      <Download className="h-4 w-4 mr-2" />
                      Exportar Excel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pedidos File Preview */}
            {pedidosFile && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <CardTitle>Pré-visualização Pedidos</CardTitle>
                      <CardDescription>
                        {pedidosProcessos.length} processo(s) encontrado(s) em "{pedidosFile.name}"
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      {pedidosProcessos.length > 0 && (
                        <div className="flex items-center gap-2 text-sm flex-wrap">
                          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">
                            {pedidosValidCount} importáveis
                          </Badge>
                          {pedidosWarningCount > 0 && (
                            <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-200">
                              {pedidosWarningCount} com avisos
                            </Badge>
                          )}
                          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-200">
                            {pedidosInvalidCount} rejeitados
                          </Badge>
                          {pedidosSuccessCount > 0 && (
                            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-200">
                              {pedidosSuccessCount} importados
                            </Badge>
                          )}
                          {pedidosErrorCount > 0 && (
                            <Badge variant="outline" className="bg-orange-500/10 text-orange-600 border-orange-200">
                              {pedidosErrorCount} erros
                            </Badge>
                          )}
                        </div>
                      )}
                      <div className="flex gap-2">
                        {pedidosImporting ? (
                          <Button 
                            variant="destructive" 
                            onClick={() => {
                              pedidosCancelledRef.current = true;
                            }}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Cancelar
                          </Button>
                        ) : (
                          <Button 
                            variant="outline" 
                            onClick={() => {
                              setPedidosFile(null);
                              setPedidosProcessos([]);
                              setPedidosProgress(0);
                            }}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Limpar
                          </Button>
                        )}
                        {pedidosTotalProblemas > 0 && (
                          <Button variant="outline" onClick={() => downloadPedidosRejeitados()}>
                            <FileDown className="h-4 w-4 mr-2" />
                            Baixar Problemas ({pedidosTotalProblemas})
                          </Button>
                        )}
                        <Button 
                          onClick={handlePedidosImport} 
                          disabled={pedidosImporting || pedidosValidCount === 0}
                        >
                          {pedidosImporting ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Importando...
                            </>
                          ) : (
                            <>
                              <Upload className="h-4 w-4 mr-2" />
                              Importar ({pedidosValidCount})
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                  {pedidosImporting && (
                    <Progress value={pedidosProgress} className="mt-4" />
                  )}
                </CardHeader>
                <CardContent>
                  {pedidosProcessos.length === 0 ? (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Nenhum processo encontrado na planilha. Verifique se é uma planilha no formato correto.
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
                              <TableHead>Processo</TableHead>
                              <TableHead>Reclamante</TableHead>
                              <TableHead>Reclamado (Cliente)</TableHead>
                              <TableHead>Vara</TableHead>
                              <TableHead>Status Proc.</TableHead>
                              <TableHead className="min-w-[300px]">Avisos/Erros</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {pedidosProcessos.map((processo, index) => (
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
