import { useState, useCallback, useRef, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCoordenacoesFull } from "@/hooks/useCoordenacoes";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, XCircle, Loader2, Download, ListTodo, Users, UserPlus, FolderPlus, Calendar, Scale } from "lucide-react";
import * as XLSX from "xlsx";
import { ImportProgress, type ImportProgressState } from "@/components/tarefas/ImportProgress";

// ==================== INTERFACES ====================

interface TarefaImport {
  identificador: string;
  tipo: string | null;
  titulo: string;
  dataCriacao: string | null;
  horaCriacao: string | null;
  dataBase: string | null;
  dataPrevista: string | null;
  horaPrevista: string | null;
  dataFatal: string | null;
  horaFatal: string | null;
  dataConclusao: string | null;
  horaConclusao: string | null;
  situacao: string | null;
  linkLocal: string | null;
  descricao: string | null;
  responsaveis: string | null;
  gruposTrabalho: string | null;
  criadaPor: string | null;
  concluidaPor: string | null;
  marcadores: string | null;
  comentarios: string | null;
  identificadorTimesheet: string | null;
  totalHorasTimesheet: string | null;
  quadroKanban: string | null;
  modulo: string | null;
  identificadorModulo: string | null;
  numeroProcesso: string | null;
  assunto: string | null;
  situacaoProcesso: string | null;
  instancia: string | null;
  vara: string | null;
  fase: string | null;
  descricaoUltimoAndamento: string | null;
  partesAtivas: string | null;
  partesPassivas: string | null;
  outrasPartes: string | null;
  envolvimentoClientes: string | null;
  envolvimentoContrarios: string | null;
  pastaFisica: string | null;
  pastaCliente: string | null;
  orgao: string | null;
  orgaoJulgador: string | null;
  marcadoresVinculo: string | null;
  status: "pendente" | "valido" | "invalido" | "sucesso" | "erro";
  erros: string[];
  erroImport?: string;
  linhaOriginal: number;
}

interface TarefaAstreaImport {
  identificador: string;
  data: string | null;
  hora: string | null;
  tipo: string | null;
  responsavel: string | null;
  titulo: string;
  tituloProcesso: string | null;
  numeroProcesso: string | null;
  juizo: string | null;
  observacao: string | null;
  etiquetas: string | null;
  envolvidos: string | null;
  statusOrigem: string | null;
  prioridadeOrigem: string | null;
  dataConclusao: string | null;
  dataCriacao: string | null;
  status: "pendente" | "valido" | "invalido" | "sucesso" | "erro";
  erros: string[];
  erroImport?: string;
  linhaOriginal: number;
}

// ==================== UTILITY FUNCTIONS ====================

