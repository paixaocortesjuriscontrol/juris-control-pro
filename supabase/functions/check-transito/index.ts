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

function gerarNota(
  status: StatusTransito,
  confianca: number,
  reconciliacao: string,
  tst: ResultadoTribunal | null,
  trt: ResultadoTribunal | null,
): string {
  const linhas: string[] = [];
  const agora = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  linhas.push(`[Verificação automática em ${agora}]`);
  linhas.push(`Fonte: API Pública DataJud (CNJ)`);
  linhas.push(`Resultado: ${status.toUpperCase()} | Confiança: ${confianca}%`);
  linhas.push(`Reconciliação: ${reconciliacao}`);

  const descreverTribunal = (label: string, r: ResultadoTribunal | null) => {
    if (!r) {
      linhas.push(`\n${label}: Sem dados retornados`);
      return;
    }
    linhas.push(`\n${label}: ${r.status} (confiança ${r.confianca}%)`);
    if (r.dataTransito) {
      linhas.push(`  Data trânsito detectada: ${new Date(r.dataTransito).toLocaleDateString("pt-BR")}`);
    }
    if (r.analisePos) {
      const { temRecursoPosterior, temExecucaoAtiva, movimentacoesClassificadas } = r.analisePos;
      if (temRecursoPosterior) linhas.push(`  ⚠ Recurso posterior detectado (processo pode estar ativo)`);
      if (temExecucaoAtiva) linhas.push(`  📌 Fase de execução em andamento`);
      const cats = movimentacoesClassificadas.reduce((acc, c) => {
        acc[c.categoria] = (acc[c.categoria] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      if (Object.keys(cats).length > 0) {
        linhas.push(`  Movimentações pós-trânsito: ${Object.entries(cats).map(([k, v]) => `${k}(${v})`).join(", ")}`);
      }
    }
  };

  descreverTribunal("TST", tst);
  descreverTribunal("TRT", trt);

  if (status === "transitado" || status === "transitado_execucao") {
    if (confianca >= 90) {
      linhas.push("\nMétodo: Código CNJ 848 (trânsito em julgado direto). Alta confiabilidade.");
    } else if (confianca >= 70) {
      linhas.push("\nMétodo: Códigos CNJ 22/246 com confirmação textual. Recomenda-se confirmação manual.");
    } else {
      linhas.push("\nMétodo: Análise textual das movimentações. Confirmação manual fortemente recomendada.");
    }
  } else if (status === "inconclusivo") {
    linhas.push("\nNão foi possível determinar o trânsito com os dados disponíveis. Verifique diretamente no PJE.");
  } else {
    linhas.push("\nProcesso aparenta estar ativo com base nas movimentações recentes.");
  }

  return linhas.join("\n");
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
    fonteDados: "API Pública DataJud/CNJ",
    nota: gerarNota(status, confianca, reconciliacao, analiseTST, analiseTRT),
    detalhes: {
      tst: analiseTST ?? undefined,
      trt: analiseTRT ?? undefined,
      reconciliacao,
    },
  };

  return jsonResponse(resposta, 200);
});
