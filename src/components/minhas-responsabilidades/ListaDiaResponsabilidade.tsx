import { useMemo, useState, type ReactNode } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { Copy, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ROT_TIPO: Record<string, string> = { tarefa: "Tarefa", prazo: "Prazo", ata: "Ata", evento: "Evento", audiencia: "Audiência" };
const CONCLUIDOS = ["cumprido", "protocolado", "baixado", "tratado", "verificado", "concluido_sem_sucesso"];
const CANCELADOS = ["cancelado", "cancelado_oculto"];

type Props = {
  dia: Date | null;
  itens: any[]; // já convertidos por paraItemAgenda
  onClose: () => void;
  onAbrirItem: (item: any) => void;
  renderMarcas: (item: any) => ReactNode;
  classeCor: (item: any) => string;
};

const fmt = (v?: string | null) => {
  if (!v) return "—";
  const s = String(v).slice(0, 10);
  const [y, m, d] = s.split("-");
  return y && m && d ? `${d}/${m}/${y}` : "—";
};
const tipoDe = (i: any) => (String(i.tipo_tarefa ?? "").toUpperCase().trim() === "ATA" ? "ata" : String(i.tipo ?? ""));
const grupoSituacao = (i: any) => {
  const s = String(i.status ?? "");
  if (CANCELADOS.includes(s)) return "cancelado";
  if (CONCLUIDOS.includes(s)) return "concluido";
  if (s === "atrasado") return "atrasado";
  return "aberto";
};
const limpaHtml = (t?: string | null) => String(t ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

export function ListaDiaResponsabilidade({ dia, itens, onClose, onAbrirItem, renderMarcas, classeCor }: Props) {
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState("todos");
  const [sit, setSit] = useState("todas");

  const idsPessoas = useMemo(() => {
    const s = new Set<string>();
    for (const i of itens) {
      (i.responsaveis_ids ?? []).forEach((u: string) => u && s.add(u));
      (i.participantes ?? []).forEach((p: any) => p?.usuario_id && s.add(p.usuario_id));
    }
    return [...s].sort();
  }, [itens]);

  const nomes = useQuery({
    queryKey: ["minhas-responsabilidades", "nomes-dia", idsPessoas.join(",")],
    enabled: !!dia && idsPessoas.length > 0,
    queryFn: async () => {
      const mapa: Record<string, string> = {};
      for (let k = 0; k < idsPessoas.length; k += 100) {
        const { data } = await (supabase as any).from("profiles_basic").select("id, nome").in("id", idsPessoas.slice(k, k + 100));
        (data ?? []).forEach((p: any) => (mapa[p.id] = p.nome));
      }
      return mapa;
    },
  });
  const nome = (id: string) => nomes.data?.[id] ?? "…";

  const resumo = useMemo(() => {
    const r = { total: itens.length, aberto: 0, atrasado: 0, concluido: 0, cancelado: 0, tipos: {} as Record<string, number> };
    for (const i of itens) {
      (r as any)[grupoSituacao(i)]++;
      const t = tipoDe(i);
      r.tipos[t] = (r.tipos[t] ?? 0) + 1;
    }
    return r;
  }, [itens]);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return itens.filter((i) => {
      if (tipo !== "todos" && tipoDe(i) !== tipo) return false;
      if (sit !== "todas" && grupoSituacao(i) !== sit) return false;
      if (!q) return true;
      const alvo = [i.titulo, i.processo?.numero, i.processo_numero, i.processo?.polo_ativo, i.processo?.polo_passivo, i.descricao, i.observacao]
        .map((x) => String(x ?? "").toLowerCase()).join(" ");
      return alvo.includes(q);
    });
  }, [itens, busca, tipo, sit]);

  const chip = (ativo: boolean, onClick: () => void, rotulo: string) => (
    <button type="button" onClick={onClick}
      className={cn("text-xs px-2 py-0.5 rounded-full border", ativo ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted")}>
      {rotulo}
    </button>
  );

  return (
    <Sheet open={!!dia} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[720px] p-0 flex flex-col gap-0">
        <SheetHeader className="p-4 border-b space-y-2 text-left">
          <SheetTitle className="capitalize">{dia ? format(dia, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR }) : ""}</SheetTitle>
          <div className="flex flex-wrap gap-1.5 text-xs">
            <Badge variant="secondary">{resumo.total} atividade(s)</Badge>
            <Badge variant="outline">{resumo.aberto} em aberto</Badge>
            {resumo.atrasado > 0 && <Badge variant="destructive">{resumo.atrasado} atrasada(s)</Badge>}
            <Badge variant="outline">{resumo.concluido} concluída(s)</Badge>
            {resumo.cancelado > 0 && <Badge variant="outline">{resumo.cancelado} cancelada(s)</Badge>}
            {Object.entries(resumo.tipos).map(([t, n]) => <Badge key={t} variant="outline">{ROT_TIPO[t] ?? t}: {n}</Badge>)}
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-2 top-2.5 text-muted-foreground" />
            <Input className="pl-8 h-9" placeholder="Buscar título, processo, parte ou observação..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-1">
            {chip(tipo === "todos", () => setTipo("todos"), "Todos os tipos")}
            {Object.keys(resumo.tipos).map((t) => <span key={t}>{chip(tipo === t, () => setTipo(t), ROT_TIPO[t] ?? t)}</span>)}
            <span className="w-2" />
            {chip(sit === "todas", () => setSit("todas"), "Todas")}
            {chip(sit === "aberto", () => setSit("aberto"), "Em aberto")}
            {chip(sit === "atrasado", () => setSit("atrasado"), "Atrasadas")}
            {chip(sit === "concluido", () => setSit("concluido"), "Concluídas")}
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {visiveis.length === 0 && <div className="text-sm text-muted-foreground p-6 text-center">Nenhuma atividade neste dia.</div>}
          {visiveis.map((i) => {
            const numero = i.processo?.numero ?? i.processo_numero ?? i.numero_processo ?? null;
            const ativo = i.processo?.polo_ativo ?? i.polo_ativo;
            const passivo = i.processo?.polo_passivo ?? i.polo_passivo;
            const obs = limpaHtml(i.descricao ?? i.observacao ?? i.observacoes);
            const resp = (i.responsaveis_ids ?? []) as string[];
            const env = ((i.participantes ?? []) as any[]).map((p) => p.usuario_id).filter(Boolean);
            const riscado = ["cancelado", "cancelado_oculto", "protocolado", "baixado"].includes(String(i.status ?? ""));
            const hora = i.hora_prevista ?? i.hora ?? i.hora_inicio ?? (String(i.data_inicio ?? "").length > 10 ? String(i.data_inicio).slice(11, 16) : null);
            return (
              <div key={`${i._fonte}:${i.id}`} role="button" tabIndex={0} onClick={() => onAbrirItem(i)}
                onKeyDown={(e) => e.key === "Enter" && onAbrirItem(i)}
                className={cn("rounded-md border-l-4 border p-3 cursor-pointer hover:shadow-sm transition text-sm space-y-1.5", classeCor(i))}>
                <div className="flex items-start gap-2">
                  <span className={cn("font-semibold flex-1", riscado && "line-through")}>{i.titulo || "(sem título)"}</span>
                  <div className="flex items-center gap-0.5 shrink-0">{renderMarcas(i)}</div>
                </div>
                <div className="flex flex-wrap gap-1 text-[11px]">
                  <Badge variant="outline" className="bg-background">{ROT_TIPO[tipoDe(i)] ?? tipoDe(i)}</Badge>
                  <Badge variant="outline" className="bg-background capitalize">{String(i.status ?? "—").replace(/_/g, " ")}</Badge>
                  {i.prioridade && <Badge variant="outline" className="bg-background capitalize">Prioridade {i.prioridade}</Badge>}
                  {hora && <Badge variant="outline" className="bg-background">{String(hora).slice(0, 5)}</Badge>}
                  {i._papel && <Badge variant="outline" className="bg-background">{i._papel === "responsavel" ? "Sou responsável" : "Sou envolvido"}</Badge>}
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Data base: </span>{fmt(i.data_base)}</div>
                  <div><span className="text-muted-foreground">Data limite: </span>{fmt(i.data_vencimento ?? i.data_inicio)}</div>
                  <div><span className="text-muted-foreground">Data fatal: </span>{fmt(i.data_fatal)}</div>
                </div>
                {numero && (
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-muted-foreground">Processo:</span>
                    <span className="font-mono">{numero}</span>
                    <Button size="icon" variant="ghost" className="h-5 w-5" title="Copiar número"
                      onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(String(numero)); toast.success("Número copiado"); }}>
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                )}
                {(ativo || passivo) && <div className="text-xs"><span className="text-muted-foreground">Partes: </span>{ativo || "—"} × {passivo || "—"}</div>}
                {(i.cliente?.nome || i.cliente_nome || i.coordenacao?.nome || i.coordenacao_nome) && (
                  <div className="text-xs flex flex-wrap gap-x-4">
                    {(i.cliente?.nome || i.cliente_nome) && <span><span className="text-muted-foreground">Cliente: </span>{i.cliente?.nome || i.cliente_nome}</span>}
                    {(i.coordenacao?.nome || i.coordenacao_nome) && <span><span className="text-muted-foreground">Coordenação: </span>{i.coordenacao?.nome || i.coordenacao_nome}</span>}
                  </div>
                )}
                <div className="text-xs flex flex-wrap gap-x-4">
                  <span><span className="text-muted-foreground">Responsáveis: </span>{resp.length ? resp.map(nome).join(", ") : "—"}</span>
                  {env.length > 0 && <span><span className="text-muted-foreground">Envolvidos: </span>{env.map(nome).join(", ")}</span>}
                </div>
                {obs && <div className="text-xs text-muted-foreground line-clamp-2" title={obs}>{obs}</div>}
              </div>
            );
          })}
        </div>

        <div className="border-t p-3 text-xs text-muted-foreground">
          Mostrando {visiveis.length} de {itens.length}. Clique numa atividade para abrir a ficha completa.
        </div>
      </SheetContent>
    </Sheet>
  );
}
