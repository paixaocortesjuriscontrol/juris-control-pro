import { useRef, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Upload, Loader2, Download, Tag as TagIcon, Plus, Check } from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { iniciarAuditoriaLote, finalizarAuditoriaLote } from "@/lib/auditoriaLoteAdminTst";
import {
  useProcessoTagsCatalogo,
  useCriarTag,
  fetchDadoIdsByTag,
  TAG_COLOR_PALETTE,
} from "@/hooks/useProcessoTags";
import { ColorPalettePicker } from "@/components/distribuicao-tst/ColorPalettePicker";

type MatchMode = "exact" | "broad";

interface LinhaPlanilha {
  dossie: string;
  processo: string;
  processoDigitos: string;
}

interface CandidateRow {
  id: string;
  dossie: string | null;
  processo: string | null;
  updated_at?: string | null;
}

const stripAspa = (v: unknown) => String(v ?? "").trim().replace(/^'/, "").trim();
const soDigitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");

const SEARCH_CHUNK = 400;
const APPLY_CHUNK = 200;

const buildItemKey = (item: LinhaPlanilha) => {
  const d = item.dossie.trim().toLowerCase();
  const p = item.processo.trim().toLowerCase();
  if (d && p) return `pair:${d}||${p}`;
  if (d) return `d:${d}`;
  if (p) return `p:${p}`;
  return "";
};

const buildRowKeys = (row: CandidateRow) => {
  const d = String(row.dossie || "").trim().toLowerCase();
  const p = String(row.processo || "").trim().toLowerCase();
  const keys: string[] = [];
  if (d && p) keys.push(`pair:${d}||${p}`);
  if (d) keys.push(`d:${d}`);
  if (p) keys.push(`p:${p}`);
  return keys;
};

function findHeaderRow(rows: any[][]): { idx: number; colDossie: number; colProcesso: number } | null {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const r = rows[i] || [];
    let cd = -1;
    let cp = -1;
    for (let j = 0; j < r.length; j++) {
      const cell = String(r[j] ?? "").trim().toLowerCase();
      if (cd === -1 && /^dossi[eê]$/.test(cell)) cd = j;
      if (cp === -1 && cell === "processo") cp = j;
    }
    if (cd !== -1 && cp !== -1) return { idx: i, colDossie: cd, colProcesso: cp };
  }
  return null;
}

