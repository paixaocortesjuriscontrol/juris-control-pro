import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Search, Trash2, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Parte {
  id: string;
  nome: string;
  documento: string | null;
  tipo_pessoa: string | null;
  polo: string | null;
  is_advogado: boolean;
  origem: string;
}

interface Props {
  dadosBennerId: string;
  processoNumero: string;
}

function formatDocumento(doc: string | null): string {
  if (!doc) return "—";
  const digits = doc.replace(/\D/g, "");
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return doc;
}

function translatePolo(polo: string | null): string {
  if (!polo) return "—";
  const map: Record<string, string> = {
    ACTIVE: "Ativo",
    PASSIVE: "Passivo",
    INTERESTED: "Interessado",
  };
  return map[polo.toUpperCase()] || polo;
}

export function DadosBennerPartesTab({ dadosBennerId, processoNumero }: Props) {
  const [partes, setPartes] = useState<Parte[]>([]);
  const [loading, setLoading] = useState(true);
  const [buscando, setBuscando] = useState(false);
  const [addingManual, setAddingManual] = useState(false);
  const [comAnexos, setComAnexos] = useState(false);
  const [newNome, setNewNome] = useState("");
  const [newDocumento, setNewDocumento] = useState("");
  const [newPolo, setNewPolo] = useState("Active");
  const [newTipo, setNewTipo] = useState("REQUERENTE");

  const fetchPartes = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("partes_processo_benner")
      .select("*")
      .eq("dados_benner_id", dadosBennerId)
      .order("is_advogado", { ascending: true })
      .order("polo")
      .order("nome");

    if (!error && data) {
      setPartes(data as Parte[]);
    }
    setLoading(false);
  }, [dadosBennerId]);

  useEffect(() => {
    fetchPartes();
  }, [fetchPartes]);

  const buscarJudit = async () => {
    if (!processoNumero) {
      toast.error("Número do processo não informado");
      return;
    }
    setBuscando(true);
    try {
      const { data, error } = await supabase.functions.invoke("buscar-judit", {
        body: { numero_processo: processoNumero, tribunal: "TST", com_anexos: comAnexos },
      });

      if (error) {
        // supabase-js encapsula non-2xx como FunctionsHttpError.
        // O corpo real da resposta fica em error.context (Response).
        let bodyErr: any = null;
        try {
          const ctx: any = (error as any).context;
          if (ctx instanceof Response) {
            const t = await ctx.clone().text();
            try { bodyErr = JSON.parse(t); } catch { bodyErr = { error: t }; }
          } else if (ctx && typeof ctx.json === "function") {
            bodyErr = await ctx.json();
          } else if (ctx && typeof ctx.text === "function") {
            const t = await ctx.text();
            try { bodyErr = JSON.parse(t); } catch { bodyErr = { error: t }; }
          } else if (typeof ctx === "string") {
            try { bodyErr = JSON.parse(ctx); } catch { bodyErr = { error: ctx }; }
          } else if (ctx && typeof ctx === "object") {
            bodyErr = ctx;
          }
        } catch { /* ignore parse errors */ }

        const rawMsg = `${bodyErr?.error || ""} ${bodyErr?.judit_error || ""} ${error.message || ""}`;
        const isPlanoEsgotado =
          bodyErr?.judit_error === "USER_REACHED_PLAN_MAX_CONSUMPTION" ||
          /USER_REACHED_PLAN_MAX_CONSUMPTION/i.test(rawMsg) ||
          /limite do plano/i.test(rawMsg);

        if (isPlanoEsgotado) {
          toast.error("Limite do plano Judit atingido. Verifique seu consumo no painel Judit.", {
            duration: 6000,
          });
          return; // finally restabelece setBuscando(false)
        }
        throw new Error(bodyErr?.error || error.message || "Erro desconhecido");
      }
      const partiesDetail = data?.parties_detail;
      if (!Array.isArray(partiesDetail) || partiesDetail.length === 0) {
        toast.warning("Nenhuma parte encontrada na Judit para este processo");
        setBuscando(false);
        return;
      }

      // Remove partes anteriores de origem judit
      await supabase
        .from("partes_processo_benner")
        .delete()
        .eq("dados_benner_id", dadosBennerId)
        .eq("origem", "judit");

      // Insere novas
      const rows = partiesDetail.map((p: any) => ({
        dados_benner_id: dadosBennerId,
        nome: p.nome || "Sem nome",
        documento: p.documento || null,
        tipo_pessoa: p.tipo_pessoa || null,
        polo: p.polo || null,
        is_advogado: p.is_advogado || false,
        origem: "judit",
      }));

      const { error: insertError } = await supabase
        .from("partes_processo_benner")
        .insert(rows);

      if (insertError) throw insertError;

      toast.success(`${rows.length} partes importadas da Judit`);
      // Reseta para evitar consultas caras acidentais nas próximas buscas
      setComAnexos(false);
      await fetchPartes();
    } catch (e: any) {
      toast.error("Erro ao buscar Judit: " + (e.message || e));
    } finally {
      setBuscando(false);
    }
  };

  const addManual = async () => {
    if (!newNome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    const { error } = await supabase.from("partes_processo_benner").insert({
      dados_benner_id: dadosBennerId,
      nome: newNome.trim(),
      documento: newDocumento.trim() || null,
      tipo_pessoa: newTipo,
      polo: newPolo,
      is_advogado: newTipo === "ADVOGADO",
      origem: "manual",
    });
    if (error) {
      toast.error("Erro ao adicionar parte");
      return;
    }
    toast.success("Parte adicionada");
    setNewNome("");
    setNewDocumento("");
    setAddingManual(false);
    fetchPartes();
  };

  const removeParte = async (id: string) => {
    await supabase.from("partes_processo_benner").delete().eq("id", id);
    setPartes((prev) => prev.filter((p) => p.id !== id));
    toast.success("Parte removida");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button onClick={buscarJudit} disabled={buscando || !processoNumero} size="sm">
          {buscando ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Search className="w-4 h-4 mr-1" />}
          Buscar Judit
        </Button>
        <label
          className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none"
          title="Consulta mais cara. Inclui a lista de documentos/anexos do processo."
        >
          <Checkbox
            checked={comAnexos}
            onCheckedChange={(v) => setComAnexos(v === true)}
            disabled={buscando}
          />
          Com anexos
          <span className="text-[10px] text-amber-600 dark:text-amber-400">(consulta cara)</span>
        </label>
        <Button variant="outline" size="sm" onClick={() => setAddingManual(!addingManual)}>
          <Plus className="w-4 h-4 mr-1" /> Adicionar Manual
        </Button>
        <span className="text-sm text-muted-foreground ml-auto">{partes.length} parte(s)</span>
      </div>

      {addingManual && (
        <div className="border rounded-md p-3 space-y-2 bg-muted/30">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Input placeholder="Nome completo" value={newNome} onChange={(e) => setNewNome(e.target.value)} />
            <Input placeholder="CPF/CNPJ" value={newDocumento} onChange={(e) => setNewDocumento(e.target.value)} />
            <Select value={newPolo} onValueChange={setNewPolo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">Ativo</SelectItem>
                <SelectItem value="Passive">Passivo</SelectItem>
                <SelectItem value="Interested">Interessado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={newTipo} onValueChange={setNewTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="REQUERENTE">Requerente</SelectItem>
                <SelectItem value="REQUERIDO">Requerido</SelectItem>
                <SelectItem value="ADVOGADO">Advogado</SelectItem>
                <SelectItem value="TERCEIRO">Terceiro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={addManual}>Salvar</Button>
            <Button size="sm" variant="ghost" onClick={() => setAddingManual(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {partes.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          Nenhuma parte cadastrada. Clique em "Buscar Judit" para importar.
        </p>
      ) : (
        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Polo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>CPF/CNPJ</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partes.map((p) => (
                <TableRow
                  key={p.id}
                  className={cn(
                    p.origem === "judit" && "bg-emerald-50 dark:bg-emerald-950/30 border-l-2 border-l-emerald-500"
                  )}
                >
                  <TableCell className="text-xs">{translatePolo(p.polo)}</TableCell>
                  <TableCell className="text-xs">{p.tipo_pessoa || "—"}</TableCell>
                  <TableCell className="font-medium text-sm">{p.nome}</TableCell>
                  <TableCell className="text-xs font-mono">{formatDocumento(p.documento)}</TableCell>
                  <TableCell>
                    {p.origem === "judit" ? (
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Judit</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Manual</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeParte(p.id)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
