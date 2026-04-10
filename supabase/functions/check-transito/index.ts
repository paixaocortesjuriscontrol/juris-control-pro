import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { consultarTribunal, extrairTRT } from "./datajud-client.ts";
import { analisarConsulta } from "./transito-detector.ts";
import type {
  ResultadoFinal,
  ResultadoTribunal,
  StatusTransito,
} from "./types.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function reconciliar(
  tst: ResultadoTribunal | null,
  trt: ResultadoTribunal | null,
): { status: StatusTransito; confianca: number; reconciliacao: string } {
  if (!tst && !trt) {
    return { status: "inconclusivo", confianca: 0, reconciliacao: "nenhum tribunal retornou dados" };
  }
  if (!tst && trt) {
    return { status: trt.status, confianca: trt.confianca, reconciliacao: "apenas TRT respondeu" };
  }
  if (!trt && tst) {
    return { status: tst.status, confianca: tst.confianca, reconciliacao: "apenas TST respondeu" };
  }

  const r1 = tst!;
  const r2 = trt!;

  // Regra 1: qualquer "ativo" prevalece
  if (r1.status === "ativo" || r2.status === "ativo") {
    const origem = r1.status === "ativo" ? "TST" : "TRT";
    return {
      status: "ativo",
      confianca: Math.max(r1.confianca, r2.confianca),
      reconciliacao: `${origem} indica movimentação ativa posterior ao trânsito`,
    };
  }

  // Regra 2: ambos transitados
  const isT = (s: StatusTransito) => s === "transitado" || s === "transitado_execucao";
  if (isT(r1.status) && isT(r2.status)) {
    const status: StatusTransito =
      r1.status === "transitado_execucao" || r2.status === "transitado_execucao"
        ? "transitado_execucao"
        : "transitado";
    return {
      status,
      confianca: Math.round((r1.confianca + r2.confianca) / 2),
      reconciliacao: "TST e TRT concordam com o trânsito",
    };
  }

  // Regra 3: um inconclusivo
  if (r1.status === "inconclusivo") {
    return { status: r2.status, confianca: r2.confianca, reconciliacao: "TST inconclusivo; usando resultado do TRT" };
  }
  if (r2.status === "inconclusivo") {
    return { status: r1.status, confianca: r1.confianca, reconciliacao: "TRT inconclusivo; usando resultado do TST" };
  }

  // Regra 4: divergência real
  return { status: "inconclusivo", confianca: 20, reconciliacao: "TST e TRT divergem; revisão manual recomendada" };
}

function selecionarDataTransito(
  tst: ResultadoTribunal | null,
  trt: ResultadoTribunal | null,
): Date | undefined {
  const datas = [tst?.dataTransito, trt?.dataTransito].filter(
    (d): d is Date => d instanceof Date && !isNaN(d.getTime()),
  );
  if (!datas.length) return undefined;
  return new Date(Math.min(...datas.map((d) => d.getTime())));
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ erro: "Método não permitido. Use POST." }, 405);
  }

  let numeroProcesso: string;
  try {
    const body = await req.json() as Record<string, unknown>;
    if (!body?.numeroProcesso || typeof body.numeroProcesso !== "string") {
      throw new Error("campo ausente");
    }
    numeroProcesso = body.numeroProcesso.trim();
  } catch {
    return jsonResponse(
      { erro: "Body inválido. Envie: { \"numeroProcesso\": \"...\" }" },
      400,
    );
  }

  const trtCode = extrairTRT(numeroProcesso);

  const [resultTST, resultTRT] = await Promise.allSettled([
    consultarTribunal("tst", numeroProcesso),
    consultarTribunal(trtCode, numeroProcesso),
  ]);

  const consultaTST = resultTST.status === "fulfilled" ? resultTST.value : null;
  const consultaTRT = resultTRT.status === "fulfilled" ? resultTRT.value : null;

  const analiseTST = consultaTST ? analisarConsulta(consultaTST) : null;
  const analiseTRT = consultaTRT ? analisarConsulta(consultaTRT) : null;

  const { status, confianca, reconciliacao } = reconciliar(analiseTST, analiseTRT);
  const dataTransito = selecionarDataTransito(analiseTST, analiseTRT);

  const resposta: ResultadoFinal = {
    numeroProcesso,
    status,
    confianca,
    dataTransito: dataTransito?.toISOString(),
    detalhes: {
      tst: analiseTST ?? undefined,
      trt: analiseTRT ?? undefined,
      reconciliacao,
    },
  };

  return jsonResponse(resposta, 200);
});
