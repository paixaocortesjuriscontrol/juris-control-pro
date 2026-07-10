import { useState } from "react";
import { Search, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  label: string;
  monitoramentoId?: string | null;
}

interface MonitoramentoDetalhe {
  id: string;
  tipo: string | null;
  termo_busca: string | null;
  descricao: string | null;
  oab: string | null;
  uf: string | null;
  ativo: boolean | null;
  arquivado: boolean | null;
  buscar_parte: boolean | null;
  somente_kurier: boolean | null;
  busca_stf_ativa: boolean | null;
  tribunais: string[] | null;
  tribunais_ufs: string[] | null;
  exclusoes: string[] | null;
  termos_or: string[] | null;
  condicao_concomitante: string[] | null;
  created_at: string | null;
  coordenacao?: { nome: string | null } | null;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 text-xs">
      <span className="text-muted-foreground">{k}</span>
      <span className="break-words">{v}</span>
    </div>
  );
}

function List({ items }: { items?: string[] | null }) {
  if (!items || items.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((t, i) => (
        <span key={i} className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{t}</span>
      ))}
    </div>
  );
}

export function MonitoramentoTermoBadge({ label, monitoramentoId }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<MonitoramentoDetalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = async () => {
    if (!monitoramentoId || data || loading) return;
    setLoading(true);
    setErro(null);
    try {
      const { data: row, error } = await supabase
        .from("monitoramentos_djen")
        .select(
          "id, tipo, termo_busca, descricao, oab, uf, ativo, arquivado, buscar_parte, somente_kurier, busca_stf_ativa, tribunais, tribunais_ufs, exclusoes, termos_or, condicao_concomitante, created_at, coordenacao:coordenacoes(nome)"
        )
        .eq("id", monitoramentoId)
        .maybeSingle();
      if (error) throw error;
      setData(row as any);
    } catch (e: any) {
      setErro(e.message || "Erro ao carregar detalhes");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) carregar();
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="focus:outline-none"
        >
          <Badge
            variant="outline"
            className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 cursor-pointer text-[10px] md:text-xs px-1.5 md:px-2 py-0 md:py-0.5"
          >
            <Search className="w-2.5 h-2.5 md:w-3 md:h-3 mr-0.5 md:mr-1 flex-shrink-0" />
            <span>{label}</span>
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 md:w-96 p-3 space-y-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b pb-2">
          <span className="text-sm font-semibold">Termo do monitoramento</span>
          {loading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
        </div>

        {!monitoramentoId && (
          <p className="text-xs text-muted-foreground">
            Publicação sem monitoramento vinculado (ex.: captura global).
          </p>
        )}

        {erro && <p className="text-xs text-destructive">{erro}</p>}

        {monitoramentoId && data && (
          <div className="space-y-1.5">
            <Row k="Tipo" v={<span className="uppercase font-medium">{data.tipo || "—"}</span>} />
            <Row k="Termo" v={<span className="font-medium">{data.termo_busca || "—"}</span>} />
            {data.descricao && <Row k="Descrição" v={data.descricao} />}
            {(data.oab || data.uf) && (
              <Row k="OAB/UF" v={`${data.oab || "—"} / ${data.uf || "—"}`} />
            )}
            <Row k="Coordenação" v={data.coordenacao?.nome || "—"} />
            <Row k="Tribunais" v={<List items={data.tribunais} />} />
            {data.tribunais_ufs && data.tribunais_ufs.length > 0 && (
              <Row k="UFs" v={<List items={data.tribunais_ufs} />} />
            )}
            {data.termos_or && data.termos_or.length > 0 && (
              <Row k="Termos OR" v={<List items={data.termos_or} />} />
            )}
            {data.condicao_concomitante && data.condicao_concomitante.length > 0 && (
              <Row k="Concomitantes" v={<List items={data.condicao_concomitante} />} />
            )}
            {data.exclusoes && data.exclusoes.length > 0 && (
              <Row k="Exclusões" v={<List items={data.exclusoes} />} />
            )}
            <Row
              k="Flags"
              v={
                <div className="flex flex-wrap gap-1">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] ${data.ativo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                    {data.ativo ? "Ativo" : "Inativo"}
                  </span>
                  {data.arquivado && (
                    <span className="rounded bg-amber-100 text-amber-700 px-1.5 py-0.5 text-[10px]">Arquivado</span>
                  )}
                  {data.buscar_parte && (
                    <span className="rounded bg-blue-100 text-blue-700 px-1.5 py-0.5 text-[10px]">Buscar parte</span>
                  )}
                  {data.somente_kurier && (
                    <span className="rounded bg-orange-100 text-orange-700 px-1.5 py-0.5 text-[10px]">Só Kurier</span>
                  )}
                  {data.busca_stf_ativa && (
                    <span className="rounded bg-purple-100 text-purple-700 px-1.5 py-0.5 text-[10px]">STF ativo</span>
                  )}
                </div>
              }
            />
            <Row k="Criado em" v={fmtDate(data.created_at)} />
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