export default function AdminTstBasePcaDistribuicoes() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [applying, setApplying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");

  const [linhas, setLinhas] = useState<LinhaPlanilha[]>([]);
  const [foundIds, setFoundIds] = useState<string[]>([]);
  const [notFound, setNotFound] = useState<LinhaPlanilha[]>([]);
  const [fileName, setFileName] = useState<string>("");

  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [novoNome, setNovoNome] = useState("");
  const [novaCor, setNovaCor] = useState<string>(TAG_COLOR_PALETTE[10]);
  const [matchMode, setMatchMode] = useState<MatchMode>("exact");

  const { data: catalogo = [], isLoading: loadingTags } = useProcessoTagsCatalogo();
  const criar = useCriarTag();

  const handleFile = async (file: File) => {
    setLoadingSearch(true);
    setFoundIds([]);
    setNotFound([]);
    setLinhas([]);
    setFileName(file.name);
    setProgress(0);
    setProgressLabel("Lendo planilha...");

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(buf), { type: "array", cellDates: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "", raw: false });

      const header = findHeaderRow(rows);
      if (!header) {
        toast.error("Não foi possível localizar as colunas 'Dossiê' e 'Processo' na planilha.");
        setLoadingSearch(false);
        return;
      }

      const items: LinhaPlanilha[] = [];
      const seen = new Set<string>();
      for (let i = header.idx + 1; i < rows.length; i++) {
        const r = rows[i] || [];
        const dossie = stripAspa(r[header.colDossie]);
        const processo = stripAspa(r[header.colProcesso]);
        if (!dossie && !processo) continue;
        const key = `${dossie}||${processo}`;
        if (seen.has(key)) continue;
        seen.add(key);
        items.push({ dossie, processo, processoDigitos: soDigitos(processo) });
      }

      setLinhas(items);

      if (items.length === 0) {
        toast.warning("Nenhuma linha válida encontrada na planilha.");
        setLoadingSearch(false);
        return;
      }

      // Search in batches. No modo seguro, quando a planilha tem Dossiê + Processo,
      // o match precisa ser do PAR exato; usar Dossiê OU Processo pode inflar a TAG
      // em bases com dossiês/processos reaproveitados. O modo amplo reproduz o
      // comportamento anterior para auditoria/correção manual.
      const foundSet = new Set<string>();
      const matchedItemKeys = new Set<string>();
      const desiredKeys = new Set(items.map(buildItemKey).filter(Boolean));
      const desiredDossieKeys = new Set(items.map((i) => i.dossie.trim().toLowerCase()).filter(Boolean));
      const desiredProcessoKeys = new Set(items.map((i) => i.processo.trim().toLowerCase()).filter(Boolean));
      const bestByKey = new Map<string, CandidateRow>();

      const dossies = Array.from(new Set(items.map((i) => i.dossie).filter(Boolean)));
      const processos = Array.from(new Set(items.map((i) => i.processo).filter(Boolean)));

      const totalBatches =
        Math.ceil(dossies.length / SEARCH_CHUNK) + Math.ceil(processos.length / SEARCH_CHUNK);
      let done = 0;

      for (let i = 0; i < dossies.length; i += SEARCH_CHUNK) {
        const slice = dossies.slice(i, i + SEARCH_CHUNK);
        const { data, error } = await supabase
          .from("dados_benner")
          .select("id, dossie, processo, updated_at")
          .not("aba_origem", "is", null)
          .in("dossie", slice);
        if (error) throw error;
        for (const row of ((data ?? []) as CandidateRow[])) {
          if (matchMode === "broad") {
            const d = String(row.dossie || "").trim().toLowerCase();
            if (!d || !desiredDossieKeys.has(d)) continue;
            foundSet.add(row.id);
            matchedItemKeys.add(`d:${d}`);
          } else {
            for (const key of buildRowKeys(row)) {
              if (!desiredKeys.has(key)) continue;
              const current = bestByKey.get(key);
              if (!current || String(row.updated_at || "") > String(current.updated_at || "")) {
                bestByKey.set(key, row);
              }
            }
          }
        }
        done++;
        setProgress(Math.round((done / totalBatches) * 100));
        setProgressLabel(
          `Buscando lote ${done}/${totalBatches} — encontrados: ${matchMode === "broad" ? foundSet.size : bestByKey.size}`,
        );
      }

      for (let i = 0; i < processos.length; i += SEARCH_CHUNK) {
        const slice = processos.slice(i, i + SEARCH_CHUNK);
        const { data, error } = await supabase
          .from("dados_benner")
          .select("id, dossie, processo, updated_at")
          .not("aba_origem", "is", null)
          .in("processo", slice);
        if (error) throw error;
        for (const row of ((data ?? []) as CandidateRow[])) {
          if (matchMode === "broad") {
            const p = String(row.processo || "").trim().toLowerCase();
            if (!p || !desiredProcessoKeys.has(p)) continue;
            foundSet.add(row.id);
            matchedItemKeys.add(`p:${p}`);
          } else {
            for (const key of buildRowKeys(row)) {
              if (!desiredKeys.has(key)) continue;
              const current = bestByKey.get(key);
              if (!current || String(row.updated_at || "") > String(current.updated_at || "")) {
                bestByKey.set(key, row);
              }
            }
          }
        }
        done++;
        setProgress(Math.round((done / totalBatches) * 100));
        setProgressLabel(
          `Buscando lote ${done}/${totalBatches} — encontrados: ${matchMode === "broad" ? foundSet.size : bestByKey.size}`,
        );
      }

      if (matchMode === "exact") {
        for (const item of items) {
          const key = buildItemKey(item);
          if (!key) continue;
          const row = bestByKey.get(key);
          if (row?.id) {
            foundSet.add(row.id);
            matchedItemKeys.add(key);
          }
        }
      }

      const naoEncontrados = items.filter(
        (it) => {
          if (matchMode === "broad") {
            const d = it.dossie.trim().toLowerCase();
            const p = it.processo.trim().toLowerCase();
            return !(d && matchedItemKeys.has(`d:${d}`)) && !(p && matchedItemKeys.has(`p:${p}`));
          }
          return !matchedItemKeys.has(buildItemKey(it));
        },
      );

      setFoundIds(Array.from(foundSet));
      setNotFound(naoEncontrados);
      setProgress(100);
      setProgressLabel(
        `Concluído: ${foundSet.size} encontrado(s), ${naoEncontrados.length} não encontrado(s)`,
      );
      toast.success(`${foundSet.size} processo(s) localizados na base`);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao processar planilha: " + (err?.message || String(err)));
    } finally {
      setLoadingSearch(false);
    }
  };

  const exportarNaoEncontrados = () => {
    if (notFound.length === 0) return;
    const rows = [["Dossiê", "Processo"], ...notFound.map((n) => [n.dossie, n.processo])];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Nao_Encontrados");
    XLSX.writeFile(wb, `nao_encontrados_${Date.now()}.xlsx`);
  };

  const aplicarTag = async (tagId: string, replaceExisting = false) => {
    if (foundIds.length === 0) {
      toast.info("Nenhum processo encontrado para aplicar a TAG");
      return;
    }
    setApplying(true);
    setProgress(0);
    setProgressLabel("Aplicando TAG...");
    const tagNome = catalogo.find((t: any) => t.id === tagId)?.nome || tagId;
    const auditId = await iniciarAuditoriaLote({
      tipo: "base_pca_distribuicoes",
      arquivoNome: fileName || undefined,
      detalhes: {
        tag_id: tagId,
        tag_nome: tagNome,
        substituir_existentes: replaceExisting,
        modo_correspondencia: matchMode,
        linhas_planilha: linhas.length,
        nao_encontrados: notFound.length,
      },
    });
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (replaceExisting) {
        setProgressLabel("Limpando vínculos anteriores da TAG...");
        const currentIds = await fetchDadoIdsByTag(tagId);
        for (let i = 0; i < currentIds.length; i += APPLY_CHUNK) {
          const slice = currentIds.slice(i, i + APPLY_CHUNK);
          const { error: deleteError } = await supabase
            .from("dados_benner_processo_tags" as any)
            .delete()
            .eq("tag_id", tagId)
            .in("dado_benner_id", slice);
          if (deleteError) throw deleteError;
        }
      }
      const total = Math.ceil(foundIds.length / APPLY_CHUNK);
      for (let i = 0; i < foundIds.length; i += APPLY_CHUNK) {
        const slice = foundIds.slice(i, i + APPLY_CHUNK);
        const rows = slice.map((dado_benner_id) => ({
          dado_benner_id,
          tag_id: tagId,
          created_by: uid,
        }));
        const { error } = await supabase
          .from("dados_benner_processo_tags" as any)
          .upsert(rows as any, { onConflict: "dado_benner_id,tag_id", ignoreDuplicates: true });
        if (error) throw error;
        const lote = Math.floor(i / APPLY_CHUNK) + 1;
        setProgress(Math.round((lote / total) * 100));
        setProgressLabel(`Aplicando lote ${lote}/${total}`);
      }
      toast.success(
        replaceExisting
          ? `TAG substituída por ${foundIds.length} processo(s)`
          : `TAG aplicada a ${foundIds.length} processo(s)`,
      );
      setProgressLabel(
        replaceExisting
          ? `TAG substituída por ${foundIds.length} processo(s)`
          : `TAG aplicada a ${foundIds.length} processo(s)`,
      );
      await finalizarAuditoriaLote(auditId, {
        status: "concluida",
        totalLinhas: linhas.length,
        atualizados: foundIds.length,
        ignorados: notFound.length,
        resumo: `TAG "${tagNome}" ${replaceExisting ? "substituída por" : "aplicada a"} ${foundIds.length} processo(s)`,
        itens: [
          ...foundIds.map((id) => ({
            dadosBennerId: id,
            acao: "atualizado",
            detalhe: `TAG "${tagNome}" aplicada`,
          })),
          ...notFound.map((l) => ({
            processo: l.processo || null,
            dossie: l.dossie || null,
            acao: "ignorado",
            detalhe: "Não encontrado na base",
          })),
        ],
      });
    } catch (err: any) {
      toast.error("Erro ao aplicar TAG: " + (err?.message || ""));
      await finalizarAuditoriaLote(auditId, { status: "erro", erro: err?.message || String(err) });
    } finally {
      setApplying(false);
    }
  };

  const handleCriarEAplicar = async () => {
    const nome = novoNome.trim();
    if (!nome) return;
    try {
      const tag = await criar.mutateAsync({ nome, cor: novaCor });
      setNovoNome("");
      if (tag?.id) {
        setSelectedTagId(tag.id);
        await aplicarTag(tag.id);
      }
    } catch {
      /* toast handled in hook */
    }
  };

  const busy = loadingSearch || applying;

  return (
    <MainLayout
      title="Base PCA - TST - Distribuições"
      subtitle="Upload de planilha, busca por Dossiê/Processo na base e aplicação de TAG em lote."
    >
      <div className="p-4 lg:p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Upload da planilha</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  if (fileRef.current) fileRef.current.value = "";
                }}
              />
              <Button onClick={() => fileRef.current?.click()} disabled={busy}>
                {loadingSearch ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                Escolher planilha (.xlsx)
              </Button>
              {fileName && <span className="text-xs text-muted-foreground">{fileName}</span>}
            </div>

            <div className="flex flex-col gap-2 rounded border p-3 text-xs sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-semibold">Modo de busca</div>
                <div className="text-muted-foreground">
                  Par exato evita inflar TAGs; busca ampla reproduz a regra antiga por Dossiê OU Processo.
                </div>
              </div>
              <div className="flex rounded border p-1">
                <Button
                  type="button"
                  size="sm"
                  variant={matchMode === "exact" ? "default" : "ghost"}
                  className="h-7 text-xs"
                  disabled={busy}
                  onClick={() => setMatchMode("exact")}
                >
                  Par exato
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={matchMode === "broad" ? "default" : "ghost"}
                  className="h-7 text-xs"
                  disabled={busy}
                  onClick={() => setMatchMode("broad")}
                >
                  Dossiê OU Processo
                </Button>
              </div>
            </div>

            {(loadingSearch || applying || progress > 0) && (
              <div className="space-y-1">
                <Progress value={progress} />
                <p className="text-xs text-muted-foreground">{progressLabel}</p>
              </div>
            )}

            {linhas.length > 0 && !loadingSearch && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <Stat label="Total lido" value={linhas.length} />
                <Stat
                  label={matchMode === "exact" ? "Encontrados por par exato" : "Encontrados por busca ampla"}
                  value={foundIds.length}
                  tone="emerald"
                />
                <Stat label="Não encontrados" value={notFound.length} tone="rose" />
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportarNaoEncontrados}
                    disabled={notFound.length === 0}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Exportar não encontrados
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TagIcon className="w-4 h-4" /> 2. Selecionar TAG a aplicar aos{" "}
              {foundIds.length} encontrado(s)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="max-h-72 overflow-y-auto border rounded p-2 space-y-1">
              {loadingTags && <Loader2 className="w-4 h-4 animate-spin" />}
              {!loadingTags && catalogo.length === 0 && (
                <p className="text-xs text-muted-foreground py-2 px-1">
                  Nenhuma TAG criada ainda. Crie a primeira abaixo.
                </p>
              )}
              {catalogo.map((t) => {
                const active = selectedTagId === t.id;
                return (
                  <div
                    key={t.id}
                    className={`flex items-center gap-2 text-sm px-2 py-1.5 rounded hover:bg-muted/50 ${
                      active ? "bg-muted/60" : ""
                    }`}
                  >
                    <span
                      className="inline-block w-3 h-3 rounded-full border border-border flex-shrink-0"
                      style={{ backgroundColor: t.cor }}
                    />
                    <span className="flex-1 truncate">{t.nome}</span>
                    <Button
                      size="sm"
                      variant={active ? "default" : "outline"}
                      className="h-7 px-2 text-xs"
                      disabled={busy || foundIds.length === 0}
                      onClick={() => {
                        setSelectedTagId(t.id);
                        aplicarTag(t.id);
                      }}
                    >
                      {applying && selectedTagId === t.id ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <Check className="w-3 h-3 mr-1" />
                      )}
                      Aplicar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      disabled={busy || foundIds.length === 0}
                      onClick={() => {
                        const ok = window.confirm(
                          `Substituir esta TAG pelos ${foundIds.length} processos encontrados agora? Os vínculos anteriores desta TAG na Distribuição TST serão removidos.`,
                        );
                        if (!ok) return;
                        setSelectedTagId(t.id);
                        aplicarTag(t.id, true);
                      }}
                    >
                      Substituir
                    </Button>
                  </div>
                );
              })}
            </div>

            <div className="border-t pt-3 space-y-2">
              <div className="text-xs font-semibold">Criar nova TAG e aplicar</div>
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-4 h-4 rounded-full border border-border flex-shrink-0"
                  style={{ backgroundColor: novaCor }}
                />
                <Input
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  placeholder="Nome da nova TAG..."
                  className="h-8 text-sm"
                  disabled={busy}
                />
                <Button
                  size="sm"
                  onClick={handleCriarEAplicar}
                  disabled={!novoNome.trim() || busy || foundIds.length === 0 || criar.isPending}
                >
                  {criar.isPending ? (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  ) : (
                    <Plus className="w-3 h-3 mr-1" />
                  )}
                  Criar e aplicar
                </Button>
              </div>
              <ColorPalettePicker value={novaCor} onChange={setNovaCor} />
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "emerald" | "rose";
}) {
  const color =
    tone === "emerald"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "rose"
        ? "text-rose-600 dark:text-rose-400"
        : "text-foreground";
  return (
    <div className="border rounded p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}