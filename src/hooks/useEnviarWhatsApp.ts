import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toZonedTime } from "date-fns-tz";

interface EnviarAlertaEventoParams {
  eventoTitulo: string;
  eventoDescricao?: string | null;
  eventoData: string;
  eventoHora?: string;
  eventoLocal?: string;
  participantesTelefones: string[];
  tipo?: "evento" | "lembrete" | "cancelamento";
}

interface ResultadoEnvio {
  sucesso: boolean;
  enviados: number;
  falhas: number;
  resultados: { telefone: string; sucesso: boolean; erro?: string }[];
}

export function useEnviarWhatsApp() {
  return useMutation({
    mutationFn: async ({
      eventoTitulo,
      eventoDescricao,
      eventoData,
      eventoHora,
      eventoLocal,
      participantesTelefones,
      tipo = "evento",
    }: EnviarAlertaEventoParams): Promise<ResultadoEnvio> => {
      if (!participantesTelefones || participantesTelefones.length === 0) {
        throw new Error("Nenhum participante com telefone cadastrado");
      }

      // Formatar a data para exibição
      const dataZonada = toZonedTime(new Date(eventoData), 'America/Sao_Paulo');
      const dataFormatada = format(dataZonada, "dd/MM/yyyy", { locale: ptBR });
      
      // Montar a mensagem baseada no tipo
      let mensagem = "";
      const emoji = tipo === "cancelamento" ? "❌" : tipo === "lembrete" ? "⏰" : "📅";
      
      if (tipo === "cancelamento") {
        mensagem = `${emoji} *EVENTO CANCELADO*\n\n`;
        mensagem += `O evento *${eventoTitulo}* agendado para ${dataFormatada}`;
        if (eventoHora) mensagem += ` às ${eventoHora}`;
        mensagem += ` foi cancelado.`;
      } else if (tipo === "lembrete") {
        mensagem = `${emoji} *LEMBRETE DE EVENTO*\n\n`;
        mensagem += `Você tem um compromisso agendado:\n\n`;
        mensagem += `📌 *${eventoTitulo}*\n`;
        mensagem += `📆 Data: ${dataFormatada}\n`;
        if (eventoHora) mensagem += `🕐 Horário: ${eventoHora}\n`;
        if (eventoLocal) mensagem += `📍 Local: ${eventoLocal}\n`;
        if (eventoDescricao) mensagem += `\n📝 *Descrição:*\n${eventoDescricao}\n`;
      } else {
        mensagem = `${emoji} *NOVO EVENTO AGENDADO*\n\n`;
        mensagem += `Você foi adicionado a um evento:\n\n`;
        mensagem += `📌 *${eventoTitulo}*\n`;
        mensagem += `📆 Data: ${dataFormatada}\n`;
        if (eventoHora) mensagem += `🕐 Horário: ${eventoHora}\n`;
        if (eventoLocal) mensagem += `📍 Local: ${eventoLocal}\n`;
        if (eventoDescricao) mensagem += `\n📝 *Descrição:*\n${eventoDescricao}\n`;
      }

      mensagem += `\n_JurisControl - Sistema de Gestão Jurídica_`;

      const { data, error } = await supabase.functions.invoke("enviar-whatsapp-zapi", {
        body: {
          telefones: participantesTelefones,
          mensagem,
          tipo,
        },
      });

      if (error) {
        console.error("Erro ao enviar WhatsApp:", error);
        throw new Error(error.message || "Erro ao enviar mensagens WhatsApp");
      }

      return data as ResultadoEnvio;
    },
    onSuccess: (data) => {
      if (data.enviados > 0) {
        toast.success(`WhatsApp enviado para ${data.enviados} participante(s)`);
      }
      if (data.falhas > 0) {
        toast.warning(`${data.falhas} mensagem(ns) não puderam ser enviadas`);
      }
    },
    onError: (error: Error) => {
      toast.error("Erro ao enviar WhatsApp: " + error.message);
    },
  });
}

// Hook para buscar telefones dos participantes
export function useBuscarTelefonesParticipantes() {
  return useMutation({
    mutationFn: async (usuarioIds: string[]): Promise<{ id: string; nome: string; telefone: string | null }[]> => {
      if (!usuarioIds || usuarioIds.length === 0) {
        return [];
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome, telefone")
        .in("id", usuarioIds);

      if (error) throw error;
      return data || [];
    },
  });
}
