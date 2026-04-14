/**
 * Calculador de status de trânsito em julgado.
 *
 * Função PURA — não acessa banco, recebe movimentos já classificados.
 * Lógica determinística e auditável.
 */

import { ehFeriado, ehRecesso } from "./feriados.ts";

// ============================================================
// TIPOS
// ============================================================

export type MovimentacaoClassificada = {
  data: string; // ISO date "YYYY-MM-DD"
  descricao: string;
  codigo?: string | null;
  eh_decisao_recorrivel: boolean;
  eh_recurso_interposto: boolean;
  eh_certidao_transito: boolean;
};

export type StatusTransitoResult = {
  status: "transitado_confirmado" | "transitado_provavel" | "em_curso";
  data_transito_estimada: string | null; // ISO date
  justificativa: string; // explicação legível para auditoria
};

type Opts = {
  tribunal_origem: string;
  hoje?: Date;
};

// ============================================================
// DIAS ÚTEIS
// ============================================================

/**
 * Adiciona N dias úteis a uma data, pulando:
 * - Sábados e domingos
 * - Feriados nacionais
 * - Recesso forense (20/12 a 20/01, art. 775-A CLT)
 */
export function adicionarDiasUteis(
  dataBase: Date,
  dias: number,
  _feriados?: string[]
): Date {
  let resultado = new Date(dataBase);
  let contados = 0;

  while (contados < dias) {
    resultado.setDate(resultado.getDate() + 1);

    // Pular sábado (6) e domingo (0)
    const dow = resultado.getDay();
    if (dow === 0 || dow === 6) continue;

    // Pular feriados
    const iso = resultado.toISOString().substring(0, 10);
    if (ehFeriado(iso)) continue;

    // Pular recesso forense
    if (ehRecesso(resultado)) continue;

    contados++;
  }

  return resultado;
}

function formatDate(d: Date): string {
  return d.toISOString().substring(0, 10);
}

function parseDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// ============================================================
// PRAZO RECURSAL PADRÃO
// ============================================================

/**
 * Prazo padrão para recurso trabalhista: 8 dias úteis (CLT).
 * Pode ser parametrizado futuramente por tipo de recurso.
 */
const PRAZO_RECURSAL_DIAS_UTEIS = 8;

// ============================================================
// FUNÇÃO PRINCIPAL
// ============================================================

export function calcularStatusTransito(
  movimentacoes: MovimentacaoClassificada[],
  opts: Opts
): StatusTransitoResult {
  const hoje = opts.hoje ?? new Date();

  // Ordenar movimentações por data crescente
  const movs = [...movimentacoes].sort(
    (a, b) => parseDate(a.data).getTime() - parseDate(b.data).getTime()
  );

  // ── 1. Certidão de trânsito em julgado (prioridade máxima) ──
  const certidoes = movs.filter((m) => m.eh_certidao_transito);
  if (certidoes.length > 0) {
    // Pega a mais antiga (primeira certidão)
    const primeira = certidoes[0];
    return {
      status: "transitado_confirmado",
      data_transito_estimada: primeira.data,
      justificativa: `Certidão de trânsito em julgado registrada em ${primeira.data}`,
    };
  }

  // ── 2. Decisão recorrível mais recente ──
  const decisoes = movs.filter((m) => m.eh_decisao_recorrivel);
  if (decisoes.length > 0) {
    // Pega a decisão recorrível mais recente
    const decisaoRecente = decisoes[decisoes.length - 1];
    const dataDecisao = parseDate(decisaoRecente.data);

    // Prazo limite: 8 dias úteis após a decisão
    const prazoLimite = adicionarDiasUteis(
      dataDecisao,
      PRAZO_RECURSAL_DIAS_UTEIS
    );

    // Verifica se existe recurso interposto APÓS a decisão E dentro do prazo
    const recursoPosterior = movs.find((m) => {
      if (!m.eh_recurso_interposto) return false;
      const dataRecurso = parseDate(m.data);
      return (
        dataRecurso.getTime() > dataDecisao.getTime() &&
        dataRecurso.getTime() <= prazoLimite.getTime()
      );
    });

    if (recursoPosterior) {
      return {
        status: "em_curso",
        data_transito_estimada: null,
        justificativa: `Recurso interposto em ${recursoPosterior.data} dentro do prazo após decisão de ${decisaoRecente.data}`,
      };
    }

    // Recurso fora do prazo? Intempestivo — não conta
    const recursoIntempestivo = movs.find((m) => {
      if (!m.eh_recurso_interposto) return false;
      const dataRecurso = parseDate(m.data);
      return (
        dataRecurso.getTime() > dataDecisao.getTime() &&
        dataRecurso.getTime() > prazoLimite.getTime()
      );
    });

    if (hoje.getTime() > prazoLimite.getTime()) {
      // Prazo expirou sem recurso tempestivo
      const diaSeguinte = new Date(prazoLimite);
      diaSeguinte.setDate(diaSeguinte.getDate() + 1);

      let justificativa = `Decurso de prazo sem recurso após decisão de ${decisaoRecente.data}`;
      if (recursoIntempestivo) {
        justificativa += ` (recurso intempestivo em ${recursoIntempestivo.data} desconsiderado)`;
      }

      return {
        status: "transitado_provavel",
        data_transito_estimada: formatDate(diaSeguinte),
        justificativa,
      };
    }

    // Ainda dentro do prazo
    return {
      status: "em_curso",
      data_transito_estimada: null,
      justificativa: `Dentro do prazo recursal (até ${formatDate(prazoLimite)}) após decisão de ${decisaoRecente.data}`,
    };
  }

  // ── 3. Nenhuma decisão recorrível encontrada ──
  return {
    status: "em_curso",
    data_transito_estimada: null,
    justificativa: "Sem decisão recorrível identificada nas movimentações",
  };
}
