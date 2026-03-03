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
      const { data, error } = await supabase
        .from("processos")
        .select("id, numero")
        .order("numero");
      if (error) throw error;
      const map = new Map<string, string>();
      (data || []).forEach(p => {
        const normalized = p.numero.replace(/[^0-9]/g, "");
        map.set(normalized, p.id);
        map.set(p.numero, p.id);
      });
      return map;
    },
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

  const findProcessoId = (numeroProcesso: string | null): string | null => {
    if (!numeroProcesso || !processosMap) return null;
    
    const normalized = numeroProcesso.replace(/[^0-9]/g, "");
    
    const cachedId = createdProcessosCache.current.get(normalized);
    if (cachedId) return cachedId;
    
    return processosMap.get(normalized) || processosMap.get(numeroProcesso) || null;
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
    
    const cachedId = createdProcessosCache.current.get(normalized);
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
        createdProcessosCache.current.set(normalized, newProcesso.id);
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
    
    const existingId = findProcessoId(numeroProcesso);
    if (existingId) return existingId;
    
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
        if (!tarefa.dataFatal && !tarefa.dataPrevista) tarefa.erros.push("Sem data fatal/prevista");

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
    let successCount = 0;
    let errorCount = 0;
    const BATCH_SIZE = 100;

    const allIds = toImport.map(t => t.identificador);
    const { data: existingTarefas } = await supabase
      .from("tarefas")
      .select("id, identificador_projuris, tipo_tarefa, titulo")
      .in("identificador_projuris", allIds);
    
    const existingMap = new Map<string, { id: string; tipo_tarefa: string | null; titulo: string }>(); 
    (existingTarefas || []).forEach((t: any) => {
      if (t.identificador_projuris) existingMap.set(t.identificador_projuris, { id: t.id, tipo_tarefa: t.tipo_tarefa, titulo: t.titulo });
    });

    createdUsersCache.current.clear();
    createdProcessosCache.current.clear();
    setNovosUsuariosCriados([]);
    setNovosProcessosCriados([]);

    for (let i = 0; i < toImport.length; i += BATCH_SIZE) {
      if (cancelledRef.current) {
        toast({ title: "Importação cancelada" });
        break;
      }

      const batch = toImport.slice(i, i + BATCH_SIZE);
      
      const insertPayloads: Array<{ payload: any; processoId: string | null; responsavelId: string | null }> = [];
      for (const t of batch) {
        // Build título with tipo prefix
        const tipoPrefix = t.tipo ? `[${t.tipo.toUpperCase()}] ` : "";
        const tituloCompleto = `${tipoPrefix}${t.titulo || "Tarefa sem título"}`;

        const existing = existingMap.get(t.identificador);
        if (existing) {
          // Update existing task with tipo_tarefa and título if tipo found
          if (t.tipo) {
            const updatePayload: any = { tipo_tarefa: t.tipo };
            // Update título only if it doesn't already contain the tipo
            if (!existing.titulo?.toUpperCase().includes(`[${t.tipo.toUpperCase()}]`)) {
              updatePayload.titulo = tituloCompleto;
            }
            const { error: updateError } = await supabase
              .from("tarefas")
              .update(updatePayload)
              .eq("id", existing.id);
            const idx = updatedTarefas.findIndex(ut => ut.identificador === t.identificador);
            if (idx >= 0) {
              if (updateError) {
                updatedTarefas[idx] = { ...updatedTarefas[idx], status: "erro", erroImport: updateError.message };
                errorCount++;
              } else {
                updatedTarefas[idx] = { ...updatedTarefas[idx], status: "sucesso", erroImport: "Atualizado (tipo)" };
                successCount++;
              }
            }
          } else {
            const idx = updatedTarefas.findIndex(ut => ut.identificador === t.identificador);
            if (idx >= 0) {
              updatedTarefas[idx] = { ...updatedTarefas[idx], status: "erro", erroImport: "Já existe no sistema (sem tipo para atualizar)" };
              errorCount++;
            }
          }
          continue;
        }
        
        const status = mapSituacaoToStatus(t.situacao);
        const dataVencimento = parseDate(t.dataFatal) || parseDate(t.dataPrevista);
        
        const processoId = await findOrCreateProcessoId(
          t.numeroProcesso,
          selectedCoordenacao,
          cadastrarNovosProcessos,
          { 
            assunto: t.assunto || undefined, 
            vara: t.vara || undefined, 
            fase: t.fase || undefined, 
            pastaFisica: t.pastaFisica || undefined, 
            pastaCliente: t.pastaCliente || undefined,
            instancia: t.instancia || undefined,
            orgao: t.orgao || undefined,
            orgaoJulgador: t.orgaoJulgador || undefined,
            situacaoProcesso: t.situacaoProcesso || undefined,
          },
          (num) => setNovosProcessosCriados(prev => [...prev, num])
        );
        
        const responsavelId = await findResponsavelId(
          t.responsaveis,
          vincularResponsaveis,
          cadastrarNovosUsuarios,
          selectedCoordenacao,
          (nome) => setNovosUsuariosCriados(prev => [...prev, nome])
        );
        
        insertPayloads.push({
          payload: {
            identificador_projuris: t.identificador || `auto-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            tipo_tarefa: t.tipo,
            titulo: tituloCompleto,
            descricao: t.descricao,
            data_vencimento: dataVencimento,
            data_base: parseDate(t.dataBase),
            data_fatal: parseDate(t.dataFatal),
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
            // New Projuris-specific columns
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
          processoId,
          responsavelId,
        });
      }

      const insertPayload = insertPayloads.map(p => p.payload);

      if (insertPayload.length > 0) {
        const { error } = await supabase.from("tarefas").insert(insertPayload as any);
        
        if (error) {
          for (const item of insertPayloads) {
            const { error: singleError } = await supabase.from("tarefas").insert(item.payload as any);
            const idx = updatedTarefas.findIndex(t => t.identificador === item.payload.identificador_projuris);
            if (idx >= 0) {
              if (singleError) {
                updatedTarefas[idx] = { ...updatedTarefas[idx], status: "erro", erroImport: singleError.message };
                errorCount++;
              } else {
                updatedTarefas[idx] = { ...updatedTarefas[idx], status: "sucesso" };
                successCount++;
                if (item.processoId && item.responsavelId) {
                  await vincularResponsavelAoProcesso(item.processoId, item.responsavelId, selectedCoordenacao);
                }
              }
            }
          }
        } else {
          for (const item of insertPayloads) {
            const idx = updatedTarefas.findIndex(t => t.identificador === item.payload.identificador_projuris);
            if (idx >= 0) {
              updatedTarefas[idx] = { ...updatedTarefas[idx], status: "sucesso" };
              successCount++;
              if (item.processoId && item.responsavelId) {
                await vincularResponsavelAoProcesso(item.processoId, item.responsavelId, selectedCoordenacao);
              }
            }
          }
        }
      }

      // Existing tasks already handled in the loop above

      setImportProgress(((i + batch.length) / toImport.length) * 100);
      setTarefas([...updatedTarefas]);
    }

    setImporting(false);
    queryClient.invalidateQueries({ queryKey: ["prazos"] });
    queryClient.invalidateQueries({ queryKey: ["tarefas"] });
    queryClient.invalidateQueries({ queryKey: ["profiles-import"] });
    queryClient.invalidateQueries({ queryKey: ["processos"] });
    queryClient.invalidateQueries({ queryKey: ["processos-map-import"] });
    
    if (novosUsuariosCriados.length > 0) {
      refetchProfiles();
    }

    const descParts = [`${successCount} tarefa(s) importada(s)`];
    if (errorCount > 0) descParts.push(`${errorCount} erro(s)/duplicada(s)`);
    if (novosUsuariosCriados.length > 0) descParts.push(`${novosUsuariosCriados.length} usuário(s) criado(s)`);
    if (novosProcessosCriados.length > 0) descParts.push(`${novosProcessosCriados.length} processo(s) criado(s)`);

    toast({
      title: "Importação concluída",
      description: descParts.join(". ") + ".",
      variant: errorCount > 0 && successCount === 0 ? "destructive" : "default",
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

      const parsed: TarefaAstreaImport[] = rows.map((row: any, index): TarefaAstreaImport => {
        const data = String(row["Data"] || "").trim();
        const hora = String(row["Hora"] || "").trim();
        const tipo = String(row["Tipo"] || "").trim();
        const responsavel = String(row["Responsável"] || row["Responsavel"] || "").trim();
        const titulo = String(row["Título"] || row["Titulo"] || "").trim();
        const tituloProcesso = String(row["Título do processo/caso/atendimento"] || row["Titulo do processo/caso/atendimento"] || "").trim();
        const numeroProcesso = String(row["Número do processo"] || row["Numero do processo"] || "").trim();
        const juizo = String(row["Juízo"] || row["Juizo"] || "").trim();
        const observacao = String(row["Observação da atividade"] || row["Observacao da atividade"] || "").trim();
        const etiquetas = String(row["Etiquetas"] || "").trim();

        // Generate unique identifier based on data+hora+titulo+processo
        const identificador = `astrea-${data}-${hora}-${titulo}-${numeroProcesso}`.replace(/[^a-zA-Z0-9-]/g, "_").substring(0, 100);

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

    // Check for existing tasks
    const allIds = toImport.map(t => t.identificador);
    const { data: existingTarefas } = await supabase
      .from("tarefas")
      .select("identificador_projuris")
      .in("identificador_projuris", allIds);
    
    const existingSet = new Set((existingTarefas || []).map((t: any) => t.identificador_projuris));

    for (let i = 0; i < toImport.length; i++) {
      if (astreaCancelledRef.current) {
        toast({ title: "Importação cancelada" });
        break;
      }

      const t = toImport[i];
      const idx = updatedTarefas.findIndex(ut => ut.identificador === t.identificador);

      if (existingSet.has(t.identificador)) {
        if (idx >= 0) {
          updatedTarefas[idx] = { ...updatedTarefas[idx], status: "erro", erroImport: "Já existe no sistema" };
        }
        errorCount++;
        setAstreaImportProgress(((i + 1) / toImport.length) * 100);
        setTarefasAstrea([...updatedTarefas]);
        continue;
      }

      try {
        const dataVencimento = parseDate(t.data);
        
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

        // Build observacoes with etiquetas
        let observacoes = t.observacao || "";
        if (t.etiquetas) {
          observacoes = observacoes ? `${observacoes}\n\nEtiquetas: ${t.etiquetas}` : `Etiquetas: ${t.etiquetas}`;
        }

        const { error } = await supabase.from("tarefas").insert({
          identificador_projuris: t.identificador,
          tipo_tarefa: mapAstreaTipoToTarefa(t.tipo),
          titulo: t.titulo,
          descricao: t.tituloProcesso || null,
          data_vencimento: dataVencimento,
          status: "pendente",
          prioridade: "media",
          responsavel_id: responsavelId,
          processo_id: processoId,
          observacoes: observacoes || null,
          criado_por: user?.id || null,
          origem: "astrea",
          marcadores: t.etiquetas || null,
        } as any);

        if (error) {
          if (idx >= 0) {
            updatedTarefas[idx] = { ...updatedTarefas[idx], status: "erro", erroImport: error.message };
          }
          errorCount++;
        } else {
          if (idx >= 0) {
            updatedTarefas[idx] = { ...updatedTarefas[idx], status: "sucesso" };
          }
          successCount++;
          
          if (processoId && responsavelId) {
            await vincularResponsavelAoProcesso(processoId, responsavelId, astreaCoordenacao);
          }
        }
      } catch (err: any) {
        if (idx >= 0) {
          updatedTarefas[idx] = { ...updatedTarefas[idx], status: "erro", erroImport: err.message };
        }
        errorCount++;
      }

      setAstreaImportProgress(((i + 1) / toImport.length) * 100);
      setTarefasAstrea([...updatedTarefas]);
    }

    setAstreaImporting(false);
    queryClient.invalidateQueries({ queryKey: ["prazos"] });
    queryClient.invalidateQueries({ queryKey: ["tarefas"] });
    queryClient.invalidateQueries({ queryKey: ["profiles-import"] });
    queryClient.invalidateQueries({ queryKey: ["processos"] });
    queryClient.invalidateQueries({ queryKey: ["processos-map-import"] });

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

                {importing && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Importando tarefas...</span>
                      </div>
                      <Button variant="destructive" size="sm" onClick={handleCancel}>
                        Cancelar
                      </Button>
                    </div>
                    <Progress value={importProgress} />
                  </div>
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
