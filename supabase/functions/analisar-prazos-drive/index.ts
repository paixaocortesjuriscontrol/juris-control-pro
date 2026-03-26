import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decompressDeflate(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("raw");
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();
  writer.write(data);
  writer.close();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(totalLen);
  let off = 0;
  for (const chunk of chunks) {
    result.set(chunk, off);
    off += chunk.length;
  }
  return result;
}

async function extractDocxText(bytes: Uint8Array): Promise<string> {
  let offset = 0;
  while (offset < bytes.length - 4) {
    if (bytes[offset] === 0x50 && bytes[offset+1] === 0x4B && bytes[offset+2] === 0x03 && bytes[offset+3] === 0x04) {
      const compressionMethod = bytes[offset + 8] | (bytes[offset + 9] << 8);
      const compressedSize = bytes[offset + 18] | (bytes[offset + 19] << 8) | (bytes[offset + 20] << 16) | (bytes[offset + 21] << 24);
      const nameLen = bytes[offset + 26] | (bytes[offset + 27] << 8);
      const extraLen = bytes[offset + 28] | (bytes[offset + 29] << 8);
      const name = new TextDecoder().decode(bytes.slice(offset + 30, offset + 30 + nameLen));
      const dataStart = offset + 30 + nameLen + extraLen;
      const fileData = bytes.slice(dataStart, dataStart + compressedSize);

      if (name === "word/document.xml") {
        let xmlBytes: Uint8Array;
        if (compressionMethod === 0) {
          xmlBytes = fileData;
        } else {
          xmlBytes = await decompressDeflate(fileData);
        }
        const xmlText = new TextDecoder().decode(xmlBytes);
        const finalParts: string[] = [];
        const pRegex = /<w:p[^>]*>([\s\S]*?)<\/w:p>/g;
        let pMatch;
        while ((pMatch = pRegex.exec(xmlText)) !== null) {
          const pContent = pMatch[1];
          const tParts: string[] = [];
          const tRegex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
          let tMatch;
          while ((tMatch = tRegex.exec(pContent)) !== null) {
            tParts.push(tMatch[1]);
          }
          if (tParts.length > 0) {
            finalParts.push(tParts.join(""));
          }
        }
        return finalParts.join("\n");
      }
      offset = dataStart + compressedSize;
    } else {
      offset++;
    }
  }
  throw new Error("document.xml não encontrado no arquivo .docx");
}

async function analyzeWithAI(text: string, fileName: string): Promise<any> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

  const systemPrompt = `Você é um analista jurídico especializado em processos trabalhistas do TST.
Analise o documento fornecido e extraia EXATAMENTE as seguintes informações:
1. NÚMERO DO PROCESSO (formato CNJ: NNNNNNN-NN.NNNN.N.NN.NNNN)
2. DOSSIÊ (código do dossiê/pasta do escritório)
3. EQUIPE (nome da equipe/núcleo responsável)
4. RECLAMANTE (nome do reclamante/autor)
5. RECLAMADA (nome da reclamada/empresa ré)
6. RELATOR (nome do ministro relator)
7. TURMA (turma do TST responsável)

Se alguma informação não for encontrada, retorne "(Não localizado)".
Retorne APENAS no formato JSON.`;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Documento: ${fileName}\n\nConteúdo:\n${text.substring(0, 15000)}` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "extrair_dados_processo",
          description: "Extrai dados estruturados de um documento de processo TST",
          parameters: {
            type: "object",
            properties: {
              numero_processo: { type: "string", description: "Número do processo no formato CNJ" },
              dossie: { type: "string", description: "Código do dossiê" },
              equipe: { type: "string", description: "Nome da equipe/núcleo" },
              reclamante: { type: "string", description: "Nome do reclamante" },
              reclamada: { type: "string", description: "Nome da reclamada" },
              relator: { type: "string", description: "Nome do ministro relator" },
              turma: { type: "string", description: "Turma do TST" },
            },
            required: ["numero_processo", "dossie", "equipe", "reclamante", "reclamada", "relator", "turma"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "extrair_dados_processo" } },
    }),
  });

  if (!resp.ok) {
    if (resp.status === 429) throw new Error("Rate limit - aguarde e tente novamente");
    if (resp.status === 402) throw new Error("Créditos insuficientes");
    throw new Error(`Erro IA: ${resp.status}`);
  }

  const data = await resp.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    return JSON.parse(toolCall.function.arguments);
  }
  throw new Error("IA não retornou dados estruturados");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, fileName, fileBase64 } = await req.json();

    if (action === "analyze-upload") {
      if (!fileBase64) {
        return new Response(JSON.stringify({ error: "fileBase64 obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const bytes = base64ToUint8Array(fileBase64);
      const text = await extractDocxText(bytes);

      if (!text || text.trim().length < 10) {
        return new Response(JSON.stringify({
          error: "Não foi possível extrair texto do documento",
          result: {
            numero_processo: "(Não localizado)",
            dossie: "(Não localizado)",
            equipe: "(Não localizado)",
            reclamante: "(Não localizado)",
            reclamada: "(Não localizado)",
            relator: "(Não localizado)",
            turma: "(Não localizado)",
          }
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = await analyzeWithAI(text, fileName || "documento.docx");
      return new Response(JSON.stringify({ result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
