import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  monitoramentoId: string | null;
  termoBusca?: string;
}

const ACAO_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  criacao: { label: "Criação", variant: "default" },
  edicao: { label: "Edição", variant: "secondary" },
  arquivamento: { label: "Arquivado", variant: "destructive" },
  desarquivamento: { label: "Desarquivado", variant: "outline" },
};

function formatValor(v: any): string {
  if (v === null || v === undefined) return "—";
  if (Array.isArray(v)) return v.length === 0 ? "—" : v.join(", ");
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

const CAMPOS_IGNORAR = new Set(["id", "created_at", "updated_at", "criado_por"]);

export function AuditoriaDjenDialog({ open, onOpenChange, monitoramentoId, termoBusca }: Props) {
  const { data: registros = [], isLoading } = useQuery({
    queryKey: ["monitoramentos-djen-auditoria", monitoramentoId],
    queryFn: async () => {
      if (!monitoramentoId) return [];
      const { data, error } = await supabase
        .from("monitoramentos_djen_auditoria" as any)
        .select("*")
        .eq("monitoramento_id", monitoramentoId)
        .order("alterado_em", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!monitoramentoId && open,
  });

  const userIds = Array.from(new Set(registros.map(r => r.alterado_por).filter(Boolean)));
  const { data: usuariosMap = {} } = useQuery({
    queryKey: ["audit-usuarios", userIds],
    queryFn: async () => {
      if (userIds.length === 0) return {};
      const { data } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .in("id", userIds);
      const map: Record<string, { nome?: string; email?: string }> = {};
      (data || []).forEach((p: any) => { map[p.id] = { nome: p.nome, email: p.email }; });
      return map;
    },
    enabled: userIds.length > 0,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Trilha de Auditoria</DialogTitle>
          <DialogDescription>
            {termoBusca ? `Histórico de alterações de "${termoBusca}"` : "Histórico de alterações"}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : registros.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhum registro de auditoria.</div>
          ) : (
            <div className="space-y-4">
              {registros.map((r) => {
                const meta = ACAO_LABEL[r.acao] || { label: r.acao, variant: "outline" as const };
                const usuario = r.alterado_por ? usuariosMap[r.alterado_por] : null;
                const campos: string[] = (r.campos_alterados || []).filter((c: string) => !CAMPOS_IGNORAR.has(c));
                return (
                  <div key={r.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(r.alterado_em), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {usuario?.nome || usuario?.email || r.alterado_por?.slice(0, 8) || "Sistema"}
                      </span>
                    </div>
                    {r.acao === "edicao" && campos.length > 0 && (
                      <div className="text-xs space-y-1">
                        {campos.map((c) => (
                          <div key={c} className="grid grid-cols-[120px_1fr] gap-2">
                            <span className="font-medium text-muted-foreground">{c}:</span>
                            <span>
                              <span className="line-through text-destructive/80">{formatValor(r.dados_antes?.[c])}</span>
                              {" → "}
                              <span className="text-foreground">{formatValor(r.dados_depois?.[c])}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}