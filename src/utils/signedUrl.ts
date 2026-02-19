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
