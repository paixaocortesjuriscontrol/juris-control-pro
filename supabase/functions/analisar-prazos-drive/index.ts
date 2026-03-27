import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleAuth } from "npm:google-auth-library";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// --- Service Account Auth via google-auth-library ---

let cachedToken: { token: string; expires: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires) {
    return cachedToken.token;
  }

  const raw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY não configurada");

  let credentials: Record<string, unknown>;
  try {
    credentials = JSON.parse(raw);
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY não é um JSON válido. Reconfigure o secret com o conteúdo completo do arquivo JSON da conta de serviço.");
  }

  const auth = new GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });

  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token = tokenResponse.token;
  if (!token) throw new Error("Falha ao obter access token do Google");

  cachedToken = { token, expires: Date.now() + 50 * 60 * 1000 };
  return token;
}

// --- Drive helpers ---

function extractFolderId(url: string): string | null {
  const match1 = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (match1) return match1[1];
  const match2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match2) return match2[1];
  return null;
}

type DriveFileEntry = { id: string; name: string; mimeType: string; size?: string };
type DriveListMode = "folder" | "shared-drive-root";

const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const FOLDER_MIME_TYPE = "application/vnd.google-apps.folder";

async function fetchDriveEntriesPage(
  folderId: string,
  accessToken: string,
  mode: DriveListMode,
  pageToken = "",
): Promise<{ files: DriveFileEntry[]; nextPageToken: string }> {
  const params = new URLSearchParams({
    fields: "nextPageToken,files(id,name,mimeType,size)",
    pageSize: "100",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });

  if (mode === "shared-drive-root") {
    params.set("corpora", "drive");
    params.set("driveId", folderId);
    params.set("q", "'root' in parents and trashed=false");
  } else {
    params.set("q", `'${folderId}' in parents and trashed=false`);
  }

  if (pageToken) params.set("pageToken", pageToken);

  const resp = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) {
    const err = await resp.text();
    console.error("Drive API error:", resp.status, err);
    throw new Error(`Erro ao acessar Google Drive API: ${resp.status}`);
  }

  const data = await resp.json();
  return {
    files: Array.isArray(data.files) ? data.files : [],
    nextPageToken: data.nextPageToken || "",
  };
}

async function listAllDriveEntries(folderId: string, accessToken: string, mode: DriveListMode): Promise<DriveFileEntry[]> {
  const entries: DriveFileEntry[] = [];
  let pageToken = "";
  do {
    const page = await fetchDriveEntriesPage(folderId, accessToken, mode, pageToken);
    entries.push(...page.files);
    pageToken = page.nextPageToken;
  } while (pageToken);
  return entries;
}

async function collectDocxFiles(folderId: string, accessToken: string, mode: DriveListMode): Promise<DriveFileEntry[]> {
  const pending: Array<{ id: string; mode: DriveListMode }> = [{ id: folderId, mode }];
  const visited = new Set<string>();
  const files: DriveFileEntry[] = [];

  while (pending.length > 0) {
    const current = pending.shift();
    if (!current) break;
    const visitKey = `${current.mode}:${current.id}`;
    if (visited.has(visitKey)) continue;
    visited.add(visitKey);

    const entries = await listAllDriveEntries(current.id, accessToken, current.mode);
    for (const entry of entries) {
      if (entry.mimeType === DOCX_MIME_TYPE) files.push(entry);
      if (entry.mimeType === FOLDER_MIME_TYPE) pending.push({ id: entry.id, mode: "folder" });
    }
  }
  return files;
}

async function listDriveFiles(folderId: string, accessToken: string): Promise<DriveFileEntry[]> {
  if (folderId.startsWith("0A")) {
    try {
      const sharedDriveFiles = await collectDocxFiles(folderId, accessToken, "shared-drive-root");
      if (sharedDriveFiles.length > 0) {
        console.log(`Found ${sharedDriveFiles.length} .docx files via Drive API (shared-drive-root)`);
        return sharedDriveFiles;
      }
    } catch (error) {
      console.warn("Shared drive root lookup failed, falling back:", error instanceof Error ? error.message : String(error));
    }
  }
  const folderFiles = await collectDocxFiles(folderId, accessToken, "folder");
  console.log(`Found ${folderFiles.length} .docx files via Drive API (folder-recursive)`);
  return folderFiles;
}

async function downloadDriveFile(fileId: string, accessToken: string): Promise<ArrayBuffer> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!resp.ok) {
    const err = await resp.text();
    console.error("Download error:", resp.status, err);
    throw new Error(`Erro ao baixar arquivo ${fileId}: ${resp.status}`);
  }
  return resp.arrayBuffer();
}

// --- DOCX extraction ---

async function decompressDeflate(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("deflate-raw");
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
  for (const chunk of chunks) { result.set(chunk, off); off += chunk.length; }
  return result;
}

async function extractDocxText(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer);
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
        if (compressionMethod === 0) { xmlBytes = fileData; } else { xmlBytes = await decompressDeflate(fileData); }
        const xmlText = new TextDecoder().decode(xmlBytes);
        const finalParts: string[] = [];
        const pRegex = /<w:p[^>]*>([\s\S]*?)<\/w:p>/g;
        let pMatch;
        while ((pMatch = pRegex.exec(xmlText)) !== null) {
          const tParts: string[] = [];
          const tRegex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g;
          let tMatch;
          while ((tMatch = tRegex.exec(pMatch[1])) !== null) { tParts.push(tMatch[1]); }
          if (tParts.length > 0) finalParts.push(tParts.join(""));
        }
        return finalParts.join("\n");
      }
      offset = dataStart + compressedSize;
    } else { offset++; }
  }
  throw new Error("document.xml não encontrado no arquivo .docx");
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) { bytes[i] = binaryString.charCodeAt(i); }
  return bytes;
}

