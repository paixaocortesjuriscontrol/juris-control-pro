import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function extractFolderId(url: string): string | null {
  const match1 = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (match1) return match1[1];
  const match2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match2) return match2[1];
  return null;
}

async function listDriveFiles(folderId: string): Promise<any[]> {
  // Scrape public Drive folder page to get file list
  const folderUrl = `https://drive.google.com/drive/folders/${folderId}`;
  
  const resp = await fetch(folderUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    },
  });

  if (!resp.ok) {
    throw new Error(`Erro ao acessar pasta do Drive: ${resp.status}`);
  }

  const html = await resp.text();
  console.log("HTML length:", html.length);

  const files: any[] = [];

  // Pattern 1: data-id attributes with file names in the HTML
  // Google Drive embeds file data in various formats in the HTML
  // Look for patterns like: [["FILE_ID","FILE_NAME",... 
  // or data structures containing file info

  // Try to find file entries in the page source
  // Google Drive uses various JS data formats. Let's try multiple patterns:

  // Pattern: ["FILE_ID","FILE_NAME","MIME_TYPE"...] or similar structures
  const fileIdPattern = /\["([\w-]{25,})","([^"]+\.docx?)"/gi;
  let match;
  const seenIds = new Set<string>();
  
  while ((match = fileIdPattern.exec(html)) !== null) {
    const id = match[1];
    const name = match[2];
    if (!seenIds.has(id) && name.toLowerCase().endsWith('.docx')) {
      seenIds.add(id);
      files.push({
        id,
        name,
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
    }
  }

  // Pattern 2: Look for aria-label with .docx and nearby data-id
  if (files.length === 0) {
    const ariaPattern = /data-id="([\w-]+)"[^>]*aria-label="([^"]*\.docx)"/gi;
    while ((match = ariaPattern.exec(html)) !== null) {
      const id = match[1];
      const name = match[2];
      if (!seenIds.has(id)) {
        seenIds.add(id);
        files.push({ id, name, mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
      }
    }
  }

  // Pattern 3: Another common pattern in Drive HTML
  if (files.length === 0) {
    // Look for patterns like: "FILE_ID" ... ".docx"
    const altPattern = /\\x22([\w-]{20,})\\x22[^\\]*\\x22([^\\]*\.docx)\\x22/gi;
    while ((match = altPattern.exec(html)) !== null) {
      const id = match[1];
      const name = match[2];
      if (!seenIds.has(id)) {
        seenIds.add(id);
        files.push({ id, name, mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
      }
    }
  }

  // Pattern 4: Try encoded JSON arrays that Drive often uses
  if (files.length === 0) {
    // Match any string that looks like a file ID followed by a .docx filename
    const broadPattern = /([\w-]{20,})[^a-zA-Z0-9]{1,50}([A-Za-z0-9_\-\s().]+\.docx)/gi;
    while ((match = broadPattern.exec(html)) !== null) {
      const id = match[1];
      const name = match[2].trim();
      if (!seenIds.has(id) && id !== folderId) {
        seenIds.add(id);
        files.push({ id, name, mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
      }
    }
  }

  console.log(`Found ${files.length} .docx files in folder`);
  
  if (files.length === 0) {
    // Log a snippet of HTML for debugging
    console.log("HTML snippet (first 3000 chars):", html.substring(0, 3000));
    console.log("HTML snippet (searching for docx):", html.includes('.docx') ? "Contains .docx" : "No .docx found");
    console.log("HTML snippet (searching for DOCX):", html.includes('.DOCX') ? "Contains .DOCX" : "No .DOCX found");
  }

  return files;
}

async function downloadDriveFile(fileId: string): Promise<ArrayBuffer> {
  // Use the direct export/download URL for public files
  const url = `https://drive.google.com/uc?export=download&id=${fileId}`;
  
  const resp = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    redirect: "follow",
  });
  
  if (!resp.ok) {
    throw new Error(`Erro ao baixar arquivo ${fileId}: ${resp.status}`);
  }
  
  // Check if we got a virus scan warning page (for larger files)
  const contentType = resp.headers.get("content-type") || "";
  if (contentType.includes("text/html")) {
    const html = await resp.text();
    // Extract the confirm download link
    const confirmMatch = html.match(/action="([^"]+)"/);
    if (confirmMatch) {
      let confirmUrl = confirmMatch[1].replace(/&amp;/g, "&");
      if (!confirmUrl.startsWith("http")) {
        confirmUrl = "https://drive.google.com" + confirmUrl;
      }
      const confirmResp = await fetch(confirmUrl, {
        method: "POST",
        headers: { "User-Agent": "Mozilla/5.0" },
        redirect: "follow",
      });
      if (!confirmResp.ok) throw new Error(`Erro ao confirmar download: ${confirmResp.status}`);
      return confirmResp.arrayBuffer();
    }
    throw new Error("Não foi possível baixar o arquivo. Verifique se a pasta é pública.");
  }
  
  return resp.arrayBuffer();
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

async function extractDocxTextAsync(buffer: ArrayBuffer): Promise<string> {
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
  
  throw new Error("document.xml não encontrado");
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
    const { action, driveUrl, fileId, fileName } = await req.json();

    if (action === "list") {
      const folderId = extractFolderId(driveUrl);
      if (!folderId) {
        return new Response(JSON.stringify({ error: "URL do Google Drive inválida" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const files = await listDriveFiles(folderId);
      return new Response(JSON.stringify({ files }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "analyze") {
      if (!fileId) {
        return new Response(JSON.stringify({ error: "fileId obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const buffer = await downloadDriveFile(fileId);
      const text = await extractDocxTextAsync(buffer);
      
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

      const result = await analyzeWithAI(text, fileName || fileId);
      
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
