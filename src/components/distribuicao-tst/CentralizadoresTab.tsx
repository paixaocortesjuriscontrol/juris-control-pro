import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  dadoId?: string | null;
  processoNumero?: string;
}

type Campos = {
  centralizador: string;
  comarca: string;
  juizo: string;
  uf: string;
  objeto_padrao: string;
  assunto: string;
  categoria: string;
  subcategoria: string;
};

const VAZIO: Campos = {
  centralizador: "",
  comarca: "",
  juizo: "",
  uf: "",
  objeto_padrao: "",
  assunto: "",
  categoria: "",
  subcategoria: "",
};

export function CentralizadoresTab({ dadoId, processoNumero }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [campos, setCampos] = useState<Campos>(VAZIO);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!dadoId) {
        setCampos(VAZIO);
        return;
      }
      setLoading(true);
      const { data, error } = await supabase
        .from("dados_benner" as any)
        .select(
          "centralizador, comarca, juizo, uf, objeto_padrao, assunto, categoria, subcategoria",
        )
        .eq("id", dadoId)
        .maybeSingle();
      if (!cancelled) {
        if (error) {
          toast.error("Erro ao carregar centralizadores: " + error.message);
        } else if (data) {
          const d = data as any;
          setCampos({
            centralizador: d.centralizador || "",
            comarca: d.comarca || "",
            juizo: d.juizo || "",
            uf: d.uf || "",
            objeto_padrao: d.objeto_padrao || "",
            assunto: d.assunto || "",
            categoria: d.categoria || "",
            subcategoria: d.subcategoria || "",
          });
        }
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dadoId]);

  const set = (k: keyof Campos) => (v: string) =>
    setCampos((prev) => ({ ...prev, [k]: v }));

  const handleSalvar = async () => {
    if (!dadoId) {
      toast.warning("Salve a Distribuição antes de preencher os centralizadores.");
      return;
    }
    setSaving(true);
    const payload = {
      centralizador: campos.centralizador.trim() || null,
      comarca: campos.comarca.trim() || null,
      juizo: campos.juizo.trim() || null,
      uf: campos.uf.trim().toUpperCase() || null,
      objeto_padrao: campos.objeto_padrao.trim() || null,
      assunto: campos.assunto.trim() || null,
      categoria: campos.categoria.trim() || null,
      subcategoria: campos.subcategoria.trim() || null,
    };
    const { error } = await supabase
      .from("dados_benner" as any)
      .update(payload as any)
      .eq("id", dadoId);
    setSaving(false);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    toast.success("Centralizadores salvos!");
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!dadoId) {
    return (
      <div className="text-sm text-muted-foreground py-8 text-center">
        Salve a Distribuição antes de preencher os centralizadores.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {processoNumero && (
        <div className="text-xs text-muted-foreground">
          Processo: <span className="font-mono">{processoNumero}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Centralizador</Label>
          <Input value={campos.centralizador} onChange={(e) => set("centralizador")(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Comarca</Label>
          <Input value={campos.comarca} onChange={(e) => set("comarca")(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Juízo</Label>
          <Input value={campos.juizo} onChange={(e) => set("juizo")(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>UF</Label>
          <Input
            maxLength={2}
            value={campos.uf}
            onChange={(e) => set("uf")(e.target.value.toUpperCase())}
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label>Objeto padrão</Label>
          <Textarea
            rows={2}
            value={campos.objeto_padrao}
            onChange={(e) => set("objeto_padrao")(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Assunto</Label>
          <Input value={campos.assunto} onChange={(e) => set("assunto")(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Categoria</Label>
          <Input value={campos.categoria} onChange={(e) => set("categoria")(e.target.value)} />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label>Subcategoria</Label>
          <Input value={campos.subcategoria} onChange={(e) => set("subcategoria")(e.target.value)} />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSalvar} disabled={saving}>
          {saving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          Salvar centralizadores
        </Button>
      </div>
    </div>
  );
}
