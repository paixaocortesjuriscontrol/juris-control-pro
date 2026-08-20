import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link2 } from "lucide-react";

interface Props {
  processoId?: string | null;
  processoNumero?: string | null;
  /** audiência atual (excluída da lista) */
  audienciaId?: string | null;
  value: string;
  onChange: (v: string) => void;
}

const NENHUMA = "__nenhuma__";

/**
 * Permite vincular uma audiência recém-criada à audiência anterior do mesmo
 * processo (a que aconteceu e na qual o juiz designou esta nova data).
 */
export function VincularAudienciaAnterior({ processoId, processoNumero, audienciaId, value, onChange }: Props) {
  const { data: anteriores = [] } = useQuery({
    queryKey: ["audiencias-anteriores-processo", processoId, processoNumero, audienciaId],
    queryFn: async () => {
      if (!processoId && !processoNumero) return [];
      let q = supabase
        .from("audiencias_detectadas")
        .select("id, data_audiencia, hora, tipo_audiencia, titulo")
        .not("data_audiencia", "is", null)
        .order("data_audiencia", { ascending: false })
        .limit(20);
      q = processoId ? q.eq("processo_id", processoId) : q.eq("processo_numero", processoNumero as string);
      const { data } = await q;
      return (data ?? []).filter((a: any) => a.id !== audienciaId);
    },
    enabled: !!(processoId || processoNumero),
  });

  if (anteriores.length === 0) return null;

  const fmt = (a: any) => {
    let d = a.data_audiencia as string;
    try {
      const parsed = parseISO(d);
      if (isValid(parsed)) d = format(parsed, "dd/MM/yyyy", { locale: ptBR });
    } catch { /* mantém original */ }
    return `${d}${a.hora ? ` às ${a.hora}` : ""} — ${a.titulo || a.tipo_audiencia || "Audiência"}`;
  };

  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-sm">
        <Link2 className="h-3.5 w-3.5" /> Vincular à audiência anterior (opcional)
      </Label>
      <Select value={value || NENHUMA} onValueChange={(v) => onChange(v === NENHUMA ? "" : v)}>
        <SelectTrigger>
          <SelectValue placeholder="Selecione a audiência que designou esta nova data" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NENHUMA}>Nenhuma</SelectItem>
          {anteriores.map((a: any) => (
            <SelectItem key={a.id} value={a.id}>{fmt(a)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-[11px] text-muted-foreground">
        Use quando esta audiência foi designada em uma audiência anterior do mesmo processo.
      </p>
    </div>
  );
}