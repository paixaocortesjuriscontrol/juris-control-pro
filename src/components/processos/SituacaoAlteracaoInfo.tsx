import { CalendarCheck, MessageSquare, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HistoricoSituacaoItem } from "@/hooks/useHistoricoSituacaoItens";

const LABELS: Record<string, string> = {
  pendente: "Pendente",
  em_execucao: "Em execução",
  a_confirmar: "A confirmar",
  revisao: "Em revisão",
  verificado: "Verificado",
  cumprido: "Cumprido",
  concluido: "Concluído",
  concluido_sem_sucesso: "Concluído sem sucesso",
  protocolado: "Protocolado",
  baixado: "Baixado",
  minutado_revisao: "Minutado para revisão",
  reagendado: "Reagendado",
  tratado: "Tratado",
  atrasado: "Atrasado",
  cancelado: "Cancelado",
  cancelado_oculto: "Cancelado",
  confirmado: "Confirmado",
  realizada: "Realizada",
  cancelada: "Cancelada",
};

const rotulo = (valor?: string | null) =>
  valor ? LABELS[String(valor).toLowerCase()] || String(valor) : "—";

const CONCLUIDAS = new Set(["cumprido", "concluido", "tratado", "verificado", "realizada", "confirmado"]);
const CANCELADAS = new Set(["cancelado", "cancelado_oculto", "cancelada", "concluido_sem_sucesso"]);

function formatarDataHora(valor?: string | null) {
  if (!valor) return null;
  const d = new Date(valor);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface Props {
  historico?: HistoricoSituacaoItem | null;
  /** Situação atual do item, usada quando não há registro de auditoria */
  situacaoAtual?: string | null;
  /** Justificativa/observações preenchidas no próprio item */
  justificativa?: string | null;
  className?: string;
}

/**
 * Mostra, na lista de prazos, tarefas, eventos, audiências e parcelamentos,
 * quando a situação foi alterada, quem alterou e, quando houver, a
 * justificativa e o último comentário registrado.
 */
export function SituacaoAlteracaoInfo({ historico, situacaoAtual, justificativa, className }: Props) {
  const quando = formatarDataHora(historico?.quando);
  const situacao = historico?.situacaoPara || situacaoAtual;
  const temComentario = !!historico?.comentario?.conteudo;
  const temJustificativa = !!justificativa?.trim();

  if (!quando && !temComentario && !temJustificativa) return null;

  const chave = String(situacao || "").toLowerCase();
  const cor = CONCLUIDAS.has(chave)
    ? "text-emerald-600 dark:text-emerald-400"
    : CANCELADAS.has(chave)
      ? "text-destructive"
      : "text-muted-foreground";

  return (
    <div className={cn("space-y-1 text-[11px]", className)}>
      {quando && (
        <p className={cn("flex items-start gap-1", cor)}>
          <CalendarCheck className="h-3 w-3 mt-[1px] shrink-0" />
          <span className="break-words">
            {rotulo(situacao)} em {quando}
            {historico?.autorNome ? ` por ${historico.autorNome}` : ""}
            {historico?.situacaoDe ? ` (antes: ${rotulo(historico.situacaoDe)})` : ""}
          </span>
        </p>
      )}
      {temJustificativa && (
        <p className="flex items-start gap-1 text-muted-foreground">
          <User className="h-3 w-3 mt-[1px] shrink-0" />
          <span className="break-words line-clamp-2">Justificativa: {justificativa}</span>
        </p>
      )}
      {temComentario && (
        <p className="flex items-start gap-1 text-muted-foreground">
          <MessageSquare className="h-3 w-3 mt-[1px] shrink-0" />
          <span className="break-words line-clamp-2">
            {historico!.comentario!.conteudo}
            {historico!.comentario!.autorNome ? ` — ${historico!.comentario!.autorNome}` : ""}
            {formatarDataHora(historico!.comentario!.quando)
              ? `, ${formatarDataHora(historico!.comentario!.quando)}`
              : ""}
          </span>
        </p>
      )}
    </div>
  );
}
