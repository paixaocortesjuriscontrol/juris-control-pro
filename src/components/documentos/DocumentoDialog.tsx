import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useCreateDocumento, useUpdateDocumento, type Documento } from "@/hooks/useDocumentos";
import { useProcessos } from "@/hooks/useProcessos";
import { useAuth } from "@/contexts/AuthContext";

type DocumentoDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documento?: Documento | null;
  defaultProcessoId?: string;
};

const tiposDocumento = [
  { value: "peticao", label: "Petição" },
  { value: "contrato", label: "Contrato" },
  { value: "procuracao", label: "Procuração" },
  { value: "sentenca", label: "Sentença" },
  { value: "acordao", label: "Acórdão" },
  { value: "recurso", label: "Recurso" },
  { value: "notificacao", label: "Notificação" },
  { value: "certidao", label: "Certidão" },
  { value: "comprovante", label: "Comprovante" },
  { value: "outros", label: "Outros" },
];

export function DocumentoDialog({
  open,
  onOpenChange,
  documento,
  defaultProcessoId,
}: DocumentoDialogProps) {
  const { user } = useAuth();
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("");
  const [processoId, setProcessoId] = useState("");
  const [url, setUrl] = useState("");

  const createDocumento = useCreateDocumento();
  const updateDocumento = useUpdateDocumento();
  const { data: processos } = useProcessos();

  useEffect(() => {
    if (documento) {
      setNome(documento.nome);
      setTipo(documento.tipo || "");
      setProcessoId(documento.processo_id || "");
      setUrl(documento.url || "");
    } else {
      setNome("");
      setTipo("");
      setProcessoId(defaultProcessoId || "");
      setUrl("");
    }
  }, [documento, open, defaultProcessoId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nome) {
      return;
    }

    if (documento) {
      await updateDocumento.mutateAsync({
        id: documento.id,
        nome,
        tipo: tipo || undefined,
        processo_id: processoId || undefined,
      });
    } else {
      await createDocumento.mutateAsync({
        nome,
        tipo: tipo || undefined,
        url: url || undefined,
        processo_id: processoId || undefined,
        uploaded_by: user?.id || "",
      });
    }

    onOpenChange(false);
  };

  const isLoading = createDocumento.isPending || updateDocumento.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {documento ? "Editar Documento" : "Novo Documento"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome do Documento *</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Petição Inicial, Contrato de Prestação..."
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo de Documento</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                {tiposDocumento.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="processo">Processo Vinculado</Label>
            <Select value={processoId} onValueChange={setProcessoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o processo (opcional)" />
              </SelectTrigger>
              <SelectContent>
                {processos?.map((processo) => (
                  <SelectItem key={processo.id} value={processo.id}>
                    {processo.numero} - {processo.assunto || "Sem assunto"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!documento && (
            <div className="space-y-2">
              <Label htmlFor="url">URL do Documento</Label>
              <Input
                id="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                type="url"
              />
              <p className="text-xs text-muted-foreground">
                Link externo para o documento (Google Drive, OneDrive, etc.)
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {documento ? "Salvar" : "Cadastrar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
