import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
 * Os selos são links: sem `onAbrir`, abrem um resumo da audiência vinculada.
 */
export function AudienciaVinculoBadges({ audienciaId, originadaDe, compact = false, onAbrir }: Props) {
  const [detalheId, setDetalheId] = useState<string | null>(null);

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

  const { data: detalhe } = useQuery({
    queryKey: ["audiencia-vinculo-detalhe", detalheId],
    queryFn: async () => {
      if (!detalheId) return null;
      const { data } = await supabase
        .from("audiencias_detectadas")
        .select("*")
        .eq("id", detalheId)
        .maybeSingle();
      return (data as any) ?? null;
    },
    enabled: !!detalheId,
  });

  if (!anterior && posteriores.length === 0) return null;

  const size = compact ? "text-[10px] px-1.5 py-0" : "text-xs";
  const linkClass = "cursor-pointer underline underline-offset-2 hover:opacity-80";

  const abrir = (id: string) => {
    if (onAbrir) onAbrir(id);
    else setDetalheId(id);
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-1">
        {anterior && (
          <Badge
            variant="outline"
            role="link"
            tabIndex={0}
            className={`${size} bg-muted/60 ${linkClass}`}
            onClick={(e) => {
              e.stopPropagation();
              abrir(anterior.id);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                abrir(anterior.id);
              }
            }}
            title="Abrir a audiência que deu origem a esta"
          >
            <ArrowLeftCircle className="mr-1 h-3 w-3" />
            Originada da audiência de {fmt(anterior.data_audiencia)}
          </Badge>
        )}
        {posteriores.map((p: any) => (
          <Badge
            key={p.id}
            variant="outline"
            role="link"
            tabIndex={0}
            className={`${size} bg-primary/10 text-primary border-primary/30 ${linkClass}`}
            onClick={(e) => {
              e.stopPropagation();
              abrir(p.id);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                abrir(p.id);
              }
            }}
            title="Abrir a nova audiência designada a partir desta"
          >
            <ArrowRightCircle className="mr-1 h-3 w-3" />
            Nova audiência em {fmt(p.data_audiencia)}
            {p.hora ? ` às ${p.hora}` : ""}
          </Badge>
        ))}
      </div>

      <Dialog open={!!detalheId} onOpenChange={(o) => !o && setDetalheId(null)}>
        <DialogContent className="max-w-lg" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Audiência vinculada</DialogTitle>
          </DialogHeader>
          {!detalhe ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : (
            <div className="space-y-2 text-sm">
              <p className="font-mono font-semibold">{detalhe.processo_numero || "Sem nº de processo"}</p>
              <p>
                <span className="text-muted-foreground">Data: </span>
                {fmt(detalhe.data_audiencia)}
                {detalhe.hora ? ` às ${detalhe.hora}` : ""}
              </p>
              {detalhe.tipo_audiencia && (
                <p>
                  <span className="text-muted-foreground">Tipo: </span>
                  {detalhe.tipo_audiencia}
                </p>
              )}
              {detalhe.modalidade && (
                <p>
                  <span className="text-muted-foreground">Modalidade: </span>
                  {detalhe.modalidade}
                </p>
              )}
              {(detalhe.vara_camara || detalhe.comarca) && (
                <p>
                  <span className="text-muted-foreground">Local: </span>
                  {[detalhe.vara_camara, detalhe.comarca].filter(Boolean).join(" - ")}
                </p>
              )}
              {detalhe.cliente && (
                <p>
                  <span className="text-muted-foreground">Cliente: </span>
                  {detalhe.cliente}
                </p>
              )}
              {detalhe.status && (
                <p>
                  <span className="text-muted-foreground">Situação: </span>
                  {detalhe.status}
                </p>
              )}
              {detalhe.observacoes && (
                <p className="whitespace-pre-wrap">
                  <span className="text-muted-foreground">Observações: </span>
                  {detalhe.observacoes}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
