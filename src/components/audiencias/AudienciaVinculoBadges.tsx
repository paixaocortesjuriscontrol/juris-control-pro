import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeftCircle, ArrowRightCircle } from "lucide-react";

interface Props {
  audienciaId: string | undefined | null;
  /** id gravado em originada_de (audiência que deu origem a esta) */
  originadaDe?: string | null;
  compact?: boolean;
  onAbrir?: (audienciaId: string) => void;
}

const fmt = (v?: string | null) => {
  if (!v) return "sem data";
  try {
    const d = parseISO(v);
    return isValid(d) ? format(d, "dd/MM/yyyy", { locale: ptBR }) : v;
  } catch {
    return v;
  }
};

/**
 * Mostra o vínculo entre audiências: "Originada da audiência de dd/mm" (quando
 * esta nasceu de outra) e "Nova audiência em dd/mm" (quando esta gerou outra).
 */
export function AudienciaVinculoBadges({ audienciaId, originadaDe, compact = false, onAbrir }: Props) {
  const { data: anterior } = useQuery({
    queryKey: ["audiencia-vinculo-anterior", originadaDe],
    queryFn: async () => {
      if (!originadaDe) return null;
      const { data } = await supabase
        .from("audiencias_detectadas")
        .select("id, data_audiencia, hora, tipo_audiencia")
        .eq("id", originadaDe)
        .maybeSingle();
      return data ?? null;
    },
    enabled: !!originadaDe,
  });

  const { data: posteriores = [] } = useQuery({
    queryKey: ["audiencia-vinculo-posteriores", audienciaId],
    queryFn: async () => {
      if (!audienciaId) return [];
      const { data } = await supabase
        .from("audiencias_detectadas")
        .select("id, data_audiencia, hora, tipo_audiencia")
        .eq("originada_de", audienciaId)
        .order("data_audiencia", { ascending: true });
      return data ?? [];
    },
    enabled: !!audienciaId,
  });

  if (!anterior && posteriores.length === 0) return null;

  const size = compact ? "text-[10px] px-1.5 py-0" : "text-xs";

  return (
    <div className="flex flex-wrap items-center gap-1">
      {anterior && (
        <Badge
          variant="outline"
          className={`${size} bg-muted/60 ${onAbrir ? "cursor-pointer" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onAbrir?.(anterior.id);
          }}
          title="Audiência que deu origem a esta"
        >
          <ArrowLeftCircle className="mr-1 h-3 w-3" />
          Originada da audiência de {fmt(anterior.data_audiencia)}
        </Badge>
      )}
      {posteriores.map((p: any) => (
        <Badge
          key={p.id}
          variant="outline"
          className={`${size} bg-primary/10 text-primary border-primary/30 ${onAbrir ? "cursor-pointer" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onAbrir?.(p.id);
          }}
          title="Nova audiência designada a partir desta"
        >
          <ArrowRightCircle className="mr-1 h-3 w-3" />
          Nova audiência em {fmt(p.data_audiencia)}
          {p.hora ? ` às ${p.hora}` : ""}
        </Badge>
      ))}
    </div>
  );
}