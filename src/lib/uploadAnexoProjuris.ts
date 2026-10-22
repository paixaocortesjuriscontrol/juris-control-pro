import { supabase } from "@/integrations/supabase/client";

/** Standard Storage upload with actual byte progress and a stalled-transfer timeout. */
export async function uploadAnexoProjuris(path: string, blob: Blob, onProgress: (sent: number, total: number) => void, upsert = false) {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) throw new Error("Sessão encerrada. Entre novamente antes de continuar o envio.");
  const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/documentos_processos/${path.split("/").map(encodeURIComponent).join("/")}`;
  await new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    let timer: ReturnType<typeof setTimeout>;
    const arm = () => { clearTimeout(timer); timer = setTimeout(() => { request.abort(); reject(new Error("Envio sem resposta por 2 minutos. Analise novamente para continuar sem repetir arquivos.")); }, 120000); };
    request.open("POST", url);
    request.setRequestHeader("Authorization", `Bearer ${data.session?.access_token}`);
    request.setRequestHeader("apikey", import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
    request.setRequestHeader("x-upsert", String(upsert));
    request.setRequestHeader("Content-Type", blob.type || "application/octet-stream");
    request.upload.onprogress = (event) => { arm(); onProgress(event.loaded, event.lengthComputable ? event.total : blob.size); };
    request.onload = () => {
      clearTimeout(timer);
      if (request.status >= 200 && request.status < 300) { onProgress(blob.size, blob.size); resolve(); }
      else {
        let message = `Falha no envio do arquivo (${request.status})`;
        try { const response = JSON.parse(request.responseText); message = response.message || response.error || message; } catch { /* keep HTTP status */ }
        reject(new Error(message));
      }
    };
    request.onerror = () => { clearTimeout(timer); reject(new Error("Conexão interrompida durante o envio do arquivo.")); };
    request.onabort = () => { clearTimeout(timer); reject(new Error("Envio interrompido.")); };
    arm(); request.send(blob);
  });
}