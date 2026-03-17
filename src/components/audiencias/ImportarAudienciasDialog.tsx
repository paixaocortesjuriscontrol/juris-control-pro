import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileSpreadsheet, CheckCircle, XCircle, Loader2, Download, Building } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient, useQuery } from "@tanstack/react-query";
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

const MESES_ABREV: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  // Portuguese
  fev: '02', abr: '04', mai: '05', ago: '08', set: '09', out: '10', dez: '12',
};

/**
 * Parse any Excel date value into YYYY-MM-DD.
 * Handles: serial numbers, Date objects (from cellDates), "DD/MM/YYYY", "10-Apr", etc.
 */
const parseExcelDate = (value: any): string | null => {
  if (value == null || value === "") return null;

  // 1) Serial number (e.g. 45757)
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      const y = parsed.y < 2000 ? new Date().getFullYear() : parsed.y;
      return `${y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`;
    }
    return null;
  }

  // 2) JS Date object (from cellDates: true)
  if (value instanceof Date && !isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = value.getMonth() + 1;
    const d = value.getDate();
    const year = y < 2000 ? new Date().getFullYear() : y;
    return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  // 3) String formats
  if (typeof value === 'string') {
    const s = value.trim();

    // DD/MM/YYYY
    const matchDMY = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (matchDMY) {
      return `${matchDMY[3]}-${matchDMY[2].padStart(2, '0')}-${matchDMY[1].padStart(2, '0')}`;
    }

    // YYYY-MM-DD (already ISO)
    const matchISO = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (matchISO) return `${matchISO[1]}-${matchISO[2]}-${matchISO[3]}`;

    // "10-Apr" or "25-Mar" (day-month abbreviated, no year → use current year)
    const matchShort = s.match(/^(\d{1,2})[-\/](\w{3,})$/i);
    if (matchShort) {
      const monthKey = matchShort[2].toLowerCase().slice(0, 3);
      if (MESES_ABREV[monthKey]) {
        const year = new Date().getFullYear();
        return `${year}-${MESES_ABREV[monthKey]}-${matchShort[1].padStart(2, '0')}`;
      }
    }

    // "Apr-10" or "Mar 25" (month-day)
    const matchMonthFirst = s.match(/^(\w{3,})[-\/\s](\d{1,2})$/i);
    if (matchMonthFirst) {
      const monthKey = matchMonthFirst[1].toLowerCase().slice(0, 3);
      if (MESES_ABREV[monthKey]) {
        const year = new Date().getFullYear();
        return `${year}-${MESES_ABREV[monthKey]}-${matchMonthFirst[2].padStart(2, '0')}`;
      }
    }
  }

  return null;
};

const parseExcelTime = (value: any): string => {
  if (!value) return "";
  if (typeof value === 'number') {
    const totalMinutes = Math.round(value * 24 * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }
  if (typeof value === 'string') {
    const match = value.match(/(\d{1,2}):(\d{2})/);
    if (match) return `${match[1].padStart(2, '0')}:${match[2]}`;
    return value.trim();
  }
  if (value instanceof Date && !isNaN(value.getTime())) {
    return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
  }
  return String(value);
};

const formatDisplayDate = (isoDate: string): string => {
  if (!isoDate) return "";
  const match = isoDate.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  return isoDate;
};

const normalizeHeader = (header: string): string => {
  if (!header) return "";
  return header
    .replace(/\u00A0/g, " ")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
};

const normalizeRowKeys = (row: Record<string, any>): Record<string, any> => {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    const normalized = normalizeHeader(k);
    // Keep both normalized and original for __EMPTY columns
    out[normalized || k] = v;
    out[k] = v;
  }
  return out;
};

export function ImportarAudienciasDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<AudienciaRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [coordenacaoId, setCoordenacaoId] = useState<string>("");

  // Buscar coordenações
  const { data: coordenacoes = [] } = useQuery({
    queryKey: ['coordenacoes-import'],
    queryFn: async () => {
      const { data } = await supabase
        .from('coordenacoes')
        .select('id, nome')
        .order('nome');
      return data || [];
    },
    enabled: open,
  });

  // Auto-selecionar se só tem uma coordenação
  useEffect(() => {
    if (coordenacoes.length === 1 && !coordenacaoId) {
      setCoordenacaoId(coordenacoes[0].id);
    }
  }, [coordenacoes, coordenacaoId]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      // Read WITHOUT cellDates to get raw values - we parse dates ourselves
      const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: false });

      const allRows: AudienciaRow[] = [];
      const seenProcessos = new Set<string>();

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        const sheetRows: AudienciaRow[] = (jsonData as any[])
          .map((raw) => normalizeRowKeys(raw))
          .filter((row) => {
            // Must have at least DATA or PROCESSO
            const hasData = row["DATA"] && String(row["DATA"]).trim() !== "" && String(row["DATA"]).trim() !== "-";
            const hasProcesso = (row["PROCESSO"] || row["NUMERO_PROCESSO"]) && 
              String(row["PROCESSO"] || row["NUMERO_PROCESSO"]).trim() !== "" &&
              String(row["PROCESSO"] || row["NUMERO_PROCESSO"]).trim() !== "-";
            return hasData || hasProcesso;
          })
          .map((row) => {
            const parsedDate = parseExcelDate(row["DATA"]);
            const horaLocal = parseExcelTime(row["HORA"]);
            const comarca = String(row["COMARCA"] || "").trim();

            // First column (no header) → modalidade: __EMPTY or EMPTY after normalization
            const modalidadeRaw = String(row["__EMPTY"] || row["EMPTY"] || row["__EMPTY_1"] || row["MODALIDADE"] || "").trim();
            const modalidade = (modalidadeRaw === "Virtual" || modalidadeRaw === "Presencial") ? modalidadeRaw : "";

            const processoNumero = String(row["PROCESSO"] || row["NUMERO_PROCESSO"] || "").trim();

            return {
              modalidade,
              data: parsedDate || "",
              hora_local: horaLocal,
              hora_brasilia: horaLocal, // TST is already in Brasília timezone
              processo_numero: processoNumero,
              vara_camara: String(row["ORGAO"] || row["VT_CAMARA"] || row["ORGAO_TURMA"] || "").trim(),
              comarca,
              polo_ativo: String(row["PARTE_AUTORA"] || row["POLO_ATIVO"] || "").trim(),
              cliente: String(row["REUS"] || row["CLIENTE"] || "").trim(),
              terceirizado: String(row["TERCEIRIZADO"] || "").trim(),
              tipo_audiencia: String(row["TIPO"] || "").trim(),
              resumo_objeto: String(row["RESUMO_DO_OBJETO"] || "").trim(),
              funcao: String(row["FUNCAO"] || "").trim(),
              preposto: String(row["PREPOSTO"] || "").trim(),
              testemunhas: String(row["TESTEMUNHAS"] || "").trim(),
              advogado: String(row["ADV_INTERNO"] || row["ADVOGADO"] || "").trim(),
              equipe: String(row["EQUIPE"] || "").trim(),
              nucleo_origem: String(row["ORIGEM"] || "").trim(),
              dossie: String(row["DOSSIE"] || row["DOSSIER"] || "").trim(),
              status: "pendente" as const,
            };
          })
          .filter((row) => row.processo_numero || row.data);

        for (const row of sheetRows) {
          const key = row.processo_numero || `${row.data}-${row.polo_ativo}`;
          if (!seenProcessos.has(key)) {
            seenProcessos.add(key);
            allRows.push(row);
          }
        }
      }

      setRows(allRows);

      const comData = allRows.filter(r => r.data).length;
      const semData = allRows.length - comData;
      toast.success(
        `${allRows.length} audiências encontradas (${comData} com data, ${semData} sem data) — ${workbook.SheetNames.length} abas`
      );
    } catch (error: any) {
      toast.error(`Erro ao ler planilha: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (rows.length === 0) return;

    if (!coordenacaoId) {
      toast.error("Selecione uma coordenação antes de importar");
      return;
    }

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
        const dataAudiencia = row.data
          ? `${row.data}T${row.hora_brasilia || row.hora_local || '12:00'}:00-03:00`
          : null;

        const { error } = await supabase
          .from('audiencias_detectadas')
          .insert({
            processo_numero: row.processo_numero || null,
            data_audiencia: dataAudiencia,
            hora: row.hora_local || null,
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
            modalidade: row.modalidade || null,
            equipe: row.equipe || null,
            nucleo_origem: row.nucleo_origem || null,
            dossie: row.dossie || null,
            coordenacao_id: coordenacaoId,
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
        "PROCESSO": "0000000-00.0000.0.00.0000",
        "ÓRGÃO": "1ª VT",
        "PARTE AUTORA": "Nome do Reclamante",
        "RÉUS": "Nome do Cliente",
        "EQUIPE": "Núcleo Exemplo",
        "ORIGEM": "Núcleo Origem",
        "DOSSIÊ": "07.02.033.0000000/00",
        "ADV INTERNO": "Nome do advogado"
      }
    ];

    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pauta");
    XLSX.writeFile(wb, "modelo_pauta_audiencias.xlsx");
  };

  const importedCount = rows.filter(r => r.status === 'sucesso').length;
  const errorCount = rows.filter(r => r.status === 'erro').length;

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
          {/* Seletor de Coordenação */}
          <div className="flex items-center gap-3">
            <Building className="h-4 w-4 text-muted-foreground" />
            <Select value={coordenacaoId} onValueChange={setCoordenacaoId}>
              <SelectTrigger className="w-full max-w-sm">
                <SelectValue placeholder="Selecione a coordenação..." />
              </SelectTrigger>
              <SelectContent>
                {coordenacoes.map((coord) => (
                  <SelectItem key={coord.id} value={coord.id}>
                    {coord.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {rows.length === 0 ? (
            <div className="border-2 border-dashed rounded-lg p-8 text-center space-y-4">
              <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <p className="font-medium">Selecione a planilha de pauta semanal</p>
                <p className="text-sm text-muted-foreground">
                  Formato: DATA, HORA, PROCESSO, ÓRGÃO, PARTE AUTORA, RÉUS, DOSSIÊ, ADV INTERNO
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
                  Modelo
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
              {/* Barra de Progresso */}
              <div className="space-y-2 bg-muted/50 rounded-lg p-3">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">
                    {isImporting
                      ? `Importando... ${Math.round(progress)}%`
                      : `${rows.length} audiências prontas para importar`}
                  </span>
                  <span className="text-muted-foreground">
                    {importedCount > 0 && (
                      <span className="text-green-600">{importedCount} ✓</span>
                    )}
                    {errorCount > 0 && (
                      <span className="text-red-600 ml-2">{errorCount} ✗</span>
                    )}
                  </span>
                </div>
                <Progress value={isImporting ? progress : 0} className="h-3" />
              </div>

              <ScrollArea className="h-[350px] border rounded-md">
                <div className="min-w-[1800px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[80px] sticky left-0 bg-background z-10">Status</TableHead>
                        <TableHead>Modalidade</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead>Hora</TableHead>
                        <TableHead>Nº Processo</TableHead>
                        <TableHead>Órgão/Turma</TableHead>
                        <TableHead>Equipe</TableHead>
                        <TableHead>Origem</TableHead>
                        <TableHead>Parte Autora</TableHead>
                        <TableHead>Réus</TableHead>
                        <TableHead>Dossiê</TableHead>
                        <TableHead>Adv Interno</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="sticky left-0 bg-background z-10">
                            {row.status === 'pendente' && <Badge variant="outline">Pendente</Badge>}
                            {row.status === 'sucesso' && <CheckCircle className="h-4 w-4 text-green-500" />}
                            {row.status === 'erro' && (
                              <span title={row.erro}><XCircle className="h-4 w-4 text-red-500" /></span>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">{row.modalidade}</TableCell>
                          <TableCell className="whitespace-nowrap">{formatDisplayDate(row.data)}</TableCell>
                          <TableCell className="whitespace-nowrap">{row.hora_local}</TableCell>
                          <TableCell className="font-mono text-xs whitespace-nowrap">{row.processo_numero}</TableCell>
                          <TableCell className="whitespace-nowrap">{row.vara_camara}</TableCell>
                          <TableCell className="whitespace-nowrap">{row.equipe}</TableCell>
                          <TableCell className="whitespace-nowrap">{row.nucleo_origem}</TableCell>
                          <TableCell className="max-w-[150px] truncate">{row.polo_ativo}</TableCell>
                          <TableCell className="max-w-[150px] truncate">{row.cliente}</TableCell>
                          <TableCell className="whitespace-nowrap font-mono text-xs">{row.dossie}</TableCell>
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
                  setProgress(0);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                disabled={isImporting}
              >
                Limpar
              </Button>
              <Button onClick={handleImport} disabled={isImporting || !coordenacaoId}>
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importando {Math.round(progress)}%...
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
