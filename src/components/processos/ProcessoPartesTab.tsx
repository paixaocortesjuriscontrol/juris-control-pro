import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, UserCheck, User, Building2, Scale, Mail, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  processoId?: string | null;
}

type Parte = {
  nome: string | null;
  documento: string | null;
  tipo_pessoa: string | null;
  polo: string | null;
  is_advogado: boolean | null;
  fonte?: string | null;
  raw?: any;
};

type Testemunha = {
  id: string;
  nome: string;
  cpf_rg: string | null;
  telefone: string | null;
  email: string | null;
  arrolada_por: string | null;
};

type ProcessoInfo = {
  polo_ativo: string | null;
  polo_passivo: string | null;
  terceiro_envolvido: string | null;
};

const formatDoc = (doc: string | null) => {
  if (!doc) return "—";
  const d = doc.replace(/\D/g, "");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return doc;
};

// Divide um texto livre digitado pelo usuário em nomes/entidades.
// Aceita separadores comuns: quebra de linha, ponto e vírgula, "e", " / ", "|".
const splitNomes = (txt: string | null | undefined): string[] => {
  if (!txt) return [];
  return String(txt)
    .split(/\n|;|\||\s\/\s|\s+e\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
};

type GrupoItem = {
  key: string;
  nome: string;
  documento?: string | null;
  tipo_pessoa?: string | null;
  fontes: Set<string>; // "usuario" | "judit" | fonte específica
  is_advogado?: boolean;
  advogado_de?: string | null;
  oab?: string | null;
};

const normNome = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

export function ProcessoPartesTab({ processoId }: Props) {
  const { data: processo } = useQuery<ProcessoInfo | null>({
    queryKey: ["processo-info-partes", processoId],
    enabled: !!processoId,
    queryFn: async () => {
      if (!processoId) return null;
      const { data, error } = await supabase
        .from("processos")
        .select("polo_ativo, polo_passivo, terceiro_envolvido")
        .eq("id", processoId)
        .maybeSingle();
      if (error) throw error;
      return (data as ProcessoInfo) || null;
    },
  });

  const { data: partes = [], isLoading } = useQuery<Parte[]>({
    queryKey: ["processo-partes", processoId],
    enabled: !!processoId,
    queryFn: async () => {
      if (!processoId) return [];
      const { data, error } = await supabase
        .from("processos_partes")
        .select("nome, documento, tipo_pessoa, polo, is_advogado, fonte, raw")
        .eq("processo_id", processoId)
        .order("is_advogado", { ascending: true })
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data as Parte[] | null) || [];
    },
  });

  const { data: testemunhas = [], isLoading: loadingTest } = useQuery<Testemunha[]>({
    queryKey: ["processo-testemunhas-partes", processoId],
    enabled: !!processoId,
    queryFn: async () => {
      if (!processoId) return [];
      const { data, error } = await supabase
        .from("processos_testemunhas" as any)
        .select("id, nome, cpf_rg, telefone, email, arrolada_por")
        .eq("processo_id", processoId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return ((data as any) || []) as Testemunha[];
    },
  });

  // Consolidação: agrupa por polo, mesclando os campos digitados pelo usuário
  // (processos.polo_ativo / polo_passivo / terceiro_envolvido) com os registros
  // vindos da Judit (processos_partes), evitando duplicidade por nome.
  const buildGrupo = (
    poloAlvos: Array<"Active" | "Passive" | "Terceiro">,
    textoUsuario: string | null | undefined,
  ): GrupoItem[] => {
    const mapa = new Map<string, GrupoItem>();

    // 1) Digitados pelo usuário
    for (const nome of splitNomes(textoUsuario)) {
      const k = normNome(nome);
      if (!mapa.has(k)) {
        mapa.set(k, { key: k, nome, fontes: new Set(["usuário"]) });
      } else {
        mapa.get(k)!.fontes.add("usuário");
      }
    }

    // 2) Vindos da Judit (processos_partes), separando advogados
    for (const p of partes) {
      if (!p.nome) continue;
      const poloMatch = poloAlvos.includes((p.polo as any) ?? "")
        || (poloAlvos.includes("Terceiro") && p.polo && !["Active", "Passive"].includes(p.polo));
      if (!poloMatch) continue;
      const k = normNome(p.nome);
      const existente = mapa.get(k);
      const fonteLabel = p.fonte ? String(p.fonte) : "judit";
      if (existente) {
        existente.documento = existente.documento || p.documento;
        existente.tipo_pessoa = existente.tipo_pessoa || p.tipo_pessoa;
        existente.is_advogado = existente.is_advogado || !!p.is_advogado;
        existente.advogado_de = existente.advogado_de || (p.raw as any)?.advogado_de || null;
        existente.oab = existente.oab || (p.raw as any)?.oab || null;
        existente.fontes.add(fonteLabel);
      } else {
        mapa.set(k, {
          key: k,
          nome: p.nome,
          documento: p.documento,
          tipo_pessoa: p.tipo_pessoa,
          is_advogado: !!p.is_advogado,
          advogado_de: (p.raw as any)?.advogado_de || null,
          oab: (p.raw as any)?.oab || null,
          fontes: new Set([fonteLabel]),
        });
      }
    }

    // Ordena: partes primeiro, advogados por último; depois alfabético
    return [...mapa.values()].sort((a, b) => {
      const av = a.is_advogado ? 1 : 0;
      const bv = b.is_advogado ? 1 : 0;
      if (av !== bv) return av - bv;
      return a.nome.localeCompare(b.nome, "pt-BR");
    });
  };

  const grupoAtivo = buildGrupo(["Active"], processo?.polo_ativo);
  const grupoPassivo = buildGrupo(["Passive"], processo?.polo_passivo);
  const grupoTerceiros = buildGrupo(["Terceiro"], processo?.terceiro_envolvido);

  const totalPartes = grupoAtivo.length + grupoPassivo.length + grupoTerceiros.length;

  const renderItem = (item: GrupoItem) => {
    const daJudit = item.fontes.has("judit");
    return (
    <li
      key={item.key}
      className={cn(
        "flex items-start gap-3 px-3 py-2 rounded-md border bg-card hover:bg-muted/40 transition-colors",
        item.is_advogado && "border-dashed"
      )}
    >
      <div className="mt-0.5 shrink-0 text-muted-foreground">
        {item.tipo_pessoa === "L" || item.tipo_pessoa?.toLowerCase().startsWith("j") ? (
          <Building2 className="w-4 h-4" />
        ) : (
          <User className="w-4 h-4" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "font-medium text-sm",
              item.is_advogado && !daJudit && "text-muted-foreground",
              daJudit && "text-emerald-700 dark:text-emerald-400",
            )}
          >
            {item.nome}
          </span>
          {item.is_advogado && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
              <Scale className="w-3 h-3 mr-1" /> advogado
            </Badge>
          )}
          {item.advogado_de && (
            <span className="text-[11px] text-muted-foreground">adv. de {item.advogado_de}</span>
          )}
          {item.oab && (
            <span className="text-[11px] text-muted-foreground font-mono">OAB {String(item.oab)}</span>
          )}
          {[...item.fontes].map((f) => (
            <Badge key={f} variant="secondary" className="text-[10px] px-1.5 py-0 h-4 uppercase">
              {f}
            </Badge>
          ))}
        </div>
        {(item.documento || item.tipo_pessoa) && (
          <div className={cn("text-xs mt-0.5 font-mono", daJudit ? "text-emerald-700/80 dark:text-emerald-400/80" : "text-muted-foreground")}>
            {formatDoc(item.documento ?? null)}
            {item.tipo_pessoa && <span className="ml-2 font-sans">· {item.tipo_pessoa}</span>}
          </div>
        )}
      </div>
    </li>
    );
  };

  const renderSecao = (titulo: string, itens: GrupoItem[], corBadge: string) => {
    if (itens.length === 0) return null;
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</h4>
          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-4", corBadge)}>{itens.length}</Badge>
        </div>
        <ul className="space-y-1.5">{itens.map(renderItem)}</ul>
      </div>
    );
  };

  return (
    <div className="space-y-4">
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="w-5 h-5" />
          Partes do processo
          {totalPartes > 0 && <Badge variant="secondary" className="ml-2">{totalPartes}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
          </div>
        ) : totalPartes === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
            Nenhuma parte registrada. Preencha <strong>Polo Ativo / Passivo / Terceiros</strong> na aba
            Visão Geral ou consulte a <strong>Judit</strong> para popular automaticamente.
          </div>
        ) : (
          <div className="space-y-4">
            {renderSecao("Polo Ativo", grupoAtivo, "text-emerald-700 border-emerald-300")}
            {renderSecao("Polo Passivo", grupoPassivo, "text-rose-700 border-rose-300")}
            {renderSecao("Terceiros Envolvidos", grupoTerceiros, "text-amber-700 border-amber-300")}
          </div>
        )}
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <UserCheck className="w-5 h-5" />
          Testemunhas
          {testemunhas.length > 0 && <Badge variant="secondary" className="ml-2">{testemunhas.length}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loadingTest ? (
          <Skeleton className="h-8" />
        ) : testemunhas.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            Nenhuma testemunha cadastrada.
          </div>
        ) : (
          <ul className="space-y-1.5">
            {testemunhas.map((t) => (
              <li
                key={t.id}
                className="flex items-start gap-3 px-3 py-2 rounded-md border bg-card hover:bg-muted/40 transition-colors"
              >
                <div className="mt-0.5 shrink-0 text-muted-foreground">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-sm">{t.nome}</span>
                    {t.arrolada_por && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                        arrolada por {t.arrolada_por}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                    {t.cpf_rg && <span className="font-mono">{t.cpf_rg}</span>}
                    {t.telefone && (
                      <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{t.telefone}</span>
                    )}
                    {t.email && (
                      <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" />{t.email}</span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
    </div>
  );
}