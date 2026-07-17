import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface Sugestao {
  publicacao_id: string;
  tipo: "tarefa" | "prazo" | "audiencia" | "evento";
  titulo: string;
  descricao?: string;
  data_sugerida?: string;
  prioridade?: "baixa" | "media" | "alta" | "urgente";
  aceitar?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  publicacaoIds: string[];
  coordenacaoId?: string;
}

export function PreagendarIaDialog({ open, onOpenChange, publicacaoIds, coordenacaoId }: Props) {
  const [analisando, setAnalisando] = useState(false);
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [salvando, setSalvando] = useState(false);
  const qc = useQueryClient();

  async function mensagemErroFunction(error: any) {
    if (!error) return "Erro desconhecido";
    try {
      if (error.context) {
        const text = await error.context.text();
        const parsed = JSON.parse(text);
        return parsed?.details || parsed?.error || text || error.message;
      }
    } catch {
      // mantém a mensagem padrão abaixo
    }
    return error.message ?? String(error);
  }

  async function analisar() {
    if (publicacaoIds.length === 0) return;
    setAnalisando(true);
    try {
      const { data, error } = await supabase.functions.invoke("ia-preagendar-djen", {
        body: { publicacao_ids: publicacaoIds },
      });
      if (error) throw new Error(await mensagemErroFunction(error));
      setSugestoes((data?.sugestoes ?? []).map((s: Sugestao) => ({ ...s, aceitar: true })));
    } catch (e: any) {
      toast.error("Falha na IA: " + (e?.message ?? e));
    } finally {
      setAnalisando(false);
    }
  }

  async function salvar() {
    const aceitas = sugestoes.filter((s) => s.aceitar);
    if (aceitas.length === 0) return;
    setSalvando(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let criadas = 0;

      for (const s of aceitas) {
        if (s.tipo === "tarefa" || s.tipo === "prazo") {
          const { error } = await supabase.from("tarefas").insert({
            titulo: s.titulo,
            descricao: s.descricao ?? null,
            data_fatal: s.data_sugerida ?? null,
            data_vencimento: s.data_sugerida ?? null,
            prioridade: s.prioridade ?? "media",
            status: "pendente",
            tipo_tarefa: s.tipo === "prazo" ? "prazo" : "tarefa",
            tipo_registro: s.tipo === "prazo" ? "prazo" : "tarefa",
            criado_por: user?.id,
            responsavel_id: user?.id,
            coordenacao_id: coordenacaoId,
            origem: "ia_djen",
          } as any);
          if (!error) criadas++;
        } else if (s.tipo === "audiencia") {
          const { error } = await supabase.from("audiencias_detectadas").insert({
            titulo: s.titulo,
            data_audiencia: s.data_sugerida ? new Date(s.data_sugerida).toISOString() : null,
            status: "pendente",
            criado_por: user?.id,
            coordenacao_id: coordenacaoId,
            origem: "ia_djen",
          } as any);
          if (!error) criadas++;
        } else if (s.tipo === "evento") {
          const { error } = await supabase.from("eventos_agenda").insert({
            titulo: s.titulo,
            descricao: s.descricao ?? null,
            tipo: "evento",
            data_inicio: s.data_sugerida ? new Date(s.data_sugerida + "T09:00:00").toISOString() : new Date().toISOString(),
            criado_por: user?.id,
            coordenacao_id: coordenacaoId,
          } as any);
          if (!error) criadas++;
        }
      }
      toast.success(`${criadas} item(ns) criado(s)`);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["tarefas"] }),
        qc.invalidateQueries({ queryKey: ["eventos-agenda"] }),
        qc.invalidateQueries({ queryKey: ["audiencias"] }),
      ]);
      onOpenChange(false);
      setSugestoes([]);
    } catch (e: any) {
      toast.error("Erro ao salvar: " + (e?.message ?? e));
    } finally {
      setSalvando(false);
    }
  }

  function updateSug(i: number, patch: Partial<Sugestao>) {
    setSugestoes((prev) => prev.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setSugestoes([]); onOpenChange(v); }}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Pré-agendar com IA — {publicacaoIds.length} publicação(ões)
          </DialogTitle>
        </DialogHeader>

        {sugestoes.length === 0 ? (
          <div className="py-10 text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              A IA vai analisar as publicações selecionadas e propor tarefas, prazos, audiências ou eventos.
            </p>
            <Button onClick={analisar} disabled={analisando || publicacaoIds.length === 0}>
              {analisando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Analisar com IA
            </Button>
          </div>
        ) : (
          <>
            <div className="max-h-[60vh] overflow-auto border rounded">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="p-2 w-10">✓</th>
                    <th className="p-2 text-left">Tipo</th>
                    <th className="p-2 text-left">Título</th>
                    <th className="p-2 text-left w-32">Data</th>
                    <th className="p-2 text-left w-32">Prioridade</th>
                  </tr>
                </thead>
                <tbody>
                  {sugestoes.map((s, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2 text-center">
                        <input type="checkbox" checked={!!s.aceitar} onChange={(e) => updateSug(i, { aceitar: e.target.checked })} />
                      </td>
                      <td className="p-2">
                        <Select value={s.tipo} onValueChange={(v) => updateSug(i, { tipo: v as any })}>
                          <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="tarefa">Tarefa</SelectItem>
                            <SelectItem value="prazo">Prazo</SelectItem>
                            <SelectItem value="audiencia">Audiência</SelectItem>
                            <SelectItem value="evento">Evento</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-2">
                        <Input value={s.titulo} onChange={(e) => updateSug(i, { titulo: e.target.value })} className="h-8" />
                      </td>
                      <td className="p-2">
                        <Input type="date" value={s.data_sugerida ?? ""} onChange={(e) => updateSug(i, { data_sugerida: e.target.value })} className="h-8" />
                      </td>
                      <td className="p-2">
                        <Select value={s.prioridade ?? "media"} onValueChange={(v) => updateSug(i, { prioridade: v as any })}>
                          <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="baixa">Baixa</SelectItem>
                            <SelectItem value="media">Média</SelectItem>
                            <SelectItem value="alta">Alta</SelectItem>
                            <SelectItem value="urgente">Urgente</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end gap-2 pt-3">
              <Button variant="outline" onClick={() => setSugestoes([])}>
                <X className="h-4 w-4 mr-1" /> Descartar
              </Button>
              <Button onClick={salvar} disabled={salvando || sugestoes.filter(s => s.aceitar).length === 0}>
                {salvando ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                Criar {sugestoes.filter(s => s.aceitar).length} item(ns)
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}