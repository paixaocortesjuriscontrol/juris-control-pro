import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, Download, FileSpreadsheet, Filter } from "lucide-react";
import { useAudienciasDetectadas, AudienciaDetectada } from "@/hooks/useAudienciasDetectadas";
import { format, parseISO, isValid, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

type PeriodoPreset = "semana_atual" | "proxima_semana" | "mes_atual" | "personalizado";

export function RelatorioAudienciasDiretoria() {
  const [periodoPreset, setPeriodoPreset] = useState<PeriodoPreset>("semana_atual");
  const [dataInicio, setDataInicio] = useState(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    return format(start, "yyyy-MM-dd");
  });
  const [dataFim, setDataFim] = useState(() => {
    const end = endOfWeek(new Date(), { weekStartsOn: 1 });
    return format(end, "yyyy-MM-dd");
  });

  // Buscar audiências com filtro de data
  const { audiencias, isLoading } = useAudienciasDetectadas({
    status: "todos",
    dataInicio,
    dataFim,
  });

  // Buscar advogados associados a cada audiência
  const { data: advogadosMap } = useQuery({
    queryKey: ["audiencias-advogados", audiencias.map(a => a.id)],
    queryFn: async () => {
      if (audiencias.length === 0) return {};

      const { data, error } = await supabase
        .from("audiencias_advogados")
        .select(`
          audiencia_id,
          profiles:advogado_id (
            nome
          )
        `)
        .in("audiencia_id", audiencias.map(a => a.id));

      if (error) throw error;

      const map: Record<string, string[]> = {};
      data?.forEach((item: any) => {
        if (!map[item.audiencia_id]) {
          map[item.audiencia_id] = [];
        }
        if (item.profiles?.nome) {
          map[item.audiencia_id].push(item.profiles.nome);
        }
      });

      return map;
    },
    enabled: audiencias.length > 0,
  });

  const handlePresetChange = (preset: PeriodoPreset) => {
    setPeriodoPreset(preset);
    const today = new Date();

    switch (preset) {
      case "semana_atual":
        setDataInicio(format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd"));
        setDataFim(format(endOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd"));
        break;
      case "proxima_semana":
        const nextWeekStart = addDays(startOfWeek(today, { weekStartsOn: 1 }), 7);
        setDataInicio(format(nextWeekStart, "yyyy-MM-dd"));
        setDataFim(format(addDays(nextWeekStart, 6), "yyyy-MM-dd"));
        break;
      case "mes_atual":
        setDataInicio(format(startOfMonth(today), "yyyy-MM-dd"));
        setDataFim(format(endOfMonth(today), "yyyy-MM-dd"));
        break;
      case "personalizado":
        // Mantém as datas atuais
        break;
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "";
    try {
      const date = parseISO(dateStr);
      if (!isValid(date)) return "";
      return format(date, "dd/MM/yyyy");
    } catch {
      return "";
    }
  };

  const getAdvogadosNomes = (audiencia: AudienciaDetectada) => {
    // Primeiro tenta do mapa de advogados associados
    const advogadosAssociados = advogadosMap?.[audiencia.id] || [];
    if (advogadosAssociados.length > 0) {
      return advogadosAssociados.join(", ");
    }
    // Fallback para o campo advogado legado
    return audiencia.advogado || "";
  };

  const exportarExcelDiretoria = () => {
    if (audiencias.length === 0) {
      toast.error("Nenhuma audiência para exportar no período selecionado");
      return;
    }

    // Ordenar por data e hora
    const audienciasOrdenadas = [...audiencias].sort((a, b) => {
      const dataA = a.data_audiencia || "";
      const dataB = b.data_audiencia || "";
      if (dataA !== dataB) return dataA.localeCompare(dataB);
      const horaA = a.hora || "";
      const horaB = b.hora || "";
      return horaA.localeCompare(horaB);
    });

    const dados = audienciasOrdenadas.map(a => ({
      "DATA": formatDate(a.data_audiencia),
      "HORA": a.hora || "",
      "NÚMERO PROCESSO": a.processo_numero || "",
      "VT/ CÂMARA": a.vara_camara || "",
      "COMARCA": a.comarca || "",
      "POLO ATIVO": a.polo_ativo || "",
      "CLIENTE": a.cliente || "",
      "TERCEIRIZADO": a.terceirizado || "",
      "TIPO": a.tipo_audiencia || "",
      "RESUMO DO OBJETO": a.resumo_objeto || "",
      "FUNÇÃO": a.funcao || "",
      "PREPOSTO": a.preposto || "",
      "TESTEMUNHAS": a.testemunhas || "",
      "ADVOGADO": getAdvogadosNomes(a),
    }));

    const ws = XLSX.utils.json_to_sheet(dados);

    // Ajustar largura das colunas conforme modelo
    const colWidths = [
      { wch: 12 },  // DATA
      { wch: 6 },   // HORA
      { wch: 28 },  // NÚMERO PROCESSO
      { wch: 20 },  // VT/ CÂMARA
      { wch: 15 },  // COMARCA
      { wch: 40 },  // POLO ATIVO
      { wch: 45 },  // CLIENTE
      { wch: 25 },  // TERCEIRIZADO
      { wch: 25 },  // TIPO
      { wch: 80 },  // RESUMO DO OBJETO
      { wch: 30 },  // FUNÇÃO
      { wch: 50 },  // PREPOSTO
      { wch: 15 },  // TESTEMUNHAS
      { wch: 15 },  // ADVOGADO
    ];
    ws["!cols"] = colWidths;

    const wb = XLSX.utils.book_new();
    
    // Nome da aba com o período
    const periodoLabel = `${formatDate(dataInicio)} a ${formatDate(dataFim)}`.replace(/\//g, ".");
    XLSX.utils.book_append_sheet(wb, ws, "Pauta Semanal");

    // Nome do arquivo
    const fileName = `PAUTA_SEMANAL_${format(parseISO(dataInicio), "dd.MM")}_a_${format(parseISO(dataFim), "dd.MM")}.xlsx`;
    XLSX.writeFile(wb, fileName);

    toast.success(`${audiencias.length} audiências exportadas para ${fileName}`);
  };

  const periodoLabel = () => {
    const inicio = formatDate(dataInicio);
    const fim = formatDate(dataFim);
    return `${inicio} a ${fim}`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Pauta Semanal para Diretoria
          </CardTitle>
          <CardDescription>
            Gere a pauta de audiências no formato padrão para envio à diretoria
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Filtros */}
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 max-w-[200px]">
              <Label>Período</Label>
              <Select value={periodoPreset} onValueChange={(v) => handlePresetChange(v as PeriodoPreset)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="semana_atual">Semana Atual</SelectItem>
                  <SelectItem value="proxima_semana">Próxima Semana</SelectItem>
                  <SelectItem value="mes_atual">Mês Atual</SelectItem>
                  <SelectItem value="personalizado">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <div>
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => {
                    setDataInicio(e.target.value);
                    setPeriodoPreset("personalizado");
                  }}
                />
              </div>
              <div>
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={dataFim}
                  onChange={(e) => {
                    setDataFim(e.target.value);
                    setPeriodoPreset("personalizado");
                  }}
                />
              </div>
            </div>

            <Button onClick={exportarExcelDiretoria} disabled={audiencias.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Exportar Excel
            </Button>
          </div>

          {/* Info do período */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>Período: <strong>{periodoLabel()}</strong></span>
            <span className="mx-2">•</span>
            <span>{audiencias.length} audiência(s) encontrada(s)</span>
          </div>

          {/* Preview da tabela */}
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : audiencias.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma audiência encontrada no período selecionado</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">DATA</TableHead>
                    <TableHead className="whitespace-nowrap">HORA</TableHead>
                    <TableHead className="whitespace-nowrap">PROCESSO</TableHead>
                    <TableHead className="whitespace-nowrap">VT/CÂMARA</TableHead>
                    <TableHead className="whitespace-nowrap">COMARCA</TableHead>
                    <TableHead className="whitespace-nowrap">POLO ATIVO</TableHead>
                    <TableHead className="whitespace-nowrap">CLIENTE</TableHead>
                    <TableHead className="whitespace-nowrap">TIPO</TableHead>
                    <TableHead className="whitespace-nowrap">ADVOGADO</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {audiencias
                    .slice()
                    .sort((a, b) => {
                      const dataA = a.data_audiencia || "";
                      const dataB = b.data_audiencia || "";
                      if (dataA !== dataB) return dataA.localeCompare(dataB);
                      return (a.hora || "").localeCompare(b.hora || "");
                    })
                    .map((audiencia) => (
                      <TableRow key={audiencia.id}>
                        <TableCell className="whitespace-nowrap">{formatDate(audiencia.data_audiencia)}</TableCell>
                        <TableCell className="whitespace-nowrap">{audiencia.hora || "-"}</TableCell>
                        <TableCell className="font-mono text-xs">{audiencia.processo_numero || "-"}</TableCell>
                        <TableCell>{audiencia.vara_camara || "-"}</TableCell>
                        <TableCell>{audiencia.comarca || "-"}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{audiencia.polo_ativo || "-"}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{audiencia.cliente || "-"}</TableCell>
                        <TableCell>{audiencia.tipo_audiencia || "-"}</TableCell>
                        <TableCell>{getAdvogadosNomes(audiencia) || "-"}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
