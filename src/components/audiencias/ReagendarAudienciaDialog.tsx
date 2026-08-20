import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CalendarClock, CopyPlus } from "lucide-react";
import { AudienciaDetectada } from "@/hooks/useAudienciasDetectadas";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, parseISO, isValid } from "date-fns";
import { invalidarItensAgenda } from "@/lib/invalidarItensAgenda";

interface Props {
  audiencia: AudienciaDetectada | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** "reagendar" edita o mesmo registro; "nova" cria uma cópia vinculada */
  modo: "reagendar" | "nova";
  invalidateKey?: unknown[];
}

export function ReagendarAudienciaDialog({ audiencia, open, onOpenChange, modo, invalidateKey }: Props) {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [form, setForm] = useState({
    data_audiencia: "",
    hora: "",
    hora_brasilia: "",
    tipo_audiencia: "",
    modalidade: "",
    motivo: "",
  });

  useEffect(() => {
    if (!audiencia || !open) return;
    let dataFormatted = "";
    if (audiencia.data_audiencia) {
      try {
        const d = parseISO(audiencia.data_audiencia);
        if (isValid(d)) dataFormatted = format(d, "yyyy-MM-dd");
      } catch { /* ignore */ }
    }
    setForm({
      data_audiencia: modo === "reagendar" ? dataFormatted : "",
      hora: audiencia.hora || "",
      hora_brasilia: audiencia.hora_brasilia || "",
      tipo_audiencia: audiencia.tipo_audiencia || "",
      modalidade: audiencia.modalidade || "",
      motivo: "",
    });
  }, [audiencia, open, modo]);

  const change = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!audiencia) return;
    if (!form.data_audiencia) {
      toast.error("Informe a nova data");
      return;
    }
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const novaDataISO = `${form.data_audiencia}T12:00:00.000Z`;

      if (modo === "reagendar") {
        const { data: atualizadas, error: updErr } = await supabase
          .from("audiencias_detectadas")
          .update({
            data_audiencia: novaDataISO,
            hora: form.hora || null,
            hora_brasilia: form.hora_brasilia || null,
            tipo_audiencia: form.tipo_audiencia || null,
            modalidade: form.modalidade || null,
            status: "reagendado",
          })
          .eq("id", audiencia.id)
          .select("id, data_audiencia, hora");
        if (updErr) throw updErr;
        if (!atualizadas || atualizadas.length === 0) {
          throw new Error(
            "A nova data NÃO foi salva (nenhum registro atualizado). Verifique se você tem permissão para reagendar esta audiência.",
          );
        }
        const salvo = String(atualizadas[0].data_audiencia || "").slice(0, 10);
        if (salvo !== form.data_audiencia) {
          throw new Error(
            `A data gravada (${salvo || "vazia"}) não corresponde à informada (${form.data_audiencia}). Tente novamente.`,
          );
        }

        const { error: histErr } = await supabase
          .from("historico_reagendamentos_audiencia")
          .insert({
            audiencia_id: audiencia.id,
            data_anterior: audiencia.data_audiencia || null,
            data_nova: novaDataISO,
            hora_anterior: audiencia.hora || null,
            hora_nova: form.hora || null,
            tipo_anterior: audiencia.tipo_audiencia || null,
            tipo_novo: form.tipo_audiencia || null,
            modalidade_anterior: audiencia.modalidade || null,
            modalidade_nova: form.modalidade || null,
            motivo: form.motivo || null,
            alterado_por: user?.id ?? null,
          });
        if (histErr) console.error("Erro ao gravar histórico:", histErr);

        toast.success(
          `Audiência reagendada para ${form.data_audiencia.split("-").reverse().join("/")}${form.hora ? ` às ${form.hora}` : ""}`,
        );
      } else {
        // Nova audiência: copia todos os campos e cria novo registro vinculado
        const { id, created_at, updated_at, tratado_por, tratado_em, ...copy } = audiencia as any;
        const insertPayload: Record<string, any> = {
          ...copy,
          data_audiencia: novaDataISO,
          hora: form.hora || null,
          hora_brasilia: form.hora_brasilia || null,
          tipo_audiencia: form.tipo_audiencia || null,
          modalidade: form.modalidade || null,
          status: "pendente",
          originada_de: audiencia.id,
          tratado_por: null,
          tratado_em: null,
          providencias_tomadas: null,
          observacoes: form.motivo
            ? `Nova audiência originada de ${audiencia.id}. Motivo: ${form.motivo}`
            : `Nova audiência originada de ${audiencia.id}`,
        };
        const { data: criada, error: insErr } = await supabase
          .from("audiencias_detectadas")
          .insert(insertPayload)
          .select("id")
          .maybeSingle();
        if (insErr) throw insErr;
        if (!criada) throw new Error("A nova audiência não foi criada. Verifique suas permissões.");
        toast.success("Nova audiência criada a partir da atual");
      }

      // Atualiza TODAS as listas (lista, agenda, kanban, painel, stats, histórico)
      // antes de fechar o diálogo — evita a necessidade de recarregar a página.
      await invalidarItensAgenda(queryClient, [
        ["audiencias-detectadas"],
        ["audiencias-processo"],
        ["audiencias-stats"],
        ["historico-reagendamentos", audiencia.id],
        ...(invalidateKey ? [invalidateKey as unknown[]] : []),
      ]);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(`Erro: ${err.message ?? err}`);
    } finally {
      setIsLoading(false);
    }
  };

  const isReagendar = modo === "reagendar";
  const Icon = isReagendar ? CalendarClock : CopyPlus;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" />
            {isReagendar ? "Reagendar audiência" : "Nova audiência (a partir da atual)"}
          </DialogTitle>
          <DialogDescription>
            {isReagendar
              ? "Altera data/hora/tipo/modalidade do mesmo registro. O histórico fica salvo automaticamente."
              : "Cria um novo registro copiando os dados da atual, vinculado por 'originada de'."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="r_data">Nova data *</Label>
              <Input id="r_data" type="date" value={form.data_audiencia}
                onChange={(e) => change("data_audiencia", e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="r_hora">Hora</Label>
              <Input id="r_hora" placeholder="Ex: 14:00" value={form.hora}
                onChange={(e) => change("hora", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="r_hora_bsb">Hora Brasília</Label>
              <Input id="r_hora_bsb" placeholder="Ex: 15:00" value={form.hora_brasilia}
                onChange={(e) => change("hora_brasilia", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="r_modalidade">Modalidade</Label>
              <Select value={form.modalidade || ""} onValueChange={(v) => change("modalidade", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Virtual">Virtual</SelectItem>
                  <SelectItem value="Presencial">Presencial</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="r_tipo">Tipo de audiência</Label>
            <Input id="r_tipo" placeholder="Ex: Instrução Presencial" value={form.tipo_audiencia}
              onChange={(e) => change("tipo_audiencia", e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="r_motivo">Motivo {isReagendar ? "(obrigatório para histórico)" : "(opcional)"}</Label>
            <Textarea id="r_motivo" rows={3} value={form.motivo}
              placeholder={isReagendar ? "Ex: petição de adiamento pela parte contrária" : "Ex: audiência complementar"}
              onChange={(e) => change("motivo", e.target.value)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Icon className="h-4 w-4 mr-2" />}
              {isReagendar ? "Reagendar" : "Criar nova audiência"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}