const parseDate = (dateValue: any): string | null => {
  if (!dateValue) return null;
  const str = String(dateValue).trim();
  if (!str) return null;
  
  // DD/MM/YYYY format
  const brMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (brMatch) {
    const [, day, month, year] = brMatch;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  
  // YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  
  return null;
};

const mapSituacaoToStatus = (situacao: string | null): "pendente" | "cumprido" | "atrasado" => {
  if (!situacao) return "pendente";
  const lower = situacao.toLowerCase().trim();
  
  if (lower.includes("conclu") || lower.includes("finaliz") || lower.includes("encerrad")) {
    return "cumprido";
  }
  if (lower.includes("atras") || lower.includes("vencid")) {
    return "atrasado";
  }
  return "pendente";
};

const mapSituacaoToPrioridade = (situacao: string | null, dataFatal: string | null): "baixa" | "media" | "alta" | "urgente" => {
  if (!situacao) {
    if (dataFatal) {
      const fatal = new Date(dataFatal);
      const today = new Date();
      const diffDays = Math.ceil((fatal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 2) return "urgente";
      if (diffDays <= 7) return "alta";
    }
    return "media";
  }
  
  const lower = situacao.toLowerCase();
  if (lower.includes("urgent")) return "urgente";
  if (lower.includes("alta") || lower.includes("prior")) return "alta";
  if (lower.includes("baixa")) return "baixa";
  return "media";
};

const mapAstreaTipoToTarefa = (tipo: string | null): string => {
  if (!tipo) return "Tarefa";
  const lower = tipo.toLowerCase();
  if (lower === "audiência" || lower === "audiencia") return "Audiência";
  if (lower === "evento") return "Evento";
  return tipo;
};

const normalizeColumnName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const getRowValue = (row: Record<string, any>, possibleNames: string[]): string => {
  const normalizedMap = new Map(
    Object.keys(row).map((key) => [normalizeColumnName(key), row[key]]),
  );
  for (const name of possibleNames) {
    const val = normalizedMap.get(normalizeColumnName(name));
    if (val !== undefined && val !== null) return String(val).trim();
  }
  return "";
};

const processoCacheKey = (coordenacaoId: string, numero: string) =>
  `${coordenacaoId}::${numero.replace(/[^0-9]/g, "")}`;

const shortStableHash = (value: string): string => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

// ==================== MAIN COMPONENT ====================

export default function ImportarTarefas() {
  const [activeTab, setActiveTab] = useState("projuris");
  
  // ========== PROJURIS STATE ==========
  const [file, setFile] = useState<File | null>(null);
  const [tarefas, setTarefas] = useState<TarefaImport[]>([]);
  const [parsing, setParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importState, setImportState] = useState<ImportProgressState>({
    phase: "idle",
    phaseLabel: "",
    phaseCurrent: 0,
    phaseTotal: 0,
    overall: 0,
    counters: { novosUsuarios: 0, novosProcessos: 0, sucesso: 0, erro: 0, atualizadas: 0, total: 0 },
  });
  const [selectedCoordenacao, setSelectedCoordenacao] = useState<string>("");
  const [importarConcluidas, setImportarConcluidas] = useState(true);
  const [vincularResponsaveis, setVincularResponsaveis] = useState(true);
  const [cadastrarNovosUsuarios, setCadastrarNovosUsuarios] = useState(true);
  const [cadastrarNovosProcessos, setCadastrarNovosProcessos] = useState(true);
  const [novosUsuariosCriados, setNovosUsuariosCriados] = useState<string[]>([]);
  const [novosProcessosCriados, setNovosProcessosCriados] = useState<string[]>([]);
  
  // ========== ASTREA STATE ==========
  const [astreaFile, setAstreaFile] = useState<File | null>(null);
  const [tarefasAstrea, setTarefasAstrea] = useState<TarefaAstreaImport[]>([]);
  const [astreaParsing, setAstreaParsing] = useState(false);
  const [astreaParseProgress, setAstreaParseProgress] = useState(0);
  const [astreaImporting, setAstreaImporting] = useState(false);
  const [astreaImportProgress, setAstreaImportProgress] = useState(0);
  const [astreaCoordenacao, setAstreaCoordenacao] = useState<string>("");
  const [astreaVincularResponsaveis, setAstreaVincularResponsaveis] = useState(true);
  const [astreaCadastrarNovosUsuarios, setAstreaCadastrarNovosUsuarios] = useState(true);
  const [astreaCadastrarNovosProcessos, setAstreaCadastrarNovosProcessos] = useState(true);
  const [astreaUsuariosCriados, setAstreaUsuariosCriados] = useState<string[]>([]);
  const [astreaProcessosCriados, setAstreaProcessosCriados] = useState<string[]>([]);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const cancelledRef = useRef(false);
  const astreaCancelledRef = useRef(false);
  const { user } = useAuth();

  // Cache of created users during import
  const createdUsersCache = useRef<Map<string, string>>(new Map());
  const createdProcessosCache = useRef<Map<string, string>>(new Map());

  const { data: coordenacoes = [] } = useCoordenacoesFull();
  
  // Fetch profiles for matching responsaveis
  const { data: profiles = [], refetch: refetchProfiles } = useQuery({
    queryKey: ["profiles-import"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch existing processos for matching
  const { data: processosMap, refetch: refetchProcessos } = useQuery({
    queryKey: ["processos-map-import"],
    queryFn: async () => {
      const map = new Map<string, string>();
      // PostgREST limita a 1000 linhas por requisição: paginar para carregar TODOS
      const PAGE = 1000;
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from("processos")
          .select("id, numero, coordenacao_id")
          .order("numero")
          .range(from, from + PAGE - 1);
        if (error) throw error;
        (data || []).forEach(p => {
          if (!p.numero) return;
          const normalized = p.numero.replace(/[^0-9]/g, "");
          const coord = p.coordenacao_id || "sem-coordenacao";
          if (normalized) map.set(`${coord}::${normalized}`, p.id);
        });
        if (!data || data.length < PAGE) break;
      }
      return map;
    },
    staleTime: 60000,
  });

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      astreaCancelledRef.current = true;
    };
  }, []);

  // ==================== SHARED FUNCTIONS ====================

  const createNewProfile = async (nomeCompleto: string, coordenacaoId: string): Promise<string | null> => {
    if (!nomeCompleto || !coordenacaoId) return null;
    
    const cachedId = createdUsersCache.current.get(nomeCompleto.toLowerCase());
    if (cachedId) return cachedId;

    try {
      // Use Edge Function to bypass RLS
      const { data, error } = await supabase.functions.invoke("cadastrar-perfil", {
        body: {
          nome: nomeCompleto,
          coordenacao_id: coordenacaoId,
          cargo: "Membro",
        },
      });

      if (error) {
        console.error("Erro ao criar perfil via Edge Function:", error);
        return null;
      }

      if (data?.profile?.id) {
        createdUsersCache.current.set(nomeCompleto.toLowerCase(), data.profile.id);
        return data.profile.id;
      }

      return null;
    } catch (err) {
      console.error("Erro ao criar perfil:", err);
      return null;
    }
  };

  const findResponsavelId = async (
    responsaveisStr: string | null, 
    vincular: boolean, 
    cadastrar: boolean, 
    coordenacaoId: string,
    onNewUser?: (nome: string) => void
  ): Promise<string | null> => {
    if (!responsaveisStr || !vincular) return null;
    
    const nomes = responsaveisStr.split(/[,;]/).map(n => n.trim());
    
    for (const nome of nomes) {
      if (!nome) continue;
      const nomeLower = nome.toLowerCase();
      
      const cachedId = createdUsersCache.current.get(nomeLower);
      if (cachedId) return cachedId;
      
      const profile = profiles.find(p => 
        p.nome.toLowerCase().includes(nomeLower) || 
        nomeLower.includes(p.nome.toLowerCase())
      );
      if (profile) return profile.id;
      
      if (cadastrar && coordenacaoId) {
        const newId = await createNewProfile(nome, coordenacaoId);
        if (newId) {
          onNewUser?.(nome);
          return newId;
        }
      }
    }
    return null;
  };

  const findProcessoId = (numeroProcesso: string | null, coordenacaoId: string): string | null => {
    if (!numeroProcesso || !coordenacaoId || !processosMap) return null;
    
    const normalized = numeroProcesso.replace(/[^0-9]/g, "");
    
    const key = processoCacheKey(coordenacaoId, numeroProcesso);
    const cachedId = createdProcessosCache.current.get(key);
    if (cachedId) return cachedId;
    
    return processosMap.get(key) || null;
  };

  const createNewProcesso = async (
    numeroProcesso: string,
    coordenacaoId: string,
    extras?: { 
      assunto?: string; 
      vara?: string; 
      fase?: string; 
      pastaFisica?: string; 
      pastaCliente?: string;
      instancia?: string;
      orgao?: string;
      orgaoJulgador?: string;
      situacaoProcesso?: string;
    }
  ): Promise<string | null> => {
    if (!numeroProcesso || !coordenacaoId) return null;
    
    const normalized = numeroProcesso.replace(/[^0-9]/g, "");
    
    const key = processoCacheKey(coordenacaoId, numeroProcesso);
    const cachedId = createdProcessosCache.current.get(key);
    if (cachedId) return cachedId;

    try {
      const { data: newProcesso, error } = await supabase
        .from("processos")
        .insert({
          numero: numeroProcesso,
          assunto: extras?.assunto || "Importado via tarefas",
          vara: extras?.vara || null,
          fase: extras?.fase || null,
          pasta_fisica: extras?.pastaFisica || null,
          pasta_cliente: extras?.pastaCliente || null,
          instancia: extras?.instancia || null,
          coordenacao_id: coordenacaoId,
          status: extras?.situacaoProcesso?.toLowerCase().includes("arquivado") ? "arquivado" : "ativo",
          area: "trabalhista",
        })
        .select("id")
        .single();

      if (error) {
        console.error("Erro ao criar processo:", error);
        return null;
      }

      if (newProcesso?.id) {
        createdProcessosCache.current.set(key, newProcesso.id);
        return newProcesso.id;
      }

      return null;
    } catch (err) {
      console.error("Erro ao criar processo:", err);
      return null;
    }
  };

  const findOrCreateProcessoId = async (
    numeroProcesso: string | null,
    coordenacaoId: string,
    cadastrar: boolean,
    extras?: { 
      assunto?: string; 
      vara?: string; 
      fase?: string; 
      pastaFisica?: string; 
      pastaCliente?: string;
      instancia?: string;
      orgao?: string;
      orgaoJulgador?: string;
      situacaoProcesso?: string;
    },
    onNewProcesso?: (numero: string) => void
  ): Promise<string | null> => {
    if (!numeroProcesso) return null;
    
    const existingId = findProcessoId(numeroProcesso, coordenacaoId);
    if (existingId) return existingId;
    
    // Fallback: consulta direta no banco (cache pode estar desatualizado)
    const digits = numeroProcesso.replace(/[^0-9]/g, "");
    if (digits.length >= 15) {
      const formatado = digits.length === 20
        ? `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`
        : null;
      const variantes = Array.from(new Set([numeroProcesso, formatado, digits].filter(Boolean) as string[]));
      const { data: found } = await supabase
        .from("processos")
        .select("id, numero")
        .eq("coordenacao_id", coordenacaoId)
        .in("numero", variantes)
        .limit(1);
      const foundId = found?.[0]?.id;
      if (foundId) {
        createdProcessosCache.current.set(processoCacheKey(coordenacaoId, numeroProcesso), foundId);
        return foundId;
      }
    }

    if (cadastrar && coordenacaoId) {
      const newId = await createNewProcesso(numeroProcesso, coordenacaoId, extras);
      if (newId) {
        onNewProcesso?.(numeroProcesso);
        return newId;
      }
    }
    
    return null;
  };

  const vincularResponsavelAoProcesso = async (processoId: string, usuarioId: string, coordenacaoId: string): Promise<void> => {
    try {
      const { data: existing } = await supabase
        .from("processos_responsaveis")
        .select("id")
        .eq("processo_id", processoId)
        .eq("usuario_id", usuarioId)
        .maybeSingle();
      
      if (existing) return;

      await supabase.from("processos_responsaveis").insert({
        processo_id: processoId,
        usuario_id: usuarioId,
        coordenacao_id: coordenacaoId || null,
        papel: "Responsável",
        ativo: true,
      });

      const { data: processo } = await supabase
        .from("processos")
        .select("advogado_responsavel_id")
        .eq("id", processoId)
        .single();
      
      if (processo && !processo.advogado_responsavel_id) {
        await supabase
          .from("processos")
          .update({ advogado_responsavel_id: usuarioId })
          .eq("id", processoId);
      }
    } catch (err) {
      console.error("Erro ao vincular responsável ao processo:", err);
    }
  };

  // ==================== PROJURIS FUNCTIONS ====================

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      parseFile(selectedFile);
    }
  }, []);

  const parseFile = async (file: File) => {
    setParsing(true);
    setParseProgress(0);
    setTarefas([]);

    try {
      const isCSV = file.name.toLowerCase().endsWith(".csv");
      const arrayBuffer = await file.arrayBuffer();
      setParseProgress(10);

      let rows: any[] = [];

      if (isCSV) {
        let text = new TextDecoder("utf-8").decode(arrayBuffer);
        if (text.includes("�")) {
          text = new TextDecoder("iso-8859-1").decode(arrayBuffer);
        }
        setParseProgress(30);

        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length === 0) throw new Error("Arquivo vazio");

        const headers = lines[0].split(";").map(h => h.trim().replace(/^"|"$/g, ""));
        
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(";").map(v => v.trim().replace(/^"|"$/g, ""));
          const row: any = {};
          headers.forEach((header, idx) => {
            row[header] = values[idx] || null;
          });
          rows.push(row);
        }
      } else {
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const sheetName = workbook.SheetNames?.[0];
        if (!sheetName) throw new Error("Planilha sem abas");
        
        const sheet = workbook.Sheets[sheetName];
        rows = XLSX.utils.sheet_to_json(sheet, { defval: null, range: 2 });
      }

      setParseProgress(60);

      const parsed: TarefaImport[] = rows.map((row, index): TarefaImport => {
        const identificador = String(row["Identificador da tarefa"] || "").trim();
        const titulo = String(row["Título"] || row["Titulo"] || "").trim();
        const situacao = String(row["Situação"] || row["Situacao"] || "").trim() || null;
        const dataFatal = row["Data fatal"] || null;
        
        const tarefa: TarefaImport = {
          identificador,
          tipo: row["Tipo de tarefa"] || null,
          titulo,
          dataCriacao: row["Data de criação"] || row["Data de criacao"] || null,
          horaCriacao: row["Hora de criação"] || row["Hora de criacao"] || null,
          dataBase: row["Data base"] || null,
          dataPrevista: row["Data prevista"] || null,
          horaPrevista: row["Hora prevista"] || null,
          dataFatal,
          horaFatal: row["Hora fatal"] || null,
          dataConclusao: row["Data da conclusão"] || row["Data da conclusao"] || null,
          horaConclusao: row["Hora da conclusão"] || row["Hora da conclusao"] || null,
          situacao,
          linkLocal: row["Link/Local"] || null,
          descricao: row["Descrição da tarefa"] || row["Descricao da tarefa"] || null,
          responsaveis: row["Responsáveis da tarefa"] || row["Responsaveis da tarefa"] || null,
          gruposTrabalho: row["Grupos de trabalho"] || null,
          criadaPor: row["Criada por"] || null,
          concluidaPor: row["Concluída por"] || row["Concluida por"] || null,
          marcadores: row["Marcadores"] || null,
          comentarios: row["Comentários"] || row["Comentarios"] || null,
          identificadorTimesheet: row["Identificador do timesheet"] || null,
          totalHorasTimesheet: row["Total de horas do timesheet"] || null,
          quadroKanban: row["Quadro Kanban"] || null,
          modulo: row["Módulo"] || row["Modulo"] || null,
          identificadorModulo: row["Identificador do módulo"] || row["Identificador do modulo"] || null,
          numeroProcesso: row["Número do processo"] || row["Numero do processo"] || null,
          assunto: row["Assunto"] || null,
          situacaoProcesso: row["Situação do processo"] || row["Situacao do processo"] || null,
          instancia: row["Instância"] || row["Instancia"] || null,
          vara: row["Vara"] || null,
          fase: row["Fase"] || null,
          descricaoUltimoAndamento: row["Descrição do último andamento"] || row["Descricao do ultimo andamento"] || null,
          partesAtivas: row["Envolvidos do processo (partes ativas)"] || null,
          partesPassivas: row["Envolvidos do processo (partes passivas)"] || null,
          outrasPartes: row["Envolvidos do processo (outras partes)"] || null,
          envolvimentoClientes: row["Envolvidos do atendimento (clientes)"] || null,
          envolvimentoContrarios: row["Envolvidos do atendimento (contrários)"] || row["Envolvidos do atendimento (contrarios)"] || null,
          pastaFisica: row["Pasta física"] || row["Pasta fisica"] || null,
          pastaCliente: row["Pasta do cliente"] || null,
          orgao: row["Órgão"] || row["Orgao"] || null,
          orgaoJulgador: row["Órgão julgador"] || row["Orgao julgador"] || null,
          marcadoresVinculo: row["Marcadores do vínculo"] || row["Marcadores do vinculo"] || null,
          status: "pendente",
          erros: [],
          linhaOriginal: index + 2,
        };

        if (!identificador) tarefa.erros.push("Sem identificador");
        if (!titulo) tarefa.erros.push("Sem título");

        tarefa.status = "valido";
        return tarefa;
      }).filter(t => t.identificador && t.identificador !== "Identificador da tarefa");

      setParseProgress(100);
      setTarefas(parsed);

      const validCount = parsed.filter(t => t.status === "valido").length;
      const invalidCount = parsed.filter(t => t.status === "invalido").length;

      toast({
        title: "Arquivo carregado",
        description: `${parsed.length} tarefa(s): ${validCount} válida(s), ${invalidCount} com erro(s).`,
        variant: invalidCount > 0 ? "destructive" : "default",
      });
    } catch (err: any) {
      toast({
        title: "Erro ao ler arquivo",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setParsing(false);
    }
  };

  const handleImport = async () => {
    const toImport = tarefas.filter(t => {
      if (t.status !== "valido") return false;
      if (!importarConcluidas && mapSituacaoToStatus(t.situacao) === "cumprido") return false;
      return true;
    });

    if (toImport.length === 0) {
      toast({
        title: "Nenhuma tarefa para importar",
        description: "Verifique os filtros e erros de validação.",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    setImportProgress(0);
    cancelledRef.current = false;

    const updatedTarefas = [...tarefas];
    const startedAt = Date.now();
    const counters = { novosUsuarios: 0, novosProcessos: 0, sucesso: 0, erro: 0, atualizadas: 0, total: toImport.length };
    const novosUsuariosLocal: string[] = [];
    const novosProcessosLocal: string[] = [];

    // Weights for overall progress (must sum to 100)
    const W = { processos: 10, responsaveis: 15, tarefas: 60, vinculos: 15 };

    const updateState = (patch: Partial<ImportProgressState>) =>
      setImportState(prev => ({ ...prev, ...patch, counters: { ...counters }, startedAt }));

    updateState({
      phase: "preparing",
      phaseLabel: "Preparando",
      phaseCurrent: 0,
      phaseTotal: 1,
      overall: 0,
      detail: `Analisando ${toImport.length.toLocaleString()} tarefa(s)...`,
    });

    createdUsersCache.current.clear();
    createdProcessosCache.current.clear();
    setNovosUsuariosCriados([]);
    setNovosProcessosCriados([]);

    // Helper: promise pool with concurrency limit
    async function runPool<T>(items: T[], limit: number, fn: (item: T, idx: number) => Promise<void>) {
      let i = 0;
      const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (true) {
          if (cancelledRef.current) return;
          const idx = i++;
          if (idx >= items.length) return;
          try { await fn(items[idx], idx); } catch (e) { console.error("pool item failed", e); }
        }
      });
      await Promise.all(workers);
    }

    try {
      // ============ FETCH EXISTING TAREFAS ============
      const allIds = toImport.map(t => t.identificador).filter(Boolean);
      const existingMap = new Map<string, { id: string; tipo_tarefa: string | null; titulo: string }>();
      for (let i = 0; i < allIds.length; i += 500) {
        const chunk = allIds.slice(i, i + 500);
        const { data } = await supabase
          .from("tarefas")
          .select("id, identificador_projuris, tipo_tarefa, titulo")
          .in("identificador_projuris", chunk);
        (data || []).forEach((t: any) => {
          if (t.identificador_projuris) existingMap.set(t.identificador_projuris, { id: t.id, tipo_tarefa: t.tipo_tarefa, titulo: t.titulo });
        });
      }

      // ============ PHASE 1: PROCESSOS ============
      const uniqueProcessos = new Map<string, TarefaImport>(); // normalized -> first tarefa (for extras)
      for (const t of toImport) {
        if (!t.numeroProcesso) continue;
        const norm = t.numeroProcesso.replace(/[^0-9]/g, "");
        if (!norm) continue;
        if (!uniqueProcessos.has(norm)) uniqueProcessos.set(norm, t);
      }
      const processosList = Array.from(uniqueProcessos.entries());

      updateState({
        phase: "processos",
        phaseLabel: "Resolvendo processos",
        phaseCurrent: 0,
        phaseTotal: processosList.length,
        overall: 0,
        detail: `${processosList.length} processo(s) únicos na planilha`,
      });

      // Busca em lotes os processos já existentes NA COORDENAÇÃO selecionada
      // (o mesmo número pode existir em outra coordenação — regra igual ao Astrea)
      if (selectedCoordenacao && processosList.length > 0) {
        const variantesPorNorm = new Map<string, string[]>();
        for (const [norm, t] of processosList) {
          const bruto = t.numeroProcesso!;
          const digits = bruto.replace(/[^0-9]/g, "");
          variantesPorNorm.set(norm, Array.from(new Set([bruto, digits].filter(Boolean))));
        }
        const todasVariantes = Array.from(new Set(Array.from(variantesPorNorm.values()).flat()));
        for (let i = 0; i < todasVariantes.length; i += 300) {
          if (cancelledRef.current) break;
          const chunk = todasVariantes.slice(i, i + 300);
          const { data: achados } = await supabase
            .from("processos")
            .select("id, numero")
            .eq("coordenacao_id", selectedCoordenacao)
            .in("numero", chunk);
          for (const row of (achados as any[]) || []) {
            const norm = String(row.numero || "").replace(/[^0-9]/g, "");
            if (norm) {
              createdProcessosCache.current.set(`${selectedCoordenacao}::${norm}`, row.id);
            }
          }
        }
      }

      // Pre-fill cache with existing matches from processosMap
      const toCreate: typeof processosList = [];
      for (const [norm, t] of processosList) {
        if (cancelledRef.current) break;
        const cacheKey = selectedCoordenacao ? processoCacheKey(selectedCoordenacao, t.numeroProcesso!) : "";
        const existingId = selectedCoordenacao
          ? createdProcessosCache.current.get(cacheKey) || processosMap?.get(cacheKey) || null
          : null;
        if (existingId) {
          createdProcessosCache.current.set(processoCacheKey(selectedCoordenacao, t.numeroProcesso!), existingId);
        } else if (cadastrarNovosProcessos && selectedCoordenacao) {
          toCreate.push([norm, t]);
        }
      }

      // Bulk insert new processos in chunks of 200
      let createdProcessoCount = 0;
      for (let i = 0; i < toCreate.length; i += 200) {
        if (cancelledRef.current) break;
        const chunk = toCreate.slice(i, i + 200);
        const payload = chunk.map(([, t]) => ({
          numero: t.numeroProcesso!,
          assunto: t.assunto || "Importado via tarefas",
          vara: t.vara || null,
          fase: t.fase || null,
          pasta_fisica: t.pastaFisica || null,
          pasta_cliente: t.pastaCliente || null,
          instancia: t.instancia || null,
          coordenacao_id: selectedCoordenacao,
          status: t.situacaoProcesso?.toLowerCase().includes("arquivado") ? "arquivado" : "ativo",
          area: "trabalhista",
        }));
        const { data: inserted, error } = await supabase
          .from("processos")
          .insert(payload as any)
          .select("id, numero");
        if (!error && inserted) {
          (inserted as any[]).forEach(row => {
            const norm = row.numero.replace(/[^0-9]/g, "");
            createdProcessosCache.current.set(processoCacheKey(selectedCoordenacao, row.numero), row.id);
            novosProcessosLocal.push(row.numero);
            counters.novosProcessos++;
          });
        } else if (error) {
          // Fallback per-item to isolate failures
          for (const [, t] of chunk) {
            const newId = await createNewProcesso(t.numeroProcesso!, selectedCoordenacao, {
              assunto: t.assunto || undefined,
              vara: t.vara || undefined,
              fase: t.fase || undefined,
              pastaFisica: t.pastaFisica || undefined,
              pastaCliente: t.pastaCliente || undefined,
              instancia: t.instancia || undefined,
              orgao: t.orgao || undefined,
              orgaoJulgador: t.orgaoJulgador || undefined,
              situacaoProcesso: t.situacaoProcesso || undefined,
            });
            if (newId) {
              novosProcessosLocal.push(t.numeroProcesso!);
              counters.novosProcessos++;
            }
          }
        }
        createdProcessoCount += chunk.length;
        updateState({
          phase: "processos",
          phaseLabel: "Resolvendo processos",
          phaseCurrent: createdProcessoCount,
          phaseTotal: processosList.length,
          overall: W.processos * (createdProcessoCount / Math.max(1, processosList.length)),
          detail: `${counters.novosProcessos} novo(s) processo(s) criado(s)`,
        });
      }
      setNovosProcessosCriados([...novosProcessosLocal]);

      // ============ PHASE 2: RESPONSAVEIS ============
      const normNome = (v: string) =>
        String(v || "")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .toUpperCase();

      // Nomes únicos (sem repetir), preservando o nome original da planilha
      const nomesUnicos = new Map<string, string>();
      if (vincularResponsaveis) {
        for (const t of toImport) {
          if (!t.responsaveis) continue;
          for (const nome of t.responsaveis.split(/[,;]/).map(n => n.trim()).filter(Boolean)) {
            const key = normNome(nome);
            if (key && !nomesUnicos.has(key)) nomesUnicos.set(key, nome);
          }
        }
      }
      const nomesArr = Array.from(nomesUnicos.keys());
      const respMap = new Map<string, string>(); // nome normalizado -> profile id

      updateState({
        phase: "responsaveis",
        phaseLabel: "Resolvendo responsáveis",
        phaseCurrent: 0,
        phaseTotal: nomesArr.length,
        overall: W.processos,
        detail: `${nomesArr.length} responsável(eis) únicos`,
      });

      // Perfis já vinculados À COORDENAÇÃO selecionada (o mesmo nome pode existir
      // em outra coordenação; nesse caso cadastramos/vinculamos nesta)
      if (nomesArr.length > 0 && selectedCoordenacao) {
        const { data: membros } = await supabase
          .from("membros_coordenacao")
          .select("usuario_id, profiles:usuario_id(id, nome)")
          .eq("coordenacao_id", selectedCoordenacao);
        for (const m of (membros as any[]) || []) {
          const nome = m?.profiles?.nome;
          if (nome) respMap.set(normNome(nome), m.profiles.id);
        }
      }

      const nomesToCreate = nomesArr.filter(key => !respMap.has(key));
      let createdUserCount = 0;
      if (nomesToCreate.length > 0 && cadastrarNovosUsuarios && selectedCoordenacao) {
        // Cadastro em lote (100 por chamada) — cria o perfil ou apenas vincula à coordenação
        for (let i = 0; i < nomesToCreate.length; i += 100) {
          if (cancelledRef.current) break;
          const lote = nomesToCreate.slice(i, i + 100);
          const { data: loteResult, error: loteError } = await supabase.functions.invoke(
            "cadastrar-perfis-lote",
            {
              body: {
                perfis: lote.map(key => ({
                  nome: nomesUnicos.get(key)!,
                  coordenacao_id: selectedCoordenacao,
                  cargo: "Membro",
                })),
              },
            }
          );
          if (!loteError && loteResult?.resultados) {
            for (const [nome, id] of Object.entries(loteResult.resultados)) {
              const key = normNome(nome as string);
              if (!respMap.has(key)) {
                novosUsuariosLocal.push(nome as string);
                counters.novosUsuarios++;
              }
              respMap.set(key, id as string);
            }
          } else if (loteError) {
            // Fallback individual
            for (const key of lote) {
              const id = await createNewProfile(nomesUnicos.get(key)!, selectedCoordenacao);
              if (id) {
                respMap.set(key, id);
                novosUsuariosLocal.push(nomesUnicos.get(key)!);
                counters.novosUsuarios++;
              }
            }
          }
          createdUserCount += lote.length;
          updateState({
            phase: "responsaveis",
            phaseLabel: "Resolvendo responsáveis",
            phaseCurrent: nomesArr.length - nomesToCreate.length + createdUserCount,
            phaseTotal: nomesArr.length,
            overall: W.processos + W.responsaveis * (createdUserCount / Math.max(1, nomesToCreate.length)),
            detail: `${counters.novosUsuarios} novo(s) usuário(s) criado(s)`,
          });
        }
      }

      // Espelha no cache compartilhado
      for (const [key, id] of respMap) createdUsersCache.current.set(key.toLowerCase(), id);
      setNovosUsuariosCriados([...novosUsuariosLocal]);

      if (cancelledRef.current) throw new Error("__cancelled__");

      // ============ PHASE 3: INSERIR / ATUALIZAR TAREFAS ============
      const toInsert: Array<{ payload: any; processoId: string | null; responsavelId: string | null; idx: number }> = [];
      const toUpdate: Array<{ id: string; payload: any; idx: number; tarefa: TarefaImport }> = [];

      const resolveResponsavel = (responsaveisStr: string | null): string | null => {
        if (!responsaveisStr || !vincularResponsaveis) return null;
        for (const nome of responsaveisStr.split(/[,;]/).map(n => n.trim()).filter(Boolean)) {
          const id = respMap.get(normNome(nome));
          if (id) return id;
        }
        return null;
      };

      const resolveProcesso = (numero: string | null): string | null => {
        if (!numero) return null;
        const norm = numero.replace(/[^0-9]/g, "");
        if (!selectedCoordenacao) return null;
        const key = processoCacheKey(selectedCoordenacao, numero);
        return createdProcessosCache.current.get(key) || processosMap?.get(key) || null;
      };

      for (const t of toImport) {
        const tipoPrefix = t.tipo ? `[${t.tipo.toUpperCase()}] ` : "";
        const tituloCompleto = `${tipoPrefix}${t.titulo || "Tarefa sem título"}`;
        const idx = updatedTarefas.findIndex(ut => ut.identificador === t.identificador);
        const existing = existingMap.get(t.identificador);

        if (existing) {
          const updatePayload: any = {};
          if (t.tipo) {
            updatePayload.tipo_tarefa = t.tipo;
            if (!existing.titulo?.toUpperCase().includes(`[${t.tipo.toUpperCase()}]`)) {
              updatePayload.titulo = tituloCompleto;
            }
          }
          const dataVencimentoUpdate = parseDate(t.dataPrevista) || parseDate(t.dataFatal);
          if (dataVencimentoUpdate) updatePayload.data_vencimento = dataVencimentoUpdate;
          const dPrev = parseDate(t.dataPrevista);
          if (dPrev) updatePayload.data_prevista = dPrev;
          const dFatal = parseDate(t.dataFatal);
          if (dFatal) updatePayload.data_fatal = dFatal;
          const dBase = parseDate(t.dataBase);
          if (dBase) updatePayload.data_base = dBase;
          const dCri = parseDate(t.dataCriacao);
          if (dCri) updatePayload.data_criacao_projuris = dCri;
          const dConc = parseDate(t.dataConclusao);
          if (dConc) updatePayload.data_cumprimento = dConc;

          if (Object.keys(updatePayload).length > 0) {
            toUpdate.push({ id: existing.id, payload: updatePayload, idx, tarefa: t });
          } else if (idx >= 0) {
            updatedTarefas[idx] = { ...updatedTarefas[idx], status: "erro", erroImport: "Já existe, sem dados para atualizar" };
            counters.erro++;
          }
          continue;
        }

        const status = mapSituacaoToStatus(t.situacao);
        const dataVencimento = parseDate(t.dataPrevista) || parseDate(t.dataFatal);
        const processoId = resolveProcesso(t.numeroProcesso);
        const responsavelId = resolveResponsavel(t.responsaveis);

        toInsert.push({
          processoId,
          responsavelId,
          idx,
          payload: {
            identificador_projuris: t.identificador || `auto-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            tipo_tarefa: t.tipo,
            titulo: tituloCompleto,
            descricao: t.descricao,
            data_vencimento: dataVencimento,
            data_prevista: parseDate(t.dataPrevista),
            data_base: parseDate(t.dataBase),
            data_fatal: parseDate(t.dataFatal),
            data_criacao_projuris: parseDate(t.dataCriacao),
            data_cumprimento: status === "cumprido" ? parseDate(t.dataConclusao) : null,
            status,
            prioridade: mapSituacaoToPrioridade(t.situacao, t.dataFatal),
            responsavel_id: responsavelId,
            processo_id: processoId,
            observacoes: t.comentarios,
            criado_por_nome: t.criadaPor,
            concluido_por_nome: t.concluidaPor,
            grupos_trabalho: t.gruposTrabalho,
            marcadores: t.marcadores,
            quadro_kanban: t.quadroKanban,
            criado_por: user?.id || null,
            origem: "projuris",
            hora_criacao: t.horaCriacao,
            hora_prevista: t.horaPrevista,
            hora_fatal: t.horaFatal,
            hora_conclusao: t.horaConclusao,
            link_local: t.linkLocal,
            identificador_timesheet: t.identificadorTimesheet,
            total_horas_timesheet: t.totalHorasTimesheet,
            modulo: t.modulo,
            identificador_modulo: t.identificadorModulo,
            situacao_processo: t.situacaoProcesso,
            instancia: t.instancia,
            descricao_ultimo_andamento: t.descricaoUltimoAndamento,
            partes_ativas: t.partesAtivas,
            partes_passivas: t.partesPassivas,
            outras_partes: t.outrasPartes,
            envolvimento_clientes: t.envolvimentoClientes,
            envolvimento_contrarios: t.envolvimentoContrarios,
            orgao: t.orgao,
            orgao_julgador: t.orgaoJulgador,
            marcadores_vinculo: t.marcadoresVinculo,
          },
        });
      }

      const totalPhase3 = toInsert.length + toUpdate.length;
      let phase3Done = 0;
      updateState({
        phase: "tarefas",
        phaseLabel: "Inserindo/atualizando tarefas",
        phaseCurrent: 0,
        phaseTotal: totalPhase3,
        overall: W.processos + W.responsaveis,
        detail: `${toInsert.length.toLocaleString()} nova(s), ${toUpdate.length.toLocaleString()} atualização(ões)`,
      });

      // INSERT in chunks of 200, fallback splits on error
      async function insertChunk(items: typeof toInsert): Promise<void> {
        if (items.length === 0 || cancelledRef.current) return;
        const { error } = await supabase.from("tarefas").insert(items.map(i => i.payload) as any);
        if (!error) {
          for (const it of items) {
            if (it.idx >= 0) updatedTarefas[it.idx] = { ...updatedTarefas[it.idx], status: "sucesso" };
            counters.sucesso++;
          }
        } else if (items.length === 1) {
          const it = items[0];
          if (it.idx >= 0) updatedTarefas[it.idx] = { ...updatedTarefas[it.idx], status: "erro", erroImport: error.message };
          counters.erro++;
        } else {
          // Split & retry
          const mid = Math.floor(items.length / 2);
          await insertChunk(items.slice(0, mid));
          await insertChunk(items.slice(mid));
          return;
        }
        phase3Done += items.length;
        updateState({
          phase: "tarefas",
          phaseLabel: "Inserindo/atualizando tarefas",
          phaseCurrent: phase3Done,
          phaseTotal: totalPhase3,
          overall: W.processos + W.responsaveis + W.tarefas * (phase3Done / Math.max(1, totalPhase3)),
          detail: `Lote ${Math.ceil(phase3Done / 200)} de ~${Math.ceil(totalPhase3 / 200)}`,
        });
      }

      for (let i = 0; i < toInsert.length; i += 200) {
        if (cancelledRef.current) break;
        await insertChunk(toInsert.slice(i, i + 200));
        setTarefas([...updatedTarefas]);
      }

      // UPDATES via promise pool (concurrency 8)
      await runPool(toUpdate, 8, async (item) => {
        const { error } = await supabase.from("tarefas").update(item.payload).eq("id", item.id);
        if (item.idx >= 0) {
          if (error) {
            updatedTarefas[item.idx] = { ...updatedTarefas[item.idx], status: "erro", erroImport: error.message };
            counters.erro++;
          } else {
            updatedTarefas[item.idx] = { ...updatedTarefas[item.idx], status: "sucesso", erroImport: "Atualizado (datas/tipo)" };
            counters.atualizadas++;
          }
        }
        phase3Done++;
        if (phase3Done % 25 === 0 || phase3Done === totalPhase3) {
          updateState({
            phase: "tarefas",
            phaseLabel: "Inserindo/atualizando tarefas",
            phaseCurrent: phase3Done,
            phaseTotal: totalPhase3,
            overall: W.processos + W.responsaveis + W.tarefas * (phase3Done / Math.max(1, totalPhase3)),
            detail: `Atualizando tarefas existentes`,
          });
          setTarefas([...updatedTarefas]);
        }
      });
      setTarefas([...updatedTarefas]);

      if (cancelledRef.current) throw new Error("__cancelled__");

      // ============ PHASE 4: VINCULAR RESPONSAVEIS AOS PROCESSOS ============
      const pares = new Map<string, { processoId: string; usuarioId: string }>();
      for (const it of toInsert) {
        if (it.processoId && it.responsavelId) {
          pares.set(`${it.processoId}|${it.responsavelId}`, { processoId: it.processoId, usuarioId: it.responsavelId });
        }
      }
      const paresArr = Array.from(pares.values());

      updateState({
        phase: "vinculos",
        phaseLabel: "Vinculando responsáveis aos processos",
        phaseCurrent: 0,
        phaseTotal: paresArr.length,
        overall: W.processos + W.responsaveis + W.tarefas,
        detail: `${paresArr.length} vínculo(s) potenciais`,
      });

      if (paresArr.length > 0) {
        // Pre-fetch existing pairs
        const procIds = Array.from(new Set(paresArr.map(p => p.processoId)));
        const existingPairs = new Set<string>();
        for (let i = 0; i < procIds.length; i += 200) {
          const chunk = procIds.slice(i, i + 200);
          const { data } = await supabase
            .from("processos_responsaveis")
            .select("processo_id, usuario_id")
            .in("processo_id", chunk);
          (data || []).forEach((r: any) => existingPairs.add(`${r.processo_id}|${r.usuario_id}`));
        }

        const newPairs = paresArr.filter(p => !existingPairs.has(`${p.processoId}|${p.usuarioId}`));
        for (let i = 0; i < newPairs.length; i += 200) {
          if (cancelledRef.current) break;
          const chunk = newPairs.slice(i, i + 200);
          await supabase.from("processos_responsaveis").insert(
            chunk.map(p => ({
              processo_id: p.processoId,
              usuario_id: p.usuarioId,
              coordenacao_id: selectedCoordenacao || null,
              papel: "Responsável",
              ativo: true,
            })) as any
          );
          updateState({
            phase: "vinculos",
            phaseLabel: "Vinculando responsáveis aos processos",
            phaseCurrent: Math.min(paresArr.length, i + chunk.length),
            phaseTotal: paresArr.length,
            overall: W.processos + W.responsaveis + W.tarefas + W.vinculos * ((i + chunk.length) / Math.max(1, newPairs.length || 1)),
            detail: `Criados ${i + chunk.length} de ${newPairs.length}`,
          });
        }
      }

      updateState({
        phase: "done",
        phaseLabel: "Concluído",
        phaseCurrent: counters.total,
        phaseTotal: counters.total,
        overall: 100,
        detail: `${counters.sucesso} inserida(s), ${counters.atualizadas} atualizada(s), ${counters.erro} erro(s)`,
      });
    } catch (err: any) {
      if (err?.message !== "__cancelled__") {
        console.error("Erro na importação:", err);
        toast({ title: "Erro na importação", description: err?.message || String(err), variant: "destructive" });
      }
    }

    setImporting(false);
    setImportProgress(100);
    queryClient.invalidateQueries({ queryKey: ["prazos"] });
    queryClient.invalidateQueries({ queryKey: ["tarefas"] });
    queryClient.invalidateQueries({ queryKey: ["profiles-import"] });
    queryClient.invalidateQueries({ queryKey: ["processos"] });
    queryClient.invalidateQueries({ queryKey: ["processos-map-import"] });

    if (novosUsuariosLocal.length > 0) {
      refetchProfiles();
    }

    const descParts = [`${counters.sucesso} tarefa(s) inserida(s)`];
    if (counters.atualizadas > 0) descParts.push(`${counters.atualizadas} atualizada(s)`);
    if (counters.erro > 0) descParts.push(`${counters.erro} erro(s)/duplicada(s)`);
    if (counters.novosUsuarios > 0) descParts.push(`${counters.novosUsuarios} usuário(s) criado(s)`);
    if (counters.novosProcessos > 0) descParts.push(`${counters.novosProcessos} processo(s) criado(s)`);
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    descParts.push(`em ${elapsed}s`);

    toast({
      title: cancelledRef.current ? "Importação cancelada" : "Importação concluída",
      description: descParts.join(". ") + ".",
      variant: counters.erro > 0 && counters.sucesso === 0 ? "destructive" : "default",
    });
  };

  const handleCancel = () => {
    cancelledRef.current = true;
    toast({
      title: "Importação cancelada",
      description: "Os registros já processados permanecem no banco.",
    });
  };

  const clearProjuris = () => {
    setFile(null);
    setTarefas([]);
    setParseProgress(0);
    setImportProgress(0);
    setNovosUsuariosCriados([]);
    setNovosProcessosCriados([]);
    createdUsersCache.current.clear();
    createdProcessosCache.current.clear();
    setImportState({
      phase: "idle",
      phaseLabel: "",
      phaseCurrent: 0,
      phaseTotal: 0,
      overall: 0,
      counters: { novosUsuarios: 0, novosProcessos: 0, sucesso: 0, erro: 0, atualizadas: 0, total: 0 },
    });
  };

  const downloadTemplate = () => {
    const headers = [
      "Identificador da tarefa", "Tipo de tarefa", "Título", "Data de criação",
      "Data base", "Data prevista", "Data fatal", "Data da conclusão", "Situação",
      "Descrição da tarefa", "Responsáveis da tarefa", "Grupos de trabalho",
      "Criada por", "Concluída por", "Marcadores", "Comentários", "Quadro Kanban",
      "Número do processo", "Assunto", "Vara", "Fase", "Pasta física", "Pasta do cliente",
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tarefas");
    XLSX.writeFile(wb, "MODELO_IMPORTACAO_TAREFAS.xlsx");
  };

  // ==================== ASTREA FUNCTIONS ====================

  const handleAstreaFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setAstreaFile(selectedFile);
      parseAstreaFile(selectedFile);
    }
  }, []);

  const parseAstreaFile = async (file: File) => {
    setAstreaParsing(true);
    setAstreaParseProgress(0);
    setTarefasAstrea([]);

    try {
      const arrayBuffer = await file.arrayBuffer();
      setAstreaParseProgress(20);

      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheetName = workbook.SheetNames?.[0];
      if (!sheetName) throw new Error("Planilha sem abas");
      
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

      setAstreaParseProgress(60);

      const legacyIdentifiers = new Set<string>();
      const parsed: TarefaAstreaImport[] = rows.map((row: any, index): TarefaAstreaImport => {
        const data = getRowValue(row, ["Data"]);
        const hora = getRowValue(row, ["Hora"]);
        const tipo = getRowValue(row, ["Tipo"]);
        const responsavel = getRowValue(row, ["Responsável", "Responsavel"]);
        const titulo = getRowValue(row, ["Título", "Titulo"]);
        const tituloProcesso = getRowValue(row, ["Título do processo/caso/atendimento", "Titulo do processo/caso/atendimento"]);
        const numeroProcesso = getRowValue(row, [
          "Número do processo",
          "Numero do processo",
          "Número do processo/caso",
          "Numero do processo/caso",
          "Número do processo/caso/atendimento",
          "Numero do processo/caso/atendimento",
          "Processo",
          "Nº do processo",
          "N° do processo",
        ]);
        const juizo = getRowValue(row, ["Juízo", "Juizo"]);
        const observacao = getRowValue(row, ["Observação da atividade", "Observacao da atividade"]);
        const etiquetas = getRowValue(row, ["Etiquetas"]);
        const envolvidos = getRowValue(row, ["Envolvidos"]);
        const statusOrigem = getRowValue(row, ["Status"]);
        const prioridadeOrigem = getRowValue(row, ["Prioridade"]);
        const dataCriacao = getRowValue(row, ["Data de criação", "Data de criacao"]);
        const dataConclusao = getRowValue(row, ["Data de conclusão", "Data de conclusao"]);

        // Generate unique identifier based on data+hora+titulo+processo
        const legacyIdentifier = `astrea-${data}-${hora}-${titulo}-${numeroProcesso}`.replace(/[^a-zA-Z0-9-]/g, "_").substring(0, 100);
        // Mantém compatibilidade com importações anteriores. Apenas colisões reais
        // ganham um sufixo estável, preservando atividades distintas do mesmo dia.
        const collisionSuffix = shortStableHash(`${dataCriacao}|${dataConclusao}|${observacao}|${index}`);
        const identificador = legacyIdentifiers.has(legacyIdentifier)
          ? `${legacyIdentifier.slice(0, 90)}-${collisionSuffix}`
          : legacyIdentifier;
        legacyIdentifiers.add(legacyIdentifier);

        const tarefa: TarefaAstreaImport = {
          identificador,
          data: data || null,
          hora: hora || null,
          tipo: tipo || null,
          responsavel: responsavel || null,
          titulo: titulo || "Sem título",
          tituloProcesso: tituloProcesso || null,
          numeroProcesso: numeroProcesso || null,
          juizo: juizo || null,
          observacao: observacao || null,
          etiquetas: etiquetas || null,
          envolvidos: envolvidos || null,
          statusOrigem: statusOrigem || null,
          prioridadeOrigem: prioridadeOrigem || null,
          dataConclusao: dataConclusao || null,
          dataCriacao: dataCriacao || null,
          status: "pendente",
          erros: [],
          linhaOriginal: index + 2,
        };

        if (!titulo) tarefa.erros.push("Sem título");
        if (!data) tarefa.erros.push("Sem data");

        tarefa.status = "valido";
        return tarefa;
      }).filter(t => t.titulo && t.titulo !== "Título" && t.data);

      setAstreaParseProgress(100);
      setTarefasAstrea(parsed);

      toast({
        title: "Arquivo Astrea carregado",
        description: `${parsed.length} tarefa(s) encontrada(s).`,
      });
    } catch (err: any) {
      toast({
        title: "Erro ao ler arquivo",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setAstreaParsing(false);
    }
  };

  const handleAstreaImport = async () => {
    const toImport = tarefasAstrea.filter(t => t.status === "valido");

    if (toImport.length === 0) {
      toast({
        title: "Nenhuma tarefa para importar",
        description: "Verifique os erros de validação.",
        variant: "destructive",
      });
      return;
    }

    setAstreaImporting(true);
    setAstreaImportProgress(0);
    astreaCancelledRef.current = false;

    const updatedTarefas = [...tarefasAstrea];
    let successCount = 0;
    let errorCount = 0;

    createdUsersCache.current.clear();
    createdProcessosCache.current.clear();
    setAstreaUsuariosCriados([]);
    setAstreaProcessosCriados([]);

    const mapStatus = (s: string | null): "pendente" | "cumprido" | "atrasado" | "cancelado" => {
      if (!s) return "pendente";
      const l = s.toLowerCase();
      if (l.includes("conclu") || l.includes("finaliz") || l.includes("encerrad") || l.includes("realiz")) return "cumprido";
      if (l.includes("cancel")) return "cancelado";
      if (l.includes("atras") || l.includes("vencid")) return "atrasado";
      return "pendente";
    };
    const mapPrio = (p: string | null): "baixa" | "media" | "alta" | "urgente" => {
      if (!p) return "media";
      const l = p.toLowerCase();
      if (l.includes("urgent")) return "urgente";
      if (l.includes("alta") || l.includes("prior")) return "alta";
      if (l.includes("baixa")) return "baixa";
      return "media";
    };
    const parseDateTimeBR = (s: string | null): string | null => {
      if (!s) return null;
      // "DD/MM/YYYY - HH:mm" or "DD/MM/YYYY HH:mm"
      const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s*[-\s]\s*(\d{1,2}):(\d{2}))?/);
      if (!m) return null;
      const [, d, mo, y, hh, mm] = m;
      const iso = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}T${(hh || "00").padStart(2, "0")}:${mm || "00"}:00`;
      return iso;
    };

    // Skip duplicates already in DB
    const allIds = toImport.map(t => t.identificador);
    const existingSet = new Set<string>();
    const LOOKUP = 500;
    for (let i = 0; i < allIds.length; i += LOOKUP) {
      const { data } = await supabase
        .from("tarefas")
        .select("identificador_projuris")
        .in("identificador_projuris", allIds.slice(i, i + LOOKUP));
      (data || []).forEach((r: any) => existingSet.add(r.identificador_projuris));
    }

    // ===== Phase 1: pre-resolve processo / responsavel / envolvidos IDs =====
    type Prepared = {
      t: TarefaAstreaImport;
      processoId: string | null;
      responsavelId: string | null;
      envolvidosIds: string[];
      jaExiste: boolean;
    };
    const prepared: Prepared[] = [];
    const dupPlanilha: TarefaAstreaImport[] = [];
    const seenKeys = new Set<string>();

    for (let i = 0; i < toImport.length; i++) {
      if (astreaCancelledRef.current) break;
      const t = toImport[i];
      const processoId = await findOrCreateProcessoId(
        t.numeroProcesso,
        astreaCoordenacao,
        astreaCadastrarNovosProcessos,
        { assunto: t.tituloProcesso || undefined, vara: t.juizo || undefined },
        (num) => setAstreaProcessosCriados(prev => [...prev, num])
      );
      const responsavelId = await findResponsavelId(
        t.responsavel,
        astreaVincularResponsaveis,
        astreaCadastrarNovosUsuarios,
        astreaCoordenacao,
        (nome) => setAstreaUsuariosCriados(prev => [...prev, nome])
      );
      const envolvidosIds: string[] = [];
      if (t.envolvidos && astreaVincularResponsaveis) {
        const names = t.envolvidos.split(/[,;]/).map(n => n.trim()).filter(Boolean);
        for (const n of names) {
          const id = await findResponsavelId(
            n,
            true,
            astreaCadastrarNovosUsuarios,
            astreaCoordenacao,
            (nome) => setAstreaUsuariosCriados(prev => [...prev, nome])
          );
          if (id && id !== responsavelId && !envolvidosIds.includes(id)) envolvidosIds.push(id);
        }
      }
      // Deduplicação dentro da própria planilha (linhas realmente idênticas)
      const chaveNegocio = [
        (t.titulo || "").trim().toLowerCase(),
        t.data || "",
        t.hora || "",
        processoId || "",
        responsavelId || "",
        mapAstreaTipoToTarefa(t.tipo) || "",
        t.dataConclusao || "",
        t.dataCriacao || "",
        (t.observacao || "").trim().toLowerCase(),
      ].join("|");
      if (seenKeys.has(chaveNegocio)) {
        dupPlanilha.push(t);
        continue;
      }
      seenKeys.add(chaveNegocio);
      prepared.push({ t, processoId, responsavelId, envolvidosIds, jaExiste: existingSet.has(t.identificador) });
      if (i % 25 === 0) setAstreaImportProgress(Math.round((i / toImport.length) * 30));
    }

    dupPlanilha.forEach(s => {
      const idx = updatedTarefas.findIndex(ut => ut.identificador === s.identificador);
      if (idx >= 0) updatedTarefas[idx] = { ...updatedTarefas[idx], status: "erro", erroImport: "Duplicada na planilha (linha repetida)" };
      errorCount++;
    });
    setTarefasAstrea([...updatedTarefas]);

    // ===== Phase 2: bulk insert tarefas in batches of 200 =====
    const BATCH = 200;
    for (let i = 0; i < prepared.length; i += BATCH) {
      if (astreaCancelledRef.current) { toast({ title: "Importação cancelada" }); break; }
      const slice = prepared.slice(i, i + BATCH);
      const buildRow = ({ t, processoId, responsavelId }: Prepared) => {
        const dataVencimento = parseDate(t.data);
        const statusFinal = mapStatus(t.statusOrigem);
        const prio = mapPrio(t.prioridadeOrigem);
        const dataConclusao = parseDateTimeBR(t.dataConclusao);
        const dataCriacao = parseDateTimeBR(t.dataCriacao);
        let observacoes = t.observacao || "";
        if (t.etiquetas) observacoes = observacoes ? `${observacoes}\n\nEtiquetas: ${t.etiquetas}` : `Etiquetas: ${t.etiquetas}`;
        if (t.envolvidos) observacoes = observacoes ? `${observacoes}\nEnvolvidos: ${t.envolvidos}` : `Envolvidos: ${t.envolvidos}`;
        return {
          identificador_projuris: t.identificador,
          tipo_tarefa: mapAstreaTipoToTarefa(t.tipo),
          titulo: t.titulo,
          descricao: t.tituloProcesso || null,
          data_vencimento: dataVencimento,
          hora_prevista: t.hora && t.hora !== "-" ? t.hora : null,
          status: statusFinal,
          prioridade: prio,
          responsavel_id: responsavelId,
          processo_id: processoId,
          coordenacao_id: astreaCoordenacao || null,
          observacoes: observacoes || null,
          criado_por: user?.id || null,
          origem: "astrea",
          marcadores: t.etiquetas || null,
          data_cumprimento: statusFinal === "cumprido" ? dataConclusao : null,
          data_criacao_projuris: dataCriacao ? dataCriacao.slice(0, 10) : null,
        };
      };
      const rows = slice.filter(s => !s.jaExiste).map(buildRow);
      const updateRows = slice.filter(s => s.jaExiste).map(buildRow);

      let inserted: any[] | null = null;
      const rowErrors = new Map<string, string>();

      const bulk = rows.length
        ? await supabase
            .from("tarefas")
            .insert(rows as any)
            .select("id, identificador_projuris")
        : { error: null, data: [] as any[] };

      if (bulk.error || !bulk.data) {
        // Uma linha ruim não pode invalidar o lote inteiro: reprocessa linha por linha
        const okRows: any[] = [];
        for (let k = 0; k < rows.length; k++) {
          if (astreaCancelledRef.current) break;
          const one = await supabase
            .from("tarefas")
            .insert([rows[k]] as any)
            .select("id, identificador_projuris");
          if (one.error || !one.data?.length) {
            rowErrors.set(rows[k].identificador_projuris, one.error?.message || "Erro ao inserir");
          } else {
            okRows.push(one.data[0]);
          }
        }
        inserted = okRows;
      } else {
        inserted = bulk.data as any[];
      }

      // Linhas já importadas antes: atualiza (corrige coordenação, processo e responsável)
      const updatedIds: string[] = [];
      for (const row of updateRows) {
        if (astreaCancelledRef.current) break;
        const { identificador_projuris, ...fields } = row as any;
        const upd = await (supabase.from("tarefas") as any)
          .update(fields)
          .eq("identificador_projuris", identificador_projuris)
          .select("id, identificador_projuris");
        if (upd.error || !upd.data?.length) {
          rowErrors.set(identificador_projuris, upd.error?.message || "Erro ao atualizar");
        } else {
          inserted.push(upd.data[0]);
          upd.data.forEach((r: any) => updatedIds.push(r.id));
        }
      }
      if (updatedIds.length) {
        for (let j = 0; j < updatedIds.length; j += 200) {
          const chunk = updatedIds.slice(j, j + 200);
          await supabase.from("tarefa_responsaveis").delete().in("tarefa_id", chunk);
          await supabase.from("tarefa_envolvidos").delete().in("tarefa_id", chunk);
        }
      }

      if (rowErrors.size > 0) {
        rowErrors.forEach((msg, ident) => {
          const idx = updatedTarefas.findIndex(ut => ut.identificador === ident);
          if (idx >= 0) updatedTarefas[idx] = { ...updatedTarefas[idx], status: "erro", erroImport: msg };
          errorCount++;
        });
      }

      {
        const idByIdent = new Map<string, string>();
        inserted.forEach((r: any) => idByIdent.set(r.identificador_projuris, r.id));

        // Build relation rows
        const respRows: { tarefa_id: string; usuario_id: string }[] = [];
        const envRows: { tarefa_id: string; usuario_id: string }[] = [];
        const procRespPairs: { processoId: string; usuarioId: string }[] = [];

        slice.forEach(({ t, processoId, responsavelId, envolvidosIds }) => {
          const tarefaId = idByIdent.get(t.identificador);
          if (!tarefaId) {
            if (!rowErrors.has(t.identificador)) {
              const idx = updatedTarefas.findIndex(ut => ut.identificador === t.identificador);
              if (idx >= 0) updatedTarefas[idx] = { ...updatedTarefas[idx], status: "erro", erroImport: "Inserido mas id não retornado" };
              errorCount++;
            }
            return;
          }
          const idx = updatedTarefas.findIndex(ut => ut.identificador === t.identificador);
          if (idx >= 0) updatedTarefas[idx] = { ...updatedTarefas[idx], status: "sucesso" };
          successCount++;

          if (responsavelId) {
            respRows.push({ tarefa_id: tarefaId, usuario_id: responsavelId });
            if (processoId) procRespPairs.push({ processoId, usuarioId: responsavelId });
          }
          envolvidosIds.forEach(uid => {
            envRows.push({ tarefa_id: tarefaId, usuario_id: uid });
            if (processoId) procRespPairs.push({ processoId, usuarioId: uid });
          });
        });

        // Batch insert tarefa_responsaveis
        for (let j = 0; j < respRows.length; j += 500) {
          const chunk = respRows.slice(j, j + 500);
          if (chunk.length) await supabase.from("tarefa_responsaveis").insert(chunk as any);
        }
        for (let j = 0; j < envRows.length; j += 500) {
          const chunk = envRows.slice(j, j + 500);
          if (chunk.length) await supabase.from("tarefa_envolvidos").insert(chunk as any);
        }

        // Vincular processos_responsaveis (deduped per pair)
        const seenPair = new Set<string>();
        const procRespRows = procRespPairs
          .filter(p => {
            const k = `${p.processoId}::${p.usuarioId}`;
            if (seenPair.has(k)) return false;
            seenPair.add(k);
            return true;
          })
          .map(p => ({
            processo_id: p.processoId,
            usuario_id: p.usuarioId,
            coordenacao_id: astreaCoordenacao || null,
            papel: "Responsável",
            ativo: true,
          }));
        for (let j = 0; j < procRespRows.length; j += 500) {
          const chunk = procRespRows.slice(j, j + 500);
          if (chunk.length) {
            await (supabase.from("processos_responsaveis") as any)
              .upsert(chunk, { onConflict: "processo_id,usuario_id", ignoreDuplicates: true });
          }
        }
      }

      setAstreaImportProgress(30 + Math.round(((i + slice.length) / prepared.length) * 70));
      setTarefasAstrea([...updatedTarefas]);
    }

    setAstreaImporting(false);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["prazos"] }),
      queryClient.invalidateQueries({ queryKey: ["tarefas"] }),
      queryClient.invalidateQueries({ queryKey: ["profiles-import"] }),
      queryClient.invalidateQueries({ queryKey: ["processos"] }),
      queryClient.invalidateQueries({ queryKey: ["processos-map-import"] }),
    ]);

    if (astreaUsuariosCriados.length > 0) {
      refetchProfiles();
    }
    if (astreaProcessosCriados.length > 0) {
      refetchProcessos();
    }

    const descParts = [`${successCount} tarefa(s) importada(s)`];
    if (errorCount > 0) descParts.push(`${errorCount} erro(s)/duplicada(s)`);
    if (astreaUsuariosCriados.length > 0) descParts.push(`${astreaUsuariosCriados.length} usuário(s) criado(s)`);
    if (astreaProcessosCriados.length > 0) descParts.push(`${astreaProcessosCriados.length} processo(s) criado(s)`);

    toast({
      title: "Importação Astrea concluída",
      description: descParts.join(". ") + ".",
      variant: errorCount > 0 && successCount === 0 ? "destructive" : "default",
    });
  };

  const handleAstreaCancel = () => {
    astreaCancelledRef.current = true;
    toast({
      title: "Importação cancelada",
      description: "Os registros já processados permanecem no banco.",
    });
  };

  const clearAstrea = () => {
    setAstreaFile(null);
    setTarefasAstrea([]);
    setAstreaParseProgress(0);
    setAstreaImportProgress(0);
    setAstreaUsuariosCriados([]);
    setAstreaProcessosCriados([]);
  };

  // ==================== STATS ====================

  const projurisStats = {
    total: tarefas.length,
    validas: tarefas.filter(t => t.status === "valido").length,
    invalidas: tarefas.filter(t => t.status === "invalido").length,
    sucesso: tarefas.filter(t => t.status === "sucesso").length,
    erro: tarefas.filter(t => t.status === "erro").length,
    concluidas: tarefas.filter(t => mapSituacaoToStatus(t.situacao) === "cumprido").length,
  };

  const astreaStats = {
    total: tarefasAstrea.length,
    validas: tarefasAstrea.filter(t => t.status === "valido").length,
    invalidas: tarefasAstrea.filter(t => t.status === "invalido").length,
    sucesso: tarefasAstrea.filter(t => t.status === "sucesso").length,
    erro: tarefasAstrea.filter(t => t.status === "erro").length,
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "valido": return <Badge variant="outline" className="bg-blue-50 text-blue-700">Válido</Badge>;
      case "invalido": return <Badge variant="destructive">Inválido</Badge>;
      case "sucesso": return <Badge className="bg-green-600">Sucesso</Badge>;
      case "erro": return <Badge variant="destructive">Erro</Badge>;
      default: return <Badge variant="secondary">Pendente</Badge>;
    }
  };

  // ==================== RENDER ====================

  return (
    <MainLayout title="Importar Tarefas" subtitle="Importação de tarefas de diferentes sistemas">
      <div className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="projuris" className="flex items-center gap-2">
              <ListTodo className="h-4 w-4" />
              Projuris
            </TabsTrigger>
            <TabsTrigger value="astrea" className="flex items-center gap-2">
              <Scale className="h-4 w-4" />
              Astrea
            </TabsTrigger>
          </TabsList>

          {/* ==================== PROJURIS TAB ==================== */}
          <TabsContent value="projuris" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ListTodo className="h-5 w-5" />
                  Importar Tarefas do Projuris
                </CardTitle>
                <CardDescription>
                  Importe tarefas em massa a partir de arquivos Excel (.xlsx) ou CSV exportados do Projuris
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-4 items-end">
                  <div className="flex-1 min-w-[200px]">
                    <Label htmlFor="file">Arquivo de Tarefas</Label>
                    <Input
                      id="file"
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileChange}
                      disabled={parsing || importing}
                    />
                  </div>

                  <Button variant="outline" onClick={downloadTemplate} disabled={parsing || importing}>
                    <Download className="h-4 w-4 mr-2" />
                    Baixar Modelo
                  </Button>

                  {tarefas.length > 0 && (
                    <Button variant="ghost" onClick={clearProjuris} disabled={importing}>
                      Limpar
                    </Button>
                  )}
                </div>

                {/* Options */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Switch
                        id="importarConcluidas"
                        checked={importarConcluidas}
                        onCheckedChange={setImportarConcluidas}
                        disabled={importing}
                      />
                      <Label htmlFor="importarConcluidas">Importar tarefas concluídas</Label>
                    </div>

                    <div className="flex items-center gap-3">
                      <Switch
                        id="vincularResponsaveis"
                        checked={vincularResponsaveis}
                        onCheckedChange={setVincularResponsaveis}
                        disabled={importing}
                      />
                      <Label htmlFor="vincularResponsaveis">Vincular responsáveis automaticamente</Label>
                    </div>

                    <div className="flex items-center gap-3">
                      <Switch
                        id="cadastrarNovosUsuarios"
                        checked={cadastrarNovosUsuarios}
                        onCheckedChange={setCadastrarNovosUsuarios}
                        disabled={importing || !vincularResponsaveis || !selectedCoordenacao}
                      />
                      <div className="flex items-center gap-2">
                        <UserPlus className="h-4 w-4 text-muted-foreground" />
                        <Label htmlFor="cadastrarNovosUsuarios" className={!vincularResponsaveis || !selectedCoordenacao ? "text-muted-foreground" : ""}>
                          Cadastrar responsáveis não encontrados
                        </Label>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Switch
                        id="cadastrarNovosProcessos"
                        checked={cadastrarNovosProcessos}
                        onCheckedChange={setCadastrarNovosProcessos}
                        disabled={importing || !selectedCoordenacao}
                      />
                      <div className="flex items-center gap-2">
                        <FolderPlus className="h-4 w-4 text-muted-foreground" />
                        <Label htmlFor="cadastrarNovosProcessos" className={!selectedCoordenacao ? "text-muted-foreground" : ""}>
                          Cadastrar processos não encontrados
                        </Label>
                      </div>
                    </div>
                    {(cadastrarNovosUsuarios || cadastrarNovosProcessos) && !selectedCoordenacao && (
                      <p className="text-xs text-amber-600 ml-7">
                        Selecione uma coordenação para habilitar o cadastro automático
                      </p>
                    )}
                  </div>

                  <div>
                    <Label>Coordenação {(cadastrarNovosUsuarios || cadastrarNovosProcessos) ? "(obrigatório)" : "(opcional)"}</Label>
                    <Select value={selectedCoordenacao} onValueChange={(val) => setSelectedCoordenacao(val === "none" ? "" : val)} disabled={importing}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        {coordenacoes.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Novos usuários e processos serão vinculados a esta coordenação
                    </p>
                  </div>
                </div>

                {/* New users/processos created alerts */}
                {novosUsuariosCriados.length > 0 && (
                  <Alert>
                    <UserPlus className="h-4 w-4" />
                    <AlertDescription>
                      <strong>{novosUsuariosCriados.length} novo(s) usuário(s) cadastrado(s):</strong>{" "}
                      {novosUsuariosCriados.slice(0, 5).join(", ")}
                      {novosUsuariosCriados.length > 5 && ` e mais ${novosUsuariosCriados.length - 5}...`}
                    </AlertDescription>
                  </Alert>
                )}

                {novosProcessosCriados.length > 0 && (
                  <Alert>
                    <FolderPlus className="h-4 w-4" />
                    <AlertDescription>
                      <strong>{novosProcessosCriados.length} novo(s) processo(s) cadastrado(s):</strong>{" "}
                      {novosProcessosCriados.slice(0, 5).join(", ")}
                      {novosProcessosCriados.length > 5 && ` e mais ${novosProcessosCriados.length - 5}...`}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Progress */}
                {parsing && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Analisando arquivo...</span>
                    </div>
                    <Progress value={parseProgress} />
                  </div>
                )}

                {(importing || importState.phase === "done") && importState.phase !== "idle" && (
                  <ImportProgress
                    state={importState}
                    onCancel={importing ? handleCancel : undefined}
                  />
                )}
              </CardContent>
            </Card>

            {/* Projuris Stats */}
            {tarefas.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold">{projurisStats.total}</div>
                    <div className="text-sm text-muted-foreground">Total</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold text-blue-600">{projurisStats.validas}</div>
                    <div className="text-sm text-muted-foreground">Válidas</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold text-red-600">{projurisStats.invalidas}</div>
                    <div className="text-sm text-muted-foreground">Inválidas</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold text-green-600">{projurisStats.sucesso}</div>
                    <div className="text-sm text-muted-foreground">Importadas</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold text-orange-600">{projurisStats.erro}</div>
                    <div className="text-sm text-muted-foreground">Erros</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold text-purple-600">{projurisStats.concluidas}</div>
                    <div className="text-sm text-muted-foreground">Concluídas</div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Projuris Table */}
            {tarefas.length > 0 && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Tarefas Carregadas</CardTitle>
                  <Button
                    onClick={handleImport}
                    disabled={importing || projurisStats.validas === 0}
                  >
                    {importing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Importando...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Importar {projurisStats.validas} Tarefa(s)
                      </>
                    )}
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[400px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[60px]">Linha</TableHead>
                          <TableHead className="w-[80px]">Status</TableHead>
                          <TableHead>Identificador</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Título</TableHead>
                          <TableHead>Responsável</TableHead>
                          <TableHead>Data Fatal</TableHead>
                          <TableHead>Processo</TableHead>
                          <TableHead>Situação</TableHead>
                          <TableHead>Erros</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tarefas.slice(0, 200).map((t, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-xs">{t.linhaOriginal}</TableCell>
                            <TableCell>{getStatusBadge(t.status)}</TableCell>
                            <TableCell className="font-mono text-xs">{t.identificador?.substring(0, 12)}</TableCell>
                            <TableCell className="text-xs max-w-[80px] truncate">{t.tipo || "-"}</TableCell>
                            <TableCell className="max-w-[180px] truncate text-sm">{t.titulo}</TableCell>
                            <TableCell className="max-w-[120px] truncate text-xs">{t.responsaveis || "-"}</TableCell>
                            <TableCell className="text-xs font-mono">{t.dataFatal || t.dataPrevista || "-"}</TableCell>
                            <TableCell className="max-w-[120px] truncate font-mono text-xs">{t.numeroProcesso || "-"}</TableCell>
                            <TableCell className="text-xs max-w-[80px] truncate">{t.situacao || "-"}</TableCell>
                            <TableCell className="max-w-[150px]">
                              {t.erroImport ? (
                                <span className="text-red-600 text-xs">{t.erroImport}</span>
                              ) : t.erros.length > 0 ? (
                                <span className="text-amber-600 text-xs">{t.erros.join(", ")}</span>
                              ) : (
                                <span className="text-green-600 text-xs">OK</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {tarefas.length > 200 && (
                    <p className="text-sm text-muted-foreground mt-2 text-center">
                      Mostrando 200 de {tarefas.length} tarefas
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ==================== ASTREA TAB ==================== */}
          <TabsContent value="astrea" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scale className="h-5 w-5" />
                  Importar Tarefas do Astrea
                </CardTitle>
                <CardDescription>
                  Importe tarefas, audiências e eventos a partir de arquivos Excel exportados do Astrea (Agenda)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-4 items-end">
                  <div className="flex-1 min-w-[200px]">
                    <Label htmlFor="astrea-file">Arquivo de Agenda Astrea</Label>
                    <Input
                      id="astrea-file"
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleAstreaFileChange}
                      disabled={astreaParsing || astreaImporting}
                    />
                  </div>

                  {tarefasAstrea.length > 0 && (
                    <Button variant="ghost" onClick={clearAstrea} disabled={astreaImporting}>
                      Limpar
                    </Button>
                  )}
                </div>

                {/* Astrea Options */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Switch
                        id="astreaVincularResponsaveis"
                        checked={astreaVincularResponsaveis}
                        onCheckedChange={setAstreaVincularResponsaveis}
                        disabled={astreaImporting}
                      />
                      <Label htmlFor="astreaVincularResponsaveis">Vincular responsáveis automaticamente</Label>
                    </div>

                    <div className="flex items-center gap-3">
                      <Switch
                        id="astreaCadastrarNovosUsuarios"
                        checked={astreaCadastrarNovosUsuarios}
                        onCheckedChange={setAstreaCadastrarNovosUsuarios}
                        disabled={astreaImporting || !astreaVincularResponsaveis || !astreaCoordenacao}
                      />
                      <div className="flex items-center gap-2">
                        <UserPlus className="h-4 w-4 text-muted-foreground" />
                        <Label htmlFor="astreaCadastrarNovosUsuarios" className={!astreaVincularResponsaveis || !astreaCoordenacao ? "text-muted-foreground" : ""}>
                          Cadastrar responsáveis não encontrados
                        </Label>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Switch
                        id="astreaCadastrarNovosProcessos"
                        checked={astreaCadastrarNovosProcessos}
                        onCheckedChange={setAstreaCadastrarNovosProcessos}
                        disabled={astreaImporting || !astreaCoordenacao}
                      />
                      <div className="flex items-center gap-2">
                        <FolderPlus className="h-4 w-4 text-muted-foreground" />
                        <Label htmlFor="astreaCadastrarNovosProcessos" className={!astreaCoordenacao ? "text-muted-foreground" : ""}>
                          Cadastrar processos não encontrados
                        </Label>
                      </div>
                    </div>
                    {(astreaCadastrarNovosUsuarios || astreaCadastrarNovosProcessos) && !astreaCoordenacao && (
                      <p className="text-xs text-amber-600 ml-7">
                        Selecione uma coordenação para habilitar o cadastro automático
                      </p>
                    )}
                  </div>

                  <div>
                    <Label>Coordenação {(astreaCadastrarNovosUsuarios || astreaCadastrarNovosProcessos) ? "(obrigatório)" : "(opcional)"}</Label>
                    <Select value={astreaCoordenacao} onValueChange={(val) => setAstreaCoordenacao(val === "none" ? "" : val)} disabled={astreaImporting}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        {coordenacoes.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Novos usuários e processos serão vinculados a esta coordenação
                    </p>
                  </div>
                </div>

                {/* Alerts for created users/processos */}
                {astreaUsuariosCriados.length > 0 && (
                  <Alert>
                    <UserPlus className="h-4 w-4" />
                    <AlertDescription>
                      <strong>{astreaUsuariosCriados.length} novo(s) usuário(s) cadastrado(s):</strong>{" "}
                      {astreaUsuariosCriados.slice(0, 5).join(", ")}
                      {astreaUsuariosCriados.length > 5 && ` e mais ${astreaUsuariosCriados.length - 5}...`}
                    </AlertDescription>
                  </Alert>
                )}

                {astreaProcessosCriados.length > 0 && (
                  <Alert>
                    <FolderPlus className="h-4 w-4" />
                    <AlertDescription>
                      <strong>{astreaProcessosCriados.length} novo(s) processo(s) cadastrado(s):</strong>{" "}
                      {astreaProcessosCriados.slice(0, 5).join(", ")}
                      {astreaProcessosCriados.length > 5 && ` e mais ${astreaProcessosCriados.length - 5}...`}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Progress */}
                {astreaParsing && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Analisando arquivo...</span>
                    </div>
                    <Progress value={astreaParseProgress} />
                  </div>
                )}

                {astreaImporting && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Importando tarefas...</span>
                      </div>
                      <Button variant="destructive" size="sm" onClick={handleAstreaCancel}>
                        Cancelar
                      </Button>
                    </div>
                    <Progress value={astreaImportProgress} />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Astrea Stats */}
            {tarefasAstrea.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold">{astreaStats.total}</div>
                    <div className="text-sm text-muted-foreground">Total</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold text-blue-600">{astreaStats.validas}</div>
                    <div className="text-sm text-muted-foreground">Válidas</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold text-red-600">{astreaStats.invalidas}</div>
                    <div className="text-sm text-muted-foreground">Inválidas</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold text-green-600">{astreaStats.sucesso}</div>
                    <div className="text-sm text-muted-foreground">Importadas</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-2xl font-bold text-orange-600">{astreaStats.erro}</div>
                    <div className="text-sm text-muted-foreground">Erros</div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Astrea Table */}
            {tarefasAstrea.length > 0 && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Tarefas Carregadas (Astrea)</CardTitle>
                  <Button
                    onClick={handleAstreaImport}
                    disabled={astreaImporting || astreaStats.validas === 0}
                  >
                    {astreaImporting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Importando...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Importar {astreaStats.validas} Tarefa(s)
                      </>
                    )}
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="max-h-[400px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[80px]">Linha</TableHead>
                          <TableHead className="w-[100px]">Status</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Título</TableHead>
                          <TableHead>Responsável</TableHead>
                          <TableHead>Processo</TableHead>
                          <TableHead>Erros</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tarefasAstrea.slice(0, 200).map((t, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{t.linhaOriginal}</TableCell>
                            <TableCell>{getStatusBadge(t.status)}</TableCell>
                            <TableCell>{t.data || "-"}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{t.tipo || "Tarefa"}</Badge>
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">{t.titulo}</TableCell>
                            <TableCell className="max-w-[150px] truncate">{t.responsavel || "-"}</TableCell>
                            <TableCell className="max-w-[150px] truncate font-mono text-xs">{t.numeroProcesso || "-"}</TableCell>
                            <TableCell className="max-w-[200px]">
                              {t.erroImport ? (
                                <span className="text-red-600 text-xs">{t.erroImport}</span>
                              ) : t.erros.length > 0 ? (
                                <span className="text-amber-600 text-xs">{t.erros.join(", ")}</span>
                              ) : (
                                "-"
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {tarefasAstrea.length > 200 && (
                    <p className="text-sm text-muted-foreground mt-2 text-center">
                      Mostrando 200 de {tarefasAstrea.length} tarefas
                    </p>
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
