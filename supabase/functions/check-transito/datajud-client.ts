import type { ConsultaProcesso, Movimentacao, TribunalCode } from "./types.ts";

const DATAJUD_BASE = "https://api-publica.datajud.cnj.jus.br";
const API_KEY = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==";
const TIMEOUT_MS = 12_000;

function endpoint(tribunal: TribunalCode): string {
  return `${DATAJUD_BASE}/api_publica_${tribunal}/_search`;
}

function buildQuery(numeroProcesso: string): Record<string, unknown> {
  // DataJud indexes numeroProcesso as digits only (no punctuation)
  const digits = numeroProcesso.replace(/\D/g, "");
  return {
    size: 1,
    _source: ["movimentos", "numeroProcesso", "classe", "grau"],
    query: {
      match: { numeroProcesso: digits },
    },
  };
}

function normalizarMovimentacao(raw: Record<string, unknown>): Movimentacao {
  const codigo = Number(raw["codigo"] ?? 0);
  const nome = String(raw["nome"] ?? "").trim();
  const dataHora = String(raw["dataHora"] ?? "");

  const complementosTabelados = (
    raw["complementosTabelados"] as Array<{ descricao?: string }> | undefined
  ) ?? [];
  const complemento = complementosTabelados
    .map((c) => c.descricao ?? "")
    .filter(Boolean)
    .join(" ")
    .trim() || undefined;

  return { codigo, nome, dataHora, complemento };
}

export async function consultarTribunal(
  tribunal: TribunalCode,
  numeroProcesso: string,
): Promise<ConsultaProcesso | null> {
  try {
    const res = await fetch(endpoint(tribunal), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `ApiKey ${API_KEY}`,
      },
      body: JSON.stringify(buildQuery(numeroProcesso)),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) return null;

    const data = await res.json() as {
      hits?: { hits?: Array<{ _source?: Record<string, unknown> }> };
    };

    const source = data?.hits?.hits?.[0]?._source;
    if (!source) return null;

    const movimentacoes: Movimentacao[] = (
      (source["movimentos"] as Array<Record<string, unknown>>) ?? []
    )
      .map(normalizarMovimentacao)
      .filter((m) => m.dataHora)
      .sort(
        (a, b) =>
          new Date(a.dataHora).getTime() - new Date(b.dataHora).getTime(),
      );

    return { numeroProcesso, movimentacoes, tribunal };
  } catch {
    return null;
  }
}

export function extrairTRT(numeroProcesso: string): TribunalCode {
  const digits = numeroProcesso.replace(/\D/g, "");
  const trtNum = parseInt(digits.slice(14, 16), 10);
  if (Number.isNaN(trtNum) || trtNum < 1 || trtNum > 24) {
    return "trt1" as TribunalCode;
  }
  return `trt${trtNum}` as TribunalCode;
}
