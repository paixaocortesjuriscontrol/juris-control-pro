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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCoordenacoesFull } from "@/hooks/useCoordenacoes";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, XCircle, Loader2, Download, ListTodo, Users } from "lucide-react";
import * as XLSX from "xlsx";

interface TarefaImport {
  identificador: string;
  tipo: string | null;
  titulo: string;
  dataCriacao: string | null;
  dataBase: string | null;
  dataPrevista: string | null;
  dataFatal: string | null;
  dataConclusao: string | null;
  situacao: string | null;
  descricao: string | null;
  responsaveis: string | null;
  gruposTrabalho: string | null;
  criadaPor: string | null;
  concluidaPor: string | null;
  marcadores: string | null;
  comentarios: string | null;
  quadroKanban: string | null;
  numeroProcesso: string | null;
  assunto: string | null;
  vara: string | null;
  fase: string | null;
  pastaFisica: string | null;
  pastaCliente: string | null;
  status: "pendente" | "valido" | "invalido" | "sucesso" | "erro";
  erros: string[];
  erroImport?: string;
  linhaOriginal: number;
}

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
    // Check if data fatal is soon
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

export default function ImportarTarefas() {
  const [file, setFile] = useState<File | null>(null);
  const [tarefas, setTarefas] = useState<TarefaImport[]>([]);
  const [parsing, setParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState(0);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [selectedCoordenacao, setSelectedCoordenacao] = useState<string>("");
  const [importarConcluidas, setImportarConcluidas] = useState(true);
  const [vincularResponsaveis, setVincularResponsaveis] = useState(true);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const cancelledRef = useRef(false);

  const { data: coordenacoes = [] } = useCoordenacoesFull();
  
  // Fetch profiles for matching responsaveis
  const { data: profiles = [] } = useQuery({
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
  const { data: processosMap } = useQuery({
    queryKey: ["processos-map-import"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos")
        .select("id, numero")
        .order("numero");
      if (error) throw error;
      const map = new Map<string, string>();
      (data || []).forEach(p => {
        // Normalize number for matching
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
    };
  }, []);

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
        // Parse CSV
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
        // Parse Excel
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const sheetName = workbook.SheetNames?.[0];
        if (!sheetName) throw new Error("Planilha sem abas");
        
        const sheet = workbook.Sheets[sheetName];
        rows = XLSX.utils.sheet_to_json(sheet, { defval: null, range: 2 });
      }

      setParseProgress(60);

      // Map rows to TarefaImport
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
          dataBase: row["Data base"] || null,
          dataPrevista: row["Data prevista"] || null,
          dataFatal,
          dataConclusao: row["Data da conclusão"] || row["Data da conclusao"] || null,
          situacao,
          descricao: row["Descrição da tarefa"] || row["Descricao da tarefa"] || null,
          responsaveis: row["Responsáveis da tarefa"] || row["Responsaveis da tarefa"] || null,
          gruposTrabalho: row["Grupos de trabalho"] || null,
          criadaPor: row["Criada por"] || null,
          concluidaPor: row["Concluída por"] || row["Concluida por"] || null,
          marcadores: row["Marcadores"] || null,
          comentarios: row["Comentários"] || row["Comentarios"] || null,
          quadroKanban: row["Quadro Kanban"] || null,
          numeroProcesso: row["Número do processo"] || row["Numero do processo"] || null,
          assunto: row["Assunto"] || null,
          vara: row["Vara"] || null,
          fase: row["Fase"] || null,
          pastaFisica: row["Pasta física"] || row["Pasta fisica"] || null,
          pastaCliente: row["Pasta do cliente"] || null,
          status: "pendente",
          erros: [],
          linhaOriginal: index + 2,
        };

        // Warnings (não impedem importação)
        if (!identificador) {
          tarefa.erros.push("Sem identificador");
        }
        if (!titulo) {
          tarefa.erros.push("Sem título");
        }
        if (!tarefa.dataFatal && !tarefa.dataPrevista) {
          tarefa.erros.push("Sem data fatal/prevista");
        }

        // Todas as tarefas são válidas para importação
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

  const findResponsavelId = (responsaveisStr: string | null): string | null => {
    if (!responsaveisStr || !vincularResponsaveis) return null;
    
    // Try to match first name in the list
    const nomes = responsaveisStr.split(/[,;]/).map(n => n.trim().toLowerCase());
    
    for (const nome of nomes) {
      if (!nome) continue;
      const profile = profiles.find(p => 
        p.nome.toLowerCase().includes(nome) || 
        nome.includes(p.nome.toLowerCase())
      );
      if (profile) return profile.id;
    }
    return null;
  };

  const findProcessoId = (numeroProcesso: string | null): string | null => {
    if (!numeroProcesso || !processosMap) return null;
    
    const normalized = numeroProcesso.replace(/[^0-9]/g, "");
    return processosMap.get(normalized) || processosMap.get(numeroProcesso) || null;
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

    // Check for existing identificadores to avoid duplicates
    const allIds = toImport.map(t => t.identificador);
    const { data: existingTarefas } = await supabase
      .from("prazos")
      .select("identificador_projuris")
      .in("identificador_projuris", allIds);
    
    const existingSet = new Set((existingTarefas || []).map(t => t.identificador_projuris));

    for (let i = 0; i < toImport.length; i += BATCH_SIZE) {
      if (cancelledRef.current) break;

      const batch = toImport.slice(i, i + BATCH_SIZE);
      const insertPayload = batch
        .filter(t => !existingSet.has(t.identificador))
        .map(t => {
          const status = mapSituacaoToStatus(t.situacao);
          const dataVencimento = parseDate(t.dataFatal) || parseDate(t.dataPrevista);
          
          return {
            identificador_projuris: t.identificador || `auto-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            tipo_tarefa: t.tipo,
            titulo: t.titulo || "Tarefa sem título",
            descricao: t.descricao,
            data_vencimento: dataVencimento || new Date().toISOString().split('T')[0], // default hoje
            data_base: parseDate(t.dataBase),
            data_fatal: parseDate(t.dataFatal),
            data_cumprimento: status === "cumprido" ? parseDate(t.dataConclusao) : null,
            status,
            prioridade: mapSituacaoToPrioridade(t.situacao, t.dataFatal),
            responsavel_id: findResponsavelId(t.responsaveis),
            processo_id: findProcessoId(t.numeroProcesso),
            observacoes: t.comentarios,
            criado_por_nome: t.criadaPor,
            concluido_por_nome: t.concluidaPor,
            grupos_trabalho: t.gruposTrabalho,
            marcadores: t.marcadores,
            quadro_kanban: t.quadroKanban,
          };
        });

      if (insertPayload.length > 0) {
        const { error } = await supabase.from("prazos").insert(insertPayload);
        
        if (error) {
          // Fallback to individual inserts
          for (const payload of insertPayload) {
            const { error: singleError } = await supabase.from("prazos").insert(payload);
            const idx = updatedTarefas.findIndex(t => t.identificador === payload.identificador_projuris);
            if (idx >= 0) {
              if (singleError) {
                updatedTarefas[idx] = { ...updatedTarefas[idx], status: "erro", erroImport: singleError.message };
                errorCount++;
              } else {
                updatedTarefas[idx] = { ...updatedTarefas[idx], status: "sucesso" };
                successCount++;
              }
            }
          }
        } else {
          // All batch succeeded
          for (const payload of insertPayload) {
            const idx = updatedTarefas.findIndex(t => t.identificador === payload.identificador_projuris);
            if (idx >= 0) {
              updatedTarefas[idx] = { ...updatedTarefas[idx], status: "sucesso" };
              successCount++;
            }
          }
        }
      }

      // Mark skipped as already existing
      for (const t of batch) {
        if (existingSet.has(t.identificador)) {
          const idx = updatedTarefas.findIndex(ut => ut.identificador === t.identificador);
          if (idx >= 0) {
            updatedTarefas[idx] = { ...updatedTarefas[idx], status: "erro", erroImport: "Já existe no sistema" };
            errorCount++;
          }
        }
      }

      setImportProgress(((i + batch.length) / toImport.length) * 100);
      setTarefas([...updatedTarefas]);
    }

    setImporting(false);
    queryClient.invalidateQueries({ queryKey: ["prazos"] });

    toast({
      title: "Importação concluída",
      description: `${successCount} tarefa(s) importada(s). ${errorCount} erro(s)/duplicada(s).`,
      variant: errorCount > 0 ? "destructive" : "default",
    });
  };

  const handleCancel = () => {
    cancelledRef.current = true;
    toast({
      title: "Importação cancelada",
      description: "Os registros já processados permanecem no banco.",
    });
  };

  const clearAll = () => {
    setFile(null);
    setTarefas([]);
    setParseProgress(0);
    setImportProgress(0);
  };

  const downloadTemplate = () => {
    const headers = [
      "Identificador da tarefa",
      "Tipo de tarefa",
      "Título",
      "Data de criação",
      "Data base",
      "Data prevista",
      "Data fatal",
      "Data da conclusão",
      "Situação",
      "Descrição da tarefa",
      "Responsáveis da tarefa",
      "Grupos de trabalho",
      "Criada por",
      "Concluída por",
      "Marcadores",
      "Comentários",
      "Quadro Kanban",
      "Número do processo",
      "Assunto",
      "Vara",
      "Fase",
      "Pasta física",
      "Pasta do cliente",
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tarefas");
    XLSX.writeFile(wb, "MODELO_IMPORTACAO_TAREFAS.xlsx");
  };

  const stats = {
    total: tarefas.length,
    validas: tarefas.filter(t => t.status === "valido").length,
    invalidas: tarefas.filter(t => t.status === "invalido").length,
    sucesso: tarefas.filter(t => t.status === "sucesso").length,
    erro: tarefas.filter(t => t.status === "erro").length,
    concluidas: tarefas.filter(t => mapSituacaoToStatus(t.situacao) === "cumprido").length,
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

  return (
    <MainLayout title="Importar Tarefas" subtitle="Importação de tarefas do Projuris">
      <div className="space-y-6">
        {/* Upload Section */}
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
                <Button variant="ghost" onClick={clearAll} disabled={importing}>
                  Limpar
                </Button>
              )}
            </div>

            {/* Options */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
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

              <div>
                <Label>Coordenação (opcional)</Label>
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
              </div>
            </div>

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

        {/* Stats */}
        {tarefas.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-sm text-muted-foreground">Total</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-blue-600">{stats.validas}</div>
                <div className="text-sm text-muted-foreground">Válidas</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-red-600">{stats.invalidas}</div>
                <div className="text-sm text-muted-foreground">Inválidas</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-green-600">{stats.sucesso}</div>
                <div className="text-sm text-muted-foreground">Importadas</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-orange-600">{stats.erro}</div>
                <div className="text-sm text-muted-foreground">Erros</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-purple-600">{stats.concluidas}</div>
                <div className="text-sm text-muted-foreground">Concluídas</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Action Button */}
        {stats.validas > 0 && !importing && (
          <div className="flex justify-end">
            <Button onClick={handleImport} size="lg">
              <Upload className="h-4 w-4 mr-2" />
              Importar {importarConcluidas ? stats.validas : stats.validas - stats.concluidas} Tarefa(s)
            </Button>
          </div>
        )}

        {/* Table */}
        {tarefas.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Tarefas Carregadas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-[500px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[60px]">Linha</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Identificador</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Data Fatal</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead>Responsáveis</TableHead>
                      <TableHead>Processo</TableHead>
                      <TableHead>Erros</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tarefas.slice(0, 100).map((tarefa, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono text-xs">{tarefa.linhaOriginal}</TableCell>
                        <TableCell>{getStatusBadge(tarefa.status)}</TableCell>
                        <TableCell className="font-mono text-xs">{tarefa.identificador}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{tarefa.titulo}</TableCell>
                        <TableCell>{tarefa.dataFatal || tarefa.dataPrevista || "-"}</TableCell>
                        <TableCell>{tarefa.situacao || "-"}</TableCell>
                        <TableCell className="max-w-[150px] truncate">{tarefa.responsaveis || "-"}</TableCell>
                        <TableCell className="max-w-[120px] truncate">{tarefa.numeroProcesso || "-"}</TableCell>
                        <TableCell className="text-xs text-destructive max-w-[200px]">
                          {tarefa.erros.join(", ") || tarefa.erroImport || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {tarefas.length > 100 && (
                <div className="text-center text-sm text-muted-foreground mt-4">
                  Mostrando 100 de {tarefas.length} tarefas
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
