import { supabase } from "@/integrations/supabase/client";

/**
 * Gera uma URL assinada com validade de 1 hora para acesso seguro a documentos.
 * Substitui o uso de getPublicUrl() que gera URLs públicas permanentes.
 */
export async function getSignedDocumentUrl(
  bucket: "documentos_processos" | "repositorio_documentos" | "cofre_certificados",
  filePath: string,
  expiresInSeconds = 3600
): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, expiresInSeconds);

    if (error) {
      console.error(`Erro ao gerar URL assinada para ${bucket}/${filePath}:`, error);
      return null;
    }
    return data?.signedUrl ?? null;
  } catch (err) {
    console.error("getSignedDocumentUrl error:", err);
    return null;
  }
}

/**
 * Gera URL assinada e retorna como string vazia em caso de erro (backward-compatible).
 */
export async function getSignedUrlOrEmpty(
  bucket: "documentos_processos" | "repositorio_documentos" | "cofre_certificados",
  filePath: string
): Promise<string> {
  return (await getSignedDocumentUrl(bucket, filePath)) ?? "";
}

/**
 * Baixa um documento do bucket documentos_processos sempre gerando um link novo
 * (os links gravados no banco expiram). Retorna false se não conseguiu.
 */
export async function baixarDocumentoArmazenado(urlGravada: string, nome: string): Promise<boolean> {
  let url = urlGravada || "";
  const m = url.match(/\/object\/(?:sign|public)\/documentos_processos\/([^?]+)/);
  if (m) {
    const novo = await getSignedDocumentUrl("documentos_processos", decodeURIComponent(m[1]));
    if (!novo) return false;
    url = novo;
  }
  if (!url) return false;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return false;
    const blob = await resp.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = nome || "documento";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
    return true;
  } catch {
    return false;
  }
}
