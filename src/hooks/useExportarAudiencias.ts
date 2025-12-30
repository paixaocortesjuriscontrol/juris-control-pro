import * as XLSX from "xlsx";
import { AudienciaDetectada } from "./useAudienciasDetectadas";
import { format, parseISO, isValid } from "date-fns";
import { toast } from "sonner";

export function useExportarAudiencias() {
  const exportarExcel = (audiencias: AudienciaDetectada[], nomeArquivo?: string) => {
    if (audiencias.length === 0) {
      toast.error("Nenhuma audiência para exportar");
      return;
    }

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

    const dados = audiencias.map(a => ({
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
      "ADVOGADO": a.advogado || "",
      "STATUS": a.status === 'pendente' ? 'Pendente' : a.status === 'tratado' ? 'Tratado' : 'Ignorado',
      "OBSERVAÇÕES": a.observacoes || "",
    }));

    const ws = XLSX.utils.json_to_sheet(dados);
    
    // Ajustar largura das colunas
    const colWidths = [
      { wch: 12 }, // DATA
      { wch: 8 },  // HORA
      { wch: 28 }, // PROCESSO
      { wch: 12 }, // VT/CÂMARA
      { wch: 15 }, // COMARCA
      { wch: 30 }, // POLO ATIVO
      { wch: 35 }, // CLIENTE
      { wch: 25 }, // TERCEIRIZADO
      { wch: 25 }, // TIPO
      { wch: 50 }, // RESUMO
      { wch: 20 }, // FUNÇÃO
      { wch: 30 }, // PREPOSTO
      { wch: 25 }, // TESTEMUNHAS
      { wch: 15 }, // ADVOGADO
      { wch: 10 }, // STATUS
      { wch: 30 }, // OBSERVAÇÕES
    ];
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pauta de Audiências");
    
    const fileName = nomeArquivo || `pauta_audiencias_${format(new Date(), "dd-MM-yyyy")}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    toast.success(`${audiencias.length} audiências exportadas!`);
  };

  return { exportarExcel };
}