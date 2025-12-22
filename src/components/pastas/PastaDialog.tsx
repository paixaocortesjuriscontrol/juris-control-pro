import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useCreatePasta, useUpdatePasta, Pasta } from "@/hooks/usePastas";
import { useCoordenacoesFull } from "@/hooks/useCoordenacoes";
import { useAuth } from "@/contexts/AuthContext";

interface PastaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pasta?: Pasta | null;
}

export function PastaDialog({ open, onOpenChange, pasta }: PastaDialogProps) {
  const { user } = useAuth();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [coordenacaoId, setCoordenacaoId] = useState<string>("");

  const { data: coordenacoes } = useCoordenacoesFull();
  const createPasta = useCreatePasta();
  const updatePasta = useUpdatePasta();

  const isEditing = !!pasta;
  const isLoading = createPasta.isPending || updatePasta.isPending;

  useEffect(() => {
    if (pasta) {
      setNome(pasta.nome);
      setDescricao(pasta.descricao || "");
      setCoordenacaoId(pasta.coordenacao_id || "");
    } else {
      setNome("");
      setDescricao("");
      setCoordenacaoId("");
    }
  }, [pasta, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nome.trim()) return;

    try {
      if (isEditing && pasta) {
        await updatePasta.mutateAsync({
          id: pasta.id,
          nome,
          descricao: descricao || undefined,
          coordenacao_id: coordenacaoId || null,
        });
      } else {
        await createPasta.mutateAsync({
          nome,
          descricao: descricao || undefined,
          coordenacao_id: coordenacaoId || undefined,
          criado_por: user?.id || "",
        });
      }
      onOpenChange(false);
    } catch (error) {
      // Error handled in hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Pasta" : "Nova Pasta"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome da Pasta *</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Caso Suzane Ritcoff"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descrição opcional da pasta"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Coordenação</Label>
            <Select value={coordenacaoId || "__none__"} onValueChange={(val) => setCoordenacaoId(val === "__none__" ? "" : val)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma coordenação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nenhuma</SelectItem>
                {coordenacoes?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !nome.trim()}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditing ? "Salvar" : "Criar Pasta"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
