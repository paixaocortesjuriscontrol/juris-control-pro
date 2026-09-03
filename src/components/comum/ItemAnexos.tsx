import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Trash2, Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrlOrEmpty } from "@/utils/signedUrl";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { registrarFlushAnexos } from "@/lib/anexosPendentes";

export type ItemAnexosTipo = "tarefa" | "evento" | "audiencia";

const COLUNA: Record<ItemAnexosTipo, "tarefa_id" | "evento_id" | "audiencia_id"> = {
  tarefa: "tarefa_id",
  evento: "evento_id",
  audiencia: "audiencia_id",
};

type Anexo = {
  file?: File;
  id?: string;
  nome?: string;
  url?: string;
  tamanho_bytes?: number;
  uploaded?: boolean;
};

export type ItemAnexosHandle = {
  /** Envia os arquivos pendentes vinculando ao item recém-criado/atualizado. */
  uploadPendentes: (itemId: string, processoId?: string | null) => Promise<void>;
  temPendentes: () => boolean;
};

interface ItemAnexosProps {
  tipo: ItemAnexosTipo;
  itemId?: string | null;
  processoId?: string | null;
  label?: string;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const ItemAnexos = forwardRef<ItemAnexosHandle, ItemAnexosProps>(
  ({ tipo, itemId, processoId, label = "Documentos" }, ref) => {
    const { user } = useAuth();
    const [anexos, setAnexos] = useState<Anexo[]>([]);
    const [uploading, setUploading] = useState(false);
    const coluna = COLUNA[tipo];

    useEffect(() => {
      let cancelado = false;
      (async () => {
        if (!itemId) {
          setAnexos((prev) => prev.filter((a) => !a.uploaded));
          return;
        }
        const { data } = await supabase
          .from("documentos")
          .select("id, nome, url, tamanho_bytes")
          .eq(coluna, itemId)
          .order("created_at", { ascending: false });
        if (cancelado) return;
        const salvos: Anexo[] = (data || []).map((d: any) => ({
          id: d.id,
          nome: d.nome,
          url: d.url,
          tamanho_bytes: d.tamanho_bytes,
          uploaded: true,
        }));
        setAnexos((prev) => [...salvos, ...prev.filter((a) => !a.uploaded)]);
      })();
      return () => {
        cancelado = true;
      };
    }, [itemId, coluna]);

    const handleAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      const novos = Array.from(files).map((file) => ({ file }));
      setAnexos((prev) => [...prev, ...novos]);
      e.target.value = "";
      // Item já existe: vincula imediatamente, sem depender do botão Salvar.
      if (itemId) await enviarArquivos(novos, itemId, processoId);
    };

    const handleRemove = async (index: number) => {
      const anexo = anexos[index];
      if (anexo?.uploaded && anexo.id) {
        const { error } = await supabase.from("documentos").delete().eq("id", anexo.id);
        if (error) {
          toast.error("Erro ao remover documento: " + error.message);
          return;
        }
      }
      setAnexos((prev) => prev.filter((_, i) => i !== index));
    };

    const enviarArquivos = async (
      lista: Anexo[],
      novoItemId: string,
      procId?: string | null,
    ) => {
      const pendentes = lista.filter((a) => !a.uploaded && a.file);
      if (pendentes.length === 0 || !novoItemId) return;
      setUploading(true);
      try {
        const folder = procId || `${tipo}s/${novoItemId}`;
        for (const anexo of pendentes) {
          const file = anexo.file!;
          const sanitized = file.name
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-zA-Z0-9._-]/g, "_");
          const path = `${folder}/${Date.now()}_${sanitized}`;
          const { error: upErr } = await supabase.storage
            .from("documentos_processos")
            .upload(path, file);
          if (upErr) {
            console.error("Erro no upload:", upErr);
            toast.error(`Erro ao enviar ${file.name}: ${upErr.message}`);
            continue;
          }
          const signedUrl = await getSignedUrlOrEmpty("documentos_processos", path);
          const { data: inserido, error: insErr } = await supabase
            .from("documentos")
            .insert({
              nome: file.name,
              tipo: file.type,
              url: signedUrl,
              tamanho_bytes: file.size,
              processo_id: procId || null,
              uploaded_by: user?.id || null,
              [coluna]: novoItemId,
            } as any)
            .select("id, nome, url, tamanho_bytes")
            .maybeSingle();
          if (insErr || !inserido) {
            console.error("Erro ao vincular documento:", insErr);
            toast.error(`Não foi possível vincular ${file.name}: ${insErr?.message ?? "erro desconhecido"}`);
            continue;
          }
          setAnexos((prev) => [
            { ...(inserido as any), uploaded: true },
            ...prev.filter((a) => a.file !== file),
          ]);
        }
      } finally {
        setUploading(false);
      }
    };

    const uploadPendentes = async (novoItemId: string, procId?: string | null) => {
      await enviarArquivos(anexos, novoItemId, procId);
    };

    // Mantém os valores atuais acessíveis ao flush global (registrado uma vez).
    const estadoRef = useRef({ anexos, itemId, processoId });
    estadoRef.current = { anexos, itemId, processoId };

    useEffect(
      () =>
        registrarFlushAnexos(async () => {
          const { anexos: lista, itemId: id, processoId: pid } = estadoRef.current;
          if (!id || !lista.some((a) => !a.uploaded)) return;
          await enviarArquivos(lista, id, pid);
        }),
      [],
    );

    useImperativeHandle(ref, () => ({
      uploadPendentes,
      temPendentes: () => anexos.some((a) => !a.uploaded),
    }));

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">{label}</label>
          <div className="relative">
            <input
              type="file"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleAdd}
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.txt"
            />
            <Button type="button" variant="outline" size="sm" className="pointer-events-none">
              {uploading ? (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              ) : (
                <Upload className="w-3 h-3 mr-1" />
              )}
              Adicionar
            </Button>
          </div>
        </div>

        {anexos.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded-lg">
            Nenhum documento anexado. Clique em "Adicionar" para incluir arquivos.
          </p>
        ) : (
          <div className="space-y-2">
            {anexos.map((anexo, index) => (
              <div key={anexo.id || index} className="p-3 bg-muted/50 rounded-lg text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <FileText className="w-4 h-4 text-primary shrink-0" />
                    <span className="truncate font-medium">{anexo.file?.name || anexo.nome}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      ({formatFileSize(anexo.file?.size ?? anexo.tamanho_bytes ?? 0)})
                    </span>
                    {anexo.uploaded && anexo.url && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        title="Baixar documento"
                        onClick={() => window.open(anexo.url!, "_blank", "noopener")}
                      >
                        <Download className="w-3 h-3" />
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleRemove(index)}
                    >
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {!itemId && anexos.some((a) => !a.uploaded) && (
          <p className="text-xs text-muted-foreground">
            Os arquivos serão enviados ao salvar.
          </p>
        )}
      </div>
    );
  }
);

ItemAnexos.displayName = "ItemAnexos";

export default ItemAnexos;