// --- AI analysis ---

async function analyzeWithAI(text: string, fileName: string): Promise<any[]> {
  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada");

  const systemPrompt = `Você é um analista jurídico especializado em processos trabalhistas do TST.
Analise o documento fornecido e extraia TODOS os processos encontrados. Um único documento pode conter MÚLTIPLOS processos.
Para CADA processo encontrado, extraia:
1. DATA DA DISPONIBILIZAÇÃO (data de disponibilização da publicação no diário, formato DD/MM/AAAA)
2. NÚMERO DO PROCESSO (formato CNJ: NNNNNNN-NN.NNNN.N.NN.NNNN)
3. DOSSIÊ (código do dossiê/pasta do escritório)
4. EQUIPE (nome da equipe/núcleo responsável)
5. RECLAMANTE (nome do reclamante/autor)
6. RECLAMADA (nome da reclamada/empresa ré)
7. RELATOR (nome do ministro relator)
8. TURMA (turma do TST responsável)

IMPORTANTE: Retorne TODOS os processos distintos encontrados no documento. Se houver apenas um, retorne um array com um elemento.
Se alguma informação não for encontrada, retorne "(Não localizado)".`;

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Documento: ${fileName}\n\nConteúdo:\n${text.substring(0, 15000)}` },
      ],
      tools: [{
        type: "function",
        function: {
          name: "extrair_dados_processos",
          description: "Extrai dados estruturados de TODOS os processos encontrados em um documento TST",
          parameters: {
            type: "object",
            properties: {
              processos: {
                type: "array",
                description: "Lista de todos os processos encontrados no documento",
                items: {
                  type: "object",
                  properties: {
                    data_distribuicao: { type: "string", description: "Data da disponibilização da publicação no formato DD/MM/AAAA" },
                    numero_processo: { type: "string", description: "Número do processo no formato CNJ" },
                    dossie: { type: "string", description: "Código do dossiê" },
                    equipe: { type: "string", description: "Nome da equipe/núcleo" },
                    reclamante: { type: "string", description: "Nome do reclamante" },
                    reclamada: { type: "string", description: "Nome da reclamada" },
                    relator: { type: "string", description: "Nome do ministro relator" },
                    turma: { type: "string", description: "Turma do TST" },
                  },
                  required: ["data_distribuicao", "numero_processo", "dossie", "equipe", "reclamante", "reclamada", "relator", "turma"],
                },
              },
            },
            required: ["processos"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "extrair_dados_processos" } },
    }),
  });

  if (!resp.ok) {
    if (resp.status === 429) throw new Error("Rate limit OpenAI - aguarde e tente novamente");
    if (resp.status === 402 || resp.status === 401) throw new Error("Chave OpenAI inválida ou sem créditos");
    throw new Error(`Erro OpenAI: ${resp.status}`);
  }

  const data = await resp.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    const parsed = JSON.parse(toolCall.function.arguments);
    if (Array.isArray(parsed.processos) && parsed.processos.length > 0) {
      return parsed.processos;
    }
    // Fallback: if AI returned flat object instead of array
    if (parsed.numero_processo) return [parsed];
  }
  throw new Error("IA não retornou dados estruturados");
}

// --- Main handler ---

const NOT_FOUND_RESULT = {
  data_distribuicao: "(Não localizado)", numero_processo: "(Não localizado)", dossie: "(Não localizado)", equipe: "(Não localizado)",
  reclamante: "(Não localizado)", reclamada: "(Não localizado)", relator: "(Não localizado)", turma: "(Não localizado)",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, driveUrl, fileId, fileName, fileBase64 } = await req.json();

    if (action === "list") {
      const accessToken = await getAccessToken();
      const folderId = extractFolderId(driveUrl);
      if (!folderId) {
        return new Response(JSON.stringify({ error: "URL do Google Drive inválida" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const files = await listDriveFiles(folderId, accessToken);
      return new Response(JSON.stringify({ files }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "analyze") {
      const accessToken = await getAccessToken();
      if (!fileId) throw new Error("fileId obrigatório");
      const buffer = await downloadDriveFile(fileId, accessToken);
      const text = await extractDocxText(buffer);
      if (!text || text.trim().length < 10) {
        return new Response(JSON.stringify({ error: "Não foi possível extrair texto do documento", result: NOT_FOUND_RESULT }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const result = await analyzeWithAI(text, fileName || fileId);
      return new Response(JSON.stringify({ result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "analyze-upload") {
      if (!fileBase64) throw new Error("fileBase64 obrigatório");
      const bytes = base64ToUint8Array(fileBase64);
      const text = await extractDocxText(bytes.buffer);
      if (!text || text.trim().length < 10) {
        return new Response(JSON.stringify({ error: "Não foi possível extrair texto do documento", result: NOT_FOUND_RESULT }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const result = await analyzeWithAI(text, fileName || "documento.docx");
      return new Response(JSON.stringify({ result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
