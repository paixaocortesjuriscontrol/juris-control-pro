import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { obterVariantesCnjBusca } from "@/utils/cnjMask";

interface Props {
  processoId: string;
  processoNumero?: string | null;
}

interface ParteRow {
  id: string;
  nome: string;
  documento: string | null;
  tipo_pessoa: string | null;
  polo: string | null;
  lado_efetivo: string | null;
  is_advogado: boolean;
  fonte: string;
  raw: any;
  created_at: string;
}

export function ProcessoJuditTab({ processoId, processoNumero }: Props) {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [liveData, setLiveData] = useState<any>(null);

  const { data: partes = [], isLoading: loadingPartes } = useQuery({
    queryKey: ["processos_partes", processoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("processos_partes" as any)
        .select("*")
        .eq("processo_id", processoId)
        .order("is_advogado", { ascending: true })
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as ParteRow[];
    },
  });

  const { data: ultimaConsulta } = useQuery({
    queryKey: ["consultas_judit", processoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultas_judit")
        .select("*")
        .eq("processo_id", processoId)
        .order("requisitada_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fallback: o sync feito a partir do form "Visão Geral" grava em judit_logs
  // (e não em consultas_judit). Usamos esse log mais recente para popular a Capa
  // quando não há consultas_judit cadastrada para o processo.
  const { data: ultimoJuditLog } = useQuery({
    queryKey: ["judit_logs_capa", processoNumero],
    enabled: !!processoNumero,
    queryFn: async () => {
      const variantes = obterVariantesCnjBusca(processoNumero!);
      const { data, error } = await supabase
        .from("judit_logs" as any)
        .select("raw_response, created_at")
        .in("processo_numero", variantes)
        .eq("status", "sucesso")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const handleRefresh = async () => {
    if (!processoNumero) {
      toast.warning("Processo sem número CNJ cadastrado.");
      return;
    }
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke("buscar-judit", {
        body: { numero_processo: processoNumero, com_anexos: false, force_refresh: true },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      const partesNovas = Array.isArray(data?.parties_detail) ? data.parties_detail : [];
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData?.user?.id || null;
      setLiveData(data);
      // Substitui partes vindas da Judit
      await supabase
        .from("processos_partes" as any)
        .delete()
        .eq("processo_id", processoId)
        .eq("fonte", "judit");
      if (partesNovas.length > 0) {
        const rows = partesNovas
          .map((p: any) => ({
            processo_id: processoId,
            nome: String(p?.nome || "").trim(),
            documento: p?.documento || null,
            tipo_pessoa: p?.tipo_pessoa || null,
            polo: p?.polo || null,
            lado_efetivo: p?.lado_efetivo || null,
            is_advogado: !!p?.is_advogado,
            fonte: "judit",
            raw: p,
            created_by: uid,
          }))
          .filter((r) => r.nome);
        if (rows.length > 0) {
          await supabase.from("processos_partes" as any).insert(rows);
        }
      }
      await supabase.from("consultas_judit").insert({
        processo_id: processoId,
        requisitada_em: new Date().toISOString(),
        status_http: 200,
        payload_resposta: data,
        erro: null,
      });
      await queryClient.invalidateQueries({ queryKey: ["processos_partes", processoId] });
      await queryClient.invalidateQueries({ queryKey: ["consultas_judit", processoId] });
      toast.success(`Judit atualizada — ${partesNovas.length} parte(s).`);
    } catch (e: any) {
      toast.error("Erro ao consultar Judit: " + (e?.message || "desconhecido"));
    } finally {
      setRefreshing(false);
    }
  };

  const rawPayload: any =
    liveData || ultimaConsulta?.payload_resposta || ultimoJuditLog?.raw_response || null;
  const payload: any = normalizeJuditPayload(rawPayload);
  const fmtBR = (iso?: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString("pt-BR");
  };
  const fmtHora = (h?: string | null) => {
    if (!h) return null;
    const m = String(h).match(/^(\d{1,2}):(\d{2})/);
    return m ? `${m[1].padStart(2, "0")}:${m[2]}` : String(h);
  };
  const partesNaoAdv = partes.filter((p) => !p.is_advogado);
  const advogados = partes.filter((p) => p.is_advogado);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-600" />
          Detalhe Judit
        </h3>
        <Button size="sm" variant="outline" onClick={handleRefresh} disabled={refreshing} className="gap-1">
          {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Atualizar
        </Button>
      </div>

      {/* Resumo de capa */}
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm">Capa</CardTitle>
        </CardHeader>
        <CardContent className="py-3 px-4 grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
          <Field label="Tribunal" value={payload?.tribunal_acronimo || payload?.tribunal} />
          <Field label="Órgão julgador" value={payload?.orgao_julgador} />
          <Field label="Classe" value={payload?.classe_capa || payload?.tipo_recurso} />
          <Field label="Distribuição" value={payload?.data_distribuicao_br || fmtBR(payload?.data_distribuicao)} />
          <Field label="Relator" value={payload?.relator} />
          <Field label="Turma" value={payload?.turma} />
          <Field label="Situação" value={payload?.situacao_processo} />
          <Field label="Reclamante" value={payload?.reclamante} />
          <Field label="Reclamada" value={payload?.reclamada} />
          <Field label="Recorrente" value={payload?.recorrente} />
          <Field label="Tipo de recurso" value={payload?.tipo_recurso} />
          <Field label="Tipo recurso (banco)" value={payload?.tipo_recurso_banco} />
          <Field label="Tipo recurso (reclamante)" value={payload?.tipo_recurso_reclamante} />
          <Field label="Tipo recurso (terceiro)" value={payload?.tipo_recurso_terceiro} />
          <Field label="Dossiê" value={payload?.dossie} />
          <Field label="Valor da causa" value={payload?.valor_causa != null ? Number(payload.valor_causa).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : null} />
          <Field label="Comarca" value={payload?.comarca_completa || payload?.comarca} />
          <Field label="Vara" value={payload?.vara} />
          <Field label="UF" value={payload?.uf} />
          <Field label="Instância" value={payload?.instancia} />
          <Field label="Sistema" value={payload?.sistema} />
          <Field label="Assunto" value={payload?.assunto} />
          <Field label="Juiz" value={payload?.juiz} />
          <Field label="Gratuidade" value={payload?.gratuidade_justica === true ? "Sim" : payload?.gratuidade_justica === false ? "Não" : null} />
          <Field label="Andamentos" value={payload?.total_movimentacoes != null ? String(payload.total_movimentacoes) : null} />
          <Field label="Último andamento" value={payload?.ultimo_andamento} />
          <Field
            label="Julgamento"
            value={[
              payload?.tem_data_julgamento ? "Sim" : null,
              fmtBR(payload?.data_julgamento),
              fmtHora(payload?.horario_julgamento),
              payload?.tipo_julgamento,
            ].filter(Boolean).join(" · ") || null}
          />
          <Field
            label="Processo baixado"
            value={
              payload?.processo_baixado === true
                ? "Sim"
                : payload?.processo_baixado === false
                ? "Não"
                : null
            }
          />
        </CardContent>
      </Card>

      {/* Partes */}
      <Card>
        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="w-4 h-4" /> Partes ({partesNaoAdv.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="py-2 px-4">
          {loadingPartes ? (
            <p className="text-xs text-muted-foreground">Carregando…</p>
          ) : partesNaoAdv.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma parte registrada pela Judit.</p>
          ) : (
            <div className="divide-y">
              {partesNaoAdv.map((p) => (
                <div key={p.id} className="py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate text-emerald-700 dark:text-emerald-400">{p.nome}</p>
                    <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                      {p.tipo_pessoa || "—"} {p.documento ? `· ${p.documento}` : ""}
                    </p>
                  </div>
                  {p.lado_efetivo && (
                    <Badge
                      variant="outline"
                      className={
                        p.lado_efetivo === "ACTIVE"
                          ? "text-emerald-700 border-emerald-300"
                          : "text-rose-700 border-rose-300"
                      }
                    >
                      {p.lado_efetivo === "ACTIVE" ? "Ativo" : "Passivo"}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Advogados */}
      {advogados.length > 0 && (
        <Card>
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">Advogados ({advogados.length})</CardTitle>
          </CardHeader>
          <CardContent className="py-2 px-4">
            <div className="divide-y">
              {advogados.map((p) => (
                <div key={p.id} className="py-2">
                  <p className="text-sm text-emerald-700 dark:text-emerald-400">{p.nome}</p>
                  <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                    {p.documento || ""} {p.polo ? `· ${p.polo}` : ""}
                    {(p as any)?.raw?.advogado_de ? ` · adv. de ${(p as any).raw.advogado_de}` : ""}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {ultimaConsulta?.requisitada_em && (
        <p className="text-[11px] text-muted-foreground text-right">
          Última consulta: {new Date(ultimaConsulta.requisitada_em).toLocaleString("pt-BR")}
        </p>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[10px] uppercase text-muted-foreground tracking-wide">{label}</p>
      <p className={`text-xs font-medium break-words ${value ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}>{value || "—"}</p>
    </div>
  );
}

// Normaliza o payload da consulta Judit para sempre expor os mesmos campos planos,
// independentemente da origem (buscar-judit já traz tudo achatado; consultar-processo-judit
// grava o payload bruto da Judit com `response_data`/`courts`/`judge`/`parties`).
function normalizeJuditPayload(p: any): any {
  if (!p || typeof p !== "object") return {};
  // Se já tem campos planos do buscar-judit, devolve direto (preserva tudo).
  if (p.parties_detail || p.reclamante || p.orgao_julgador) return p;

  const rd = p.response_data || p.lawsuit || p;
  const courts: any[] = Array.isArray(rd?.courts) ? rd.courts : [];
  const parties: any[] = Array.isArray(rd?.parties) ? rd.parties : [];
  const classifications: any[] = Array.isArray(rd?.classifications) ? rd.classifications : [];

  const orgaoJulgador =
    rd?.county ||
    courts.find((c) => /vara|gabinete|turma|c[âa]mara|se[çc][aã]o|pleno|sbdi/i.test(c?.name || ""))?.name ||
    courts[0]?.name ||
    null;

  let turma: string | null = null;
  for (const c of courts) {
    const n = c?.name || "";
    if (/turma|sbdi|sdi|pleno|especial|se[çc][aã]o/i.test(n)) {
      turma = n;
      break;
    }
  }

  let relator: string | null = null;
  const judge = rd?.judge;
  if (typeof judge === "string" && judge.trim() && !/n[ãa]o\s+informado/i.test(judge)) {
    relator = judge.trim();
  } else if (judge?.name) {
    relator = String(judge.name).trim();
  }
  // TST costuma usar "Gabinete do Ministro Fulano"
  if (!relator && orgaoJulgador) {
    const m = String(orgaoJulgador).match(/Gabinete\s+d[aoe]s?\s+Ministr[oa]\s+(.+)/i);
    if (m) relator = m[1].trim();
  }

  const classe =
    classifications[classifications.length - 1]?.name ||
    classifications[0]?.name ||
    null;

  const ativos = parties.filter(
    (x) => String(x?.side || "").toLowerCase() === "active" && !/advogado/i.test(x?.person_type || ""),
  );
  const passivos = parties.filter(
    (x) => String(x?.side || "").toLowerCase() === "passive" && !/advogado/i.test(x?.person_type || ""),
  );

  const dataDistISO = rd?.distribution_date || null;
  let dataDistBR: string | null = null;
  if (dataDistISO) {
    const d = new Date(dataDistISO);
    if (!isNaN(d.getTime())) {
      dataDistBR = d.toLocaleDateString("pt-BR");
    }
  }

  const phaseRaw = String(rd?.phase || rd?.status || "").toUpperCase();
  let situacao: string | null = null;
  if (/ARQUIVAD|FINALIZAD/.test(phaseRaw)) situacao = "Arquivado";
  else if (/BAIXAD/.test(phaseRaw)) situacao = "Baixado";
  else if (/SUSPENS/.test(phaseRaw)) situacao = "Suspenso";
  else if (/ATIV/.test(phaseRaw)) situacao = "Ativo";
  else if (rd?.phase) situacao = String(rd.phase);

  const tribunal =
    rd?.tribunal_acronym ||
    rd?.tribunal ||
    (rd?.state ? `TRT/${rd.state}` : null);

  return {
    tribunal,
    orgao_julgador: orgaoJulgador,
    classe_capa: classe,
    data_distribuicao_br: dataDistBR,
    relator,
    turma,
    situacao_processo: situacao,
    reclamante: ativos.map((x) => x?.name).filter(Boolean).join(" / ") || null,
    reclamada: passivos.map((x) => x?.name).filter(Boolean).join(" / ") || null,
  };
}