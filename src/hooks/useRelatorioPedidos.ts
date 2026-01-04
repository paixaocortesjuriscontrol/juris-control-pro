import * as XLSX from "xlsx";
import { toast } from "sonner";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

interface PedidoData {
  numero: string;
  reclamante: string | null;
  cliente: string | null;
  status: string;
  status_pedido: string | null;
  lei_13467_2017: string | null;
  responsabilidade_subsidiaria: string | null;
  pedido_excesso_jornada: boolean | null;
  pedido_plantoes_extras: boolean | null;
  pedido_intervalo_intrajornada: string | null;
  pedido_intervalo_interjornada: boolean | null;
  pedido_dobras: boolean | null;
  pedido_adicional_noturno: string | null;
  pedido_domingos_feriados: string | null;
  pedido_insalubridade_periculosidade: string | null;
  pedido_diferencas_salariais: string | null;
  pedido_danos_morais_assedio: string | null;
  pedido_danos_morais_acidente: string | null;
  pedido_danos_morais_outros: string | null;
  pedido_danos_materiais: boolean | null;
  pedido_acidente_doenca: string | null;
  pedido_sobrecarga_trabalho: string | null;
  pedido_pensao_vitalicia: boolean | null;
  pedido_limbo_previdenciario: boolean | null;
  pedido_estabilidade: string | null;
  pedido_reversao_justa_causa: boolean | null;
  pedido_reversao_pedido_demissao: boolean | null;
  pedido_rescisao_indireta: boolean | null;
  pedido_indenizacao_substitutiva: boolean | null;
  pedido_reconhecimento_vinculo: string | null;
  pedido_descaract_jornada_12_36: boolean | null;
  pedido_multas_clt: string | null;
  pedido_multas_ccts: string | null;
  motivo_encerramento: string | null;
  custo_encerramento: number | null;
}

type TipoPedido = 
  | "todos"
  | "horas_extras"
  | "adicionais"
  | "danos_morais"
  | "acidente_doenca"
  | "estabilidade"
  | "multas";

const boolToStr = (val: boolean | null): string => val ? "Sim" : "Não";

export function useRelatorioPedidos() {
  const exportarRelatorioPedidos = async (tipo: TipoPedido = "todos") => {
    try {
      toast.info("Carregando dados...");

      const { data, error } = await supabase
        .from("processos")
        .select(`
          numero, reclamante, status, status_pedido,
          lei_13467_2017, responsabilidade_subsidiaria,
          pedido_excesso_jornada, pedido_plantoes_extras,
          pedido_intervalo_intrajornada, pedido_intervalo_interjornada,
          pedido_dobras, pedido_adicional_noturno, pedido_domingos_feriados,
          pedido_insalubridade_periculosidade, pedido_diferencas_salariais,
          pedido_danos_morais_assedio, pedido_danos_morais_acidente,
          pedido_danos_morais_outros, pedido_danos_materiais,
          pedido_acidente_doenca, pedido_sobrecarga_trabalho,
          pedido_pensao_vitalicia, pedido_limbo_previdenciario,
          pedido_estabilidade, pedido_reversao_justa_causa,
          pedido_reversao_pedido_demissao, pedido_rescisao_indireta,
          pedido_indenizacao_substitutiva, pedido_reconhecimento_vinculo,
          pedido_descaract_jornada_12_36, pedido_multas_clt, pedido_multas_ccts,
          motivo_encerramento, custo_encerramento,
          clientes(nome)
        `)
        .eq("categoria_importacao", "Pedidos")
        .order("numero");

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.error("Nenhum processo de pedidos encontrado");
        return;
      }

      // Filtrar por tipo se necessário
      let processosFiltrados = data as unknown as (PedidoData & { clientes: { nome: string } | null })[];
      
      if (tipo !== "todos") {
        processosFiltrados = processosFiltrados.filter(p => {
          switch (tipo) {
            case "horas_extras":
              return p.pedido_excesso_jornada || p.pedido_plantoes_extras || 
                     p.pedido_intervalo_intrajornada || p.pedido_intervalo_interjornada ||
                     p.pedido_dobras;
            case "adicionais":
              return p.pedido_adicional_noturno || p.pedido_domingos_feriados ||
                     p.pedido_insalubridade_periculosidade || p.pedido_diferencas_salariais;
            case "danos_morais":
              return p.pedido_danos_morais_assedio || p.pedido_danos_morais_acidente ||
                     p.pedido_danos_morais_outros || p.pedido_danos_materiais;
            case "acidente_doenca":
              return p.pedido_acidente_doenca || p.pedido_sobrecarga_trabalho ||
                     p.pedido_pensao_vitalicia || p.pedido_limbo_previdenciario;
            case "estabilidade":
              return p.pedido_estabilidade || p.pedido_reversao_justa_causa ||
                     p.pedido_reversao_pedido_demissao || p.pedido_rescisao_indireta ||
                     p.pedido_indenizacao_substitutiva || p.pedido_reconhecimento_vinculo ||
                     p.pedido_descaract_jornada_12_36;
            case "multas":
              return p.pedido_multas_clt || p.pedido_multas_ccts;
            default:
              return true;
          }
        });
      }

      if (processosFiltrados.length === 0) {
        toast.error(`Nenhum processo encontrado com pedidos do tipo "${getTipoLabel(tipo)}"`);
        return;
      }

      // Gerar dados para Excel baseado no tipo
      const dados = processosFiltrados.map(p => {
        const base = {
          "PROCESSO": p.numero,
          "RECLAMANTE": p.reclamante || "",
          "CLIENTE": p.clientes?.nome || "",
          "STATUS": p.status,
          "STATUS PEDIDO": p.status_pedido || "",
        };

        if (tipo === "todos") {
          return {
            ...base,
            "LEI 13.467/2017": p.lei_13467_2017 || "",
            "RESP. SUBSIDIÁRIA": p.responsabilidade_subsidiaria || "",
            "EXCESSO JORNADA": boolToStr(p.pedido_excesso_jornada),
            "PLANTÕES EXTRAS": boolToStr(p.pedido_plantoes_extras),
            "INTERVALO INTRAJORNADA": p.pedido_intervalo_intrajornada || "",
            "INTERVALO INTERJORNADA": boolToStr(p.pedido_intervalo_interjornada),
            "DOBRAS": boolToStr(p.pedido_dobras),
            "ADICIONAL NOTURNO": p.pedido_adicional_noturno || "",
            "DOMINGOS/FERIADOS": p.pedido_domingos_feriados || "",
            "INSALUBRIDADE/PERICULOSIDADE": p.pedido_insalubridade_periculosidade || "",
            "DIFERENÇAS SALARIAIS": p.pedido_diferencas_salariais || "",
            "DANOS MORAIS ASSÉDIO": p.pedido_danos_morais_assedio || "",
            "DANOS MORAIS ACIDENTE": p.pedido_danos_morais_acidente || "",
            "DANOS MORAIS OUTROS": p.pedido_danos_morais_outros || "",
            "DANOS MATERIAIS": boolToStr(p.pedido_danos_materiais),
            "ACIDENTE/DOENÇA": p.pedido_acidente_doenca || "",
            "SOBRECARGA TRABALHO": p.pedido_sobrecarga_trabalho || "",
            "PENSÃO VITALÍCIA": boolToStr(p.pedido_pensao_vitalicia),
            "LIMBO PREVIDENCIÁRIO": boolToStr(p.pedido_limbo_previdenciario),
            "ESTABILIDADE": p.pedido_estabilidade || "",
            "REVERSÃO JUSTA CAUSA": boolToStr(p.pedido_reversao_justa_causa),
            "REVERSÃO PEDIDO DEMISSÃO": boolToStr(p.pedido_reversao_pedido_demissao),
            "RESCISÃO INDIRETA": boolToStr(p.pedido_rescisao_indireta),
            "INDENIZAÇÃO SUBSTITUTIVA": boolToStr(p.pedido_indenizacao_substitutiva),
            "RECONHECIMENTO VÍNCULO": p.pedido_reconhecimento_vinculo || "",
            "DESCARACT. 12x36": boolToStr(p.pedido_descaract_jornada_12_36),
            "MULTAS CLT": p.pedido_multas_clt || "",
            "MULTAS CCTs": p.pedido_multas_ccts || "",
            "MOTIVO ENCERRAMENTO": p.motivo_encerramento || "",
            "CUSTO ENCERRAMENTO": p.custo_encerramento || "",
          };
        }

        if (tipo === "horas_extras") {
          return {
            ...base,
            "EXCESSO JORNADA": boolToStr(p.pedido_excesso_jornada),
            "PLANTÕES EXTRAS": boolToStr(p.pedido_plantoes_extras),
            "INTERVALO INTRAJORNADA": p.pedido_intervalo_intrajornada || "",
            "INTERVALO INTERJORNADA": boolToStr(p.pedido_intervalo_interjornada),
            "DOBRAS": boolToStr(p.pedido_dobras),
          };
        }

        if (tipo === "adicionais") {
          return {
            ...base,
            "ADICIONAL NOTURNO": p.pedido_adicional_noturno || "",
            "DOMINGOS/FERIADOS": p.pedido_domingos_feriados || "",
            "INSALUBRIDADE/PERICULOSIDADE": p.pedido_insalubridade_periculosidade || "",
            "DIFERENÇAS SALARIAIS": p.pedido_diferencas_salariais || "",
          };
        }

        if (tipo === "danos_morais") {
          return {
            ...base,
            "DANOS MORAIS ASSÉDIO": p.pedido_danos_morais_assedio || "",
            "DANOS MORAIS ACIDENTE": p.pedido_danos_morais_acidente || "",
            "DANOS MORAIS OUTROS": p.pedido_danos_morais_outros || "",
            "DANOS MATERIAIS": boolToStr(p.pedido_danos_materiais),
          };
        }

        if (tipo === "acidente_doenca") {
          return {
            ...base,
            "ACIDENTE/DOENÇA": p.pedido_acidente_doenca || "",
            "SOBRECARGA TRABALHO": p.pedido_sobrecarga_trabalho || "",
            "PENSÃO VITALÍCIA": boolToStr(p.pedido_pensao_vitalicia),
            "LIMBO PREVIDENCIÁRIO": boolToStr(p.pedido_limbo_previdenciario),
          };
        }

        if (tipo === "estabilidade") {
          return {
            ...base,
            "ESTABILIDADE": p.pedido_estabilidade || "",
            "REVERSÃO JUSTA CAUSA": boolToStr(p.pedido_reversao_justa_causa),
            "REVERSÃO PEDIDO DEMISSÃO": boolToStr(p.pedido_reversao_pedido_demissao),
            "RESCISÃO INDIRETA": boolToStr(p.pedido_rescisao_indireta),
            "INDENIZAÇÃO SUBSTITUTIVA": boolToStr(p.pedido_indenizacao_substitutiva),
            "RECONHECIMENTO VÍNCULO": p.pedido_reconhecimento_vinculo || "",
            "DESCARACT. 12x36": boolToStr(p.pedido_descaract_jornada_12_36),
          };
        }

        if (tipo === "multas") {
          return {
            ...base,
            "MULTAS CLT": p.pedido_multas_clt || "",
            "MULTAS CCTs": p.pedido_multas_ccts || "",
          };
        }

        return base;
      });

      const ws = XLSX.utils.json_to_sheet(dados);
      
      // Ajustar largura das colunas
      const colWidths = Object.keys(dados[0] || {}).map(() => ({ wch: 20 }));
      colWidths[0] = { wch: 28 }; // PROCESSO
      ws['!cols'] = colWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `Pedidos - ${getTipoLabel(tipo)}`);
      
      const fileName = `relatorio_pedidos_${tipo}_${format(new Date(), "dd-MM-yyyy")}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      toast.success(`${processosFiltrados.length} processos exportados!`);
    } catch (error) {
      console.error("Erro ao exportar relatório:", error);
      toast.error("Erro ao exportar relatório de pedidos");
    }
  };

  return { exportarRelatorioPedidos };
}

function getTipoLabel(tipo: TipoPedido): string {
  const labels: Record<TipoPedido, string> = {
    todos: "Todos",
    horas_extras: "Horas Extras",
    adicionais: "Adicionais",
    danos_morais: "Danos Morais",
    acidente_doenca: "Acidente/Doença",
    estabilidade: "Estabilidade",
    multas: "Multas",
  };
  return labels[tipo];
}

export type { TipoPedido };
