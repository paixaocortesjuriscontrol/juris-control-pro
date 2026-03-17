import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, FileSpreadsheet, CheckCircle, XCircle, Loader2, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface AudienciaRow {
  modalidade: string;
  data: string;
  hora_local: string;
  hora_brasilia: string;
  processo_numero: string;
  vara_camara: string;
  comarca: string;
  polo_ativo: string;
  cliente: string;
  terceirizado: string;
  tipo_audiencia: string;
  resumo_objeto: string;
  funcao: string;
  preposto: string;
  testemunhas: string;
  advogado: string;
  equipe: string;
  nucleo_origem: string;
  dossie: string;
  status: 'pendente' | 'sucesso' | 'erro';
  erro?: string;
}

// Mapeamento de estados para diferença de fuso em relação a Brasília (UTC-3)
// Valores positivos = horário local está atrás de Brasília
const FUSO_HORARIO_ESTADOS: Record<string, number> = {
  // UTC-5 (2 horas atrás de Brasília)
  "AC": -2, "ACRE": -2, "RIO BRANCO": -2,
  
  // UTC-4 (1 hora atrás de Brasília)
  "AM": -1, "AMAZONAS": -1, "MANAUS": -1,
  "RO": -1, "RONDÔNIA": -1, "RONDONIA": -1, "PORTO VELHO": -1,
  "RR": -1, "RORAIMA": -1, "BOA VISTA": -1,
  "MT": -1, "MATO GROSSO": -1, "CUIABÁ": -1, "CUIABA": -1,
  "MS": -1, "MATO GROSSO DO SUL": -1, "CAMPO GRANDE": -1,
  
  // UTC-2 (1 hora à frente de Brasília)
  "FN": 1, "FERNANDO DE NORONHA": 1, "NORONHA": 1,
};

// Função para calcular diferença de fuso baseado na comarca
const getDiferencaFuso = (comarca: string): number => {
  if (!comarca) return 0;
  const comarcaUpper = comarca.toUpperCase().trim();
  
  // Primeiro, verifica se a comarca está diretamente no mapeamento
  if (FUSO_HORARIO_ESTADOS[comarcaUpper] !== undefined) {
    return FUSO_HORARIO_ESTADOS[comarcaUpper];
  }
  
  // Verifica se alguma chave está contida na comarca
  for (const [key, diff] of Object.entries(FUSO_HORARIO_ESTADOS)) {
    if (comarcaUpper.includes(key)) {
      return diff;
    }
  }
  
  // Por padrão, assume horário de Brasília (UTC-3)
  return 0;
};

// Converte hora local para hora de Brasília
const converterParaBrasilia = (horaLocal: string, comarca: string): string => {
  if (!horaLocal) return "";
  
  const match = horaLocal.match(/(\d{1,2}):(\d{2})/);
  if (!match) return horaLocal;
  
  const horas = parseInt(match[1], 10);
  const minutos = parseInt(match[2], 10);
  const diferencaFuso = getDiferencaFuso(comarca);
  
  // Adiciona a diferença de fuso para converter para Brasília
  let horasBrasilia = horas - diferencaFuso;
  
  // Ajusta se passar de 24h ou for negativo
  if (horasBrasilia >= 24) horasBrasilia -= 24;
  if (horasBrasilia < 0) horasBrasilia += 24;
  
  return `${String(horasBrasilia).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;
};

export function ImportarAudienciasDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<AudienciaRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const parseExcelDate = (value: any): string | null => {
    if (!value) return null;
    
    // Se for número (serial date do Excel)
    if (typeof value === 'number') {
      const date = XLSX.SSF.parse_date_code(value);
      if (date) {
        return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
      }
    }
    
    // Se for string no formato DD/MM/YYYY
    if (typeof value === 'string') {
      const match = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (match) {
        return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
      }
    }
    
    return null;
  };

  const parseExcelTime = (value: any): string => {
    if (!value) return "";
    
    // Se for número (fração decimal de 24h no Excel)
    if (typeof value === 'number') {
      const totalMinutes = Math.round(value * 24 * 60);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
    
    // Se for string
    if (typeof value === 'string') {
      // Já está no formato HH:MM
      const match = value.match(/(\d{1,2}):(\d{2})/);
      if (match) {
        return `${match[1].padStart(2, '0')}:${match[2]}`;
      }
      return value.trim();
    }
    
    return String(value);
  };

  const formatDisplayDate = (isoDate: string): string => {
    if (!isoDate) return "";
    const match = isoDate.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[3]}/${match[2]}/${match[1]}`;
    }
    return isoDate;
  };

  const normalizeHeader = (header: string): string => {
    if (!header) return "";
    return header
      .replace(/\u00A0/g, " ") // NBSP
      .trim()
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remove accents
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  };

  const normalizeRowKeys = (row: Record<string, any>): Record<string, any> => {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(row)) {
      out[normalizeHeader(k)] = v;
    }
    return out;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      const parsed: AudienciaRow[] = (jsonData as any[])
        .map((raw) => normalizeRowKeys(raw))
        .filter((row) => row["DATA"] || row["NUMERO_PROCESSO"])
        .map((row) => {
          const comarca = String(row["COMARCA"] || "").trim();
          const horaLocal = parseExcelTime(row["HORA"]);
          const horaBrasilia = converterParaBrasilia(horaLocal, comarca);

          return {
            data: parseExcelDate(row["DATA"]) || "",
            hora_local: horaLocal,
            hora_brasilia: horaBrasilia,
            processo_numero: String(row["NUMERO_PROCESSO"] || "").trim(),
            vara_camara: String(row["VT_CAMARA"] || "").trim(),
            comarca,
            polo_ativo: String(row["POLO_ATIVO"] || "").trim(),
            cliente: String(row["CLIENTE"] || "").trim(),
            terceirizado: String(row["TERCEIRIZADO"] || "").trim(),
            tipo_audiencia: String(row["TIPO"] || "").trim(),
            resumo_objeto: String(row["RESUMO_DO_OBJETO"] || "").trim(),
            funcao: String(row["FUNCAO"] || "").trim(),
            preposto: String(row["PREPOSTO"] || "").trim(),
            testemunhas: String(row["TESTEMUNHAS"] || "").trim(),
            advogado: String(row["ADVOGADO"] || "").trim(),
            status: "pendente" as const,
          };
        })
        .filter((row) => row.processo_numero || row.data);

      setRows(parsed);
      toast.success(`${parsed.length} audiências encontradas na planilha`);
    } catch (error: any) {
      toast.error(`Erro ao ler planilha: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (rows.length === 0) return;

    setIsImporting(true);
    setProgress(0);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Usuário não autenticado");
      setIsImporting(false);
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      try {
        const { error } = await supabase
          .from('audiencias_detectadas')
          .insert({
            processo_numero: row.processo_numero || null,
            data_audiencia: row.data || null,
            hora: row.hora_local || null, // Campo legado, mantém hora local
            hora_local: row.hora_local || null,
            hora_brasilia: row.hora_brasilia || null,
            tipo_audiencia: row.tipo_audiencia || null,
            vara_camara: row.vara_camara || null,
            comarca: row.comarca || null,
            polo_ativo: row.polo_ativo || null,
            cliente: row.cliente || null,
            terceirizado: row.terceirizado || null,
            resumo_objeto: row.resumo_objeto || null,
            funcao: row.funcao || null,
            preposto: row.preposto || null,
            testemunhas: row.testemunhas || null,
            advogado: row.advogado || null,
            origem: 'manual',
            criado_por: user.id,
            status: 'pendente',
          });

        if (error) throw error;
        
        setRows(prev => prev.map((r, idx) => 
          idx === i ? { ...r, status: 'sucesso' } : r
        ));
        successCount++;
      } catch (error: any) {
        setRows(prev => prev.map((r, idx) => 
          idx === i ? { ...r, status: 'erro', erro: error.message } : r
        ));
        errorCount++;
      }

      setProgress(((i + 1) / rows.length) * 100);
    }

    setIsImporting(false);
    queryClient.invalidateQueries({ queryKey: ['audiencias-detectadas'] });
    
    if (errorCount === 0) {
      toast.success(`${successCount} audiências importadas com sucesso!`);
      onOpenChange(false);
      setRows([]);
    } else {
      toast.warning(`${successCount} importadas, ${errorCount} com erro`);
    }
  };

  const downloadTemplate = () => {
    const template = [
      {
        "DATA": "15/12/2025",
        "HORA": "14:00",
        "NÚMERO PROCESSO": "0000000-00.0000.0.00.0000",
        "VT/ CÂMARA": "1ª VT",
        "COMARCA": "Brasília",
        "POLO ATIVO": "Nome do Reclamante",
        "CLIENTE": "Nome do Cliente",
        "TERCEIRIZADO": "Empresa Terceirizada",
        "TIPO": "Inicial Presencial",
        "RESUMO DO OBJETO": "Descrição do objeto da audiência",
        "FUNÇÃO": "Cargo do reclamante",
        "PREPOSTO": "Nome do preposto - contato",
        "TESTEMUNHAS": "Nomes das testemunhas",
        "ADVOGADO": "Nome do advogado"
      }
    ];
    
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pauta");
    XLSX.writeFile(wb, "modelo_pauta_audiencias.xlsx");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Audiências via Planilha
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden space-y-4">
          {rows.length === 0 ? (
            <div className="border-2 border-dashed rounded-lg p-8 text-center space-y-4">
              <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <p className="font-medium">Selecione a planilha de pauta semanal</p>
                <p className="text-sm text-muted-foreground">
                  Formato esperado: DATA, HORA, NÚMERO PROCESSO, VT/CÂMARA, COMARCA, etc.
                </p>
              </div>
              <div className="flex gap-2 justify-center">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="max-w-xs"
                  disabled={isLoading}
                />
                <Button variant="outline" onClick={downloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Baixar Modelo
                </Button>
              </div>
              {isLoading && (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processando planilha...</span>
                </div>
              )}
            </div>
          ) : (
            <>
              {isImporting && (
                <div className="space-y-2">
                  <Progress value={progress} className="h-2" />
                  <p className="text-sm text-center text-muted-foreground">
                    Importando... {Math.round(progress)}%
                  </p>
                </div>
              )}

              <ScrollArea className="h-[400px] border rounded-md">
                <div className="min-w-[1800px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[80px] sticky left-0 bg-background z-10">Status</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Hora Local</TableHead>
                        <TableHead>Hora DF</TableHead>
                        <TableHead>Nº Processo</TableHead>
                        <TableHead>VT/Câmara</TableHead>
                        <TableHead>Comarca</TableHead>
                        <TableHead>Polo Ativo</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Terceirizado</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Resumo Objeto</TableHead>
                        <TableHead>Função</TableHead>
                        <TableHead>Preposto</TableHead>
                        <TableHead>Testemunhas</TableHead>
                        <TableHead>Advogado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="sticky left-0 bg-background z-10">
                            {row.status === 'pendente' && (
                              <Badge variant="outline">Pendente</Badge>
                            )}
                            {row.status === 'sucesso' && (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            )}
                            {row.status === 'erro' && (
                              <span title={row.erro}>
                                <XCircle className="h-4 w-4 text-red-500" />
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{formatDisplayDate(row.data)}</TableCell>
                          <TableCell className="whitespace-nowrap">{row.hora_local}</TableCell>
                          <TableCell className="whitespace-nowrap font-medium text-primary">{row.hora_brasilia}</TableCell>
                          <TableCell className="font-mono text-xs whitespace-nowrap">{row.processo_numero}</TableCell>
                          <TableCell className="whitespace-nowrap">{row.vara_camara}</TableCell>
                          <TableCell className="whitespace-nowrap">{row.comarca}</TableCell>
                          <TableCell className="max-w-[150px] truncate">{row.polo_ativo}</TableCell>
                          <TableCell className="max-w-[150px] truncate">{row.cliente}</TableCell>
                          <TableCell className="max-w-[150px] truncate">{row.terceirizado}</TableCell>
                          <TableCell className="whitespace-nowrap">{row.tipo_audiencia}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{row.resumo_objeto}</TableCell>
                          <TableCell className="whitespace-nowrap">{row.funcao}</TableCell>
                          <TableCell className="max-w-[150px] truncate">{row.preposto}</TableCell>
                          <TableCell className="max-w-[150px] truncate">{row.testemunhas}</TableCell>
                          <TableCell className="whitespace-nowrap">{row.advogado}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </ScrollArea>
            </>
          )}
        </div>

        <DialogFooter>
          {rows.length > 0 && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setRows([]);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                disabled={isImporting}
              >
                Limpar
              </Button>
              <Button onClick={handleImport} disabled={isImporting}>
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Importar {rows.length} Audiências
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}