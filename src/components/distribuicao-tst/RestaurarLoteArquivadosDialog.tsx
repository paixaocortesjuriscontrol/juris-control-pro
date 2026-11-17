import { useState } from "react";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProcessoTagsCatalogo, useCriarTag } from "@/hooks/useProcessoTags";

interface Props { open: boolean; onOpenChange: (v: boolean) => void; onDone: () => void }
type Arq = { id: string; processo: string | null; dossie: string | null; data?: string | null };
let cancelado = false;

const dig = (s: string) => s.replace(/\D/g, "");
const normDos = (s: string) => s.trim().replace(/^'+/, "").toUpperCase();

export function RestaurarLoteArquivadosDialog({ open, onOpenChange, onDone }: Props) {
  const { data: tags = [] } = useProcessoTagsCatalogo();
  const criarTag = useCriarTag();
  const [arquivo, setArquivo] = useState<string>("");
  const [encontrados, setEncontrados] = useState<Arq[]>([]);
  const [naoEncontrados, setNaoEncontrados] = useState<string[]>([]);
  const [analisando, setAnalisando] = useState(false);
  const [modoTag, setModoTag] = useState<"nenhuma" | "existente" | "nova">("nenhuma");
  const [tagId, setTagId] = useState("");
  const [novaTag, setNovaTag] = useState("");
  const [rodando, setRodando] = useState(false);
  const [prog, setProg] = useState(0);

  const [modo, setModo] = useState<"planilha" | "periodo">("planilha");
  const [de, setDe] = useState("2026-01-01");
  const [ate, setAte] = useState("2026-10-31");
  const [soDossie, setSoDossie] = useState(true);
  const [origem, setOrigem] = useState("pca");
  const [cancelar, setCancelar] = useState(false);

  const buscarPeriodo = async () => {
    setAnalisando(true); setArquivo(""); setNaoEncontrados([]);
    try {
      const { data, error } = await (supabase as any).rpc("listar_arquivados_tst_por_periodo", {
        _de: de || null, _ate: ate || null, _so_dossie: soDossie,
        _origem: origem === "pca" ? "%pca%" : null,
      });
      if (error) throw error;
      setEncontrados((data ?? []).map((r: any) => ({ id: r.id, processo: r.processo, dossie: r.dossie, data: r.data_distribuicao })));
      setArquivo("periodo");
    } catch (e: any) { toast.error("Erro ao buscar: " + (e?.message || e)); }
    finally { setAnalisando(false); }
  };

  const reset = () => { setArquivo(""); setEncontrados([]); setNaoEncontrados([]); setProg(0); setModoTag("nenhuma"); setTagId(""); setNovaTag(""); };

  const lerPlanilha = async (file: File) => {
    setAnalisando(true); setArquivo(file.name);
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const valores = new Set<string>();
      for (const n of wb.SheetNames) {
        const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[n], { header: 1, defval: "" });
        for (const r of rows) for (const c of r) { const v = String(c ?? "").trim(); if (v) valores.add(v); }
      }
      // Carrega todos os arquivados (paginado)
      const todos: Arq[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await (supabase as any).from("dados_benner_arquivados")
          .select("id, processo, dossie").range(from, from + 999);
        if (error) throw error;
        todos.push(...(data ?? []));
        if (!data || data.length < 1000) break;
      }
      const porProc = new Map<string, Arq[]>(), porDos = new Map<string, Arq[]>();
      for (const a of todos) {
        if (a.processo) { const k = dig(a.processo); if (k) porProc.set(k, [...(porProc.get(k) ?? []), a]); }
        if (a.dossie) { const k = normDos(a.dossie); porDos.set(k, [...(porDos.get(k) ?? []), a]); }
      }
      const achados = new Map<string, Arq>(); const faltam: string[] = [];
      for (const v of valores) {
        const d = dig(v);
        const hits = (d.length === 20 ? porProc.get(d) : undefined) ?? porDos.get(normDos(v));
        if (hits) hits.forEach((h) => achados.set(h.id, h));
        else if (d.length === 20 || /\d/.test(v)) faltam.push(v);
      }
      setEncontrados([...achados.values()]); setNaoEncontrados(faltam);
    } catch (e: any) { toast.error("Erro ao ler planilha: " + (e?.message || e)); }
    finally { setAnalisando(false); }
  };

  const executar = async () => {
    try {
      setRodando(true); setProg(0);
      let tid: string | null = null;
      if (modoTag === "existente") tid = tagId || null;
      if (modoTag === "nova") { if (!novaTag.trim()) throw new Error("Informe o nome da tag"); tid = (await criarTag.mutateAsync(novaTag)).id; }
      const { data: u } = await supabase.auth.getUser();
      let ok = 0; const erros: string[] = [];
      cancelado = false; setCancelar(false);
      for (let i = 0; i < encontrados.length; i += 4) {
        if (cancelado) { toast.info("Restauração cancelada."); break; }
        await Promise.all(encontrados.slice(i, i + 4).map(async (a) => {
          const { data: novoId, error } = await supabase.rpc("restaurar_dados_benner_arquivado" as any, { _id: a.id });
          if (error) { erros.push(`${a.processo ?? a.dossie}: ${error.message}`); return; }
          ok++;
          if (tid && novoId) {
            await (supabase as any).from("dados_benner_processo_tags")
              .upsert({ dado_benner_id: novoId, tag_id: tid, created_by: u.user?.id }, { onConflict: "dado_benner_id,tag_id", ignoreDuplicates: true });
          }
        }));
        setProg(Math.round(((i + 4) / encontrados.length) * 100));
      }
      if (erros.length) toast.error(`${erros.length} não restaurado(s). Primeiro erro: ${erros[0]}`);
      toast.success(`${ok} ficha(s) restaurada(s)${tid ? " e marcada(s) com a tag" : ""}.`);
      onDone(); reset(); onOpenChange(false);
    } catch (e: any) { toast.error(e?.message || String(e)); }
    finally { setRodando(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!rodando) { if (!v) reset(); onOpenChange(v); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Restaurar em lote</DialogTitle>
          <DialogDescription>Restaure por planilha de dossiês/processos ou por período de distribuição.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Select value={modo} onValueChange={(v: any) => { setModo(v); setEncontrados([]); setArquivo(""); setNaoEncontrados([]); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="planilha">Por planilha</SelectItem>
              <SelectItem value="periodo">Por período de distribuição</SelectItem>
            </SelectContent>
          </Select>
          {modo === "periodo" && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Distribuído de</Label><Input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></div>
                <div><Label>até</Label><Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2 items-end">
                <div>
                  <Label>Origem</Label>
                  <Select value={origem} onValueChange={setOrigem}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pca">Base PCA</SelectItem>
                      <SelectItem value="todas">Todas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-center gap-2 text-sm h-10">
                  <input type="checkbox" checked={soDossie} onChange={(e) => setSoDossie(e.target.checked)} /> Só com número de dossiê
                </label>
              </div>
              <Button variant="outline" className="w-full" disabled={analisando || rodando} onClick={buscarPeriodo}>
                {analisando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Ver quantos serão restaurados
              </Button>
              {arquivo === "periodo" && !analisando && (
                <div className="text-sm">
                  <p><strong>{encontrados.length}</strong> ficha(s) arquivada(s) no período.</p>
                  {encontrados.length > 0 && (
                    <div className="max-h-32 overflow-auto border border-border rounded mt-1 text-xs">
                      {encontrados.slice(0, 50).map((a) => (
                        <div key={a.id} className="px-2 py-0.5 flex justify-between gap-2">
                          <span className="font-mono">{a.processo ?? "—"}</span><span>{a.dossie ?? "—"}</span>
                          <span>{a.data ? a.data.split("-").reverse().join("/") : "sem data"}</span>
                        </div>
                      ))}
                      {encontrados.length > 50 && <div className="px-2 py-0.5 text-muted-foreground">… e mais {encontrados.length - 50}</div>}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {modo === "planilha" && <div>
            <Label>Planilha</Label>
            <Input type="file" accept=".xlsx,.xls,.csv" disabled={analisando || rodando}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) lerPlanilha(f); }} />
            {analisando && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Conferindo com os arquivados...</p>}
            {arquivo && arquivo !== "periodo" && !analisando && (
              <p className="text-sm mt-2">
                <strong>{encontrados.length}</strong> ficha(s) arquivada(s) encontrada(s)
                {naoEncontrados.length > 0 && <span className="text-muted-foreground"> · {naoEncontrados.length} valor(es) da planilha sem ficha arquivada</span>}
              </p>
            )}
          </div>}

          <div className="space-y-2">
            <Label>Tag</Label>
            <Select value={modoTag} onValueChange={(v: any) => setModoTag(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhuma">Restaurar sem tag</SelectItem>
                <SelectItem value="existente">Escolher tag existente</SelectItem>
                <SelectItem value="nova">Criar nova tag</SelectItem>
              </SelectContent>
            </Select>
            {modoTag === "existente" && (
              <Select value={tagId} onValueChange={setTagId}>
                <SelectTrigger><SelectValue placeholder="Selecione a tag" /></SelectTrigger>
                <SelectContent>
                  {tags.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <span className="inline-flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ backgroundColor: t.cor }} />{t.nome}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {modoTag === "nova" && <Input placeholder="Nome da nova tag" value={novaTag} onChange={(e) => setNovaTag(e.target.value)} />}
          </div>

          {rodando && <Progress value={Math.min(prog, 100)} className="h-2" />}
        </div>

        <DialogFooter>
          {rodando
            ? <Button variant="outline" disabled={cancelar} onClick={() => { cancelado = true; setCancelar(true); }}>Cancelar restauração</Button>
            : <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>}
          <Button disabled={rodando || analisando || encontrados.length === 0 || (modoTag === "existente" && !tagId) || (modoTag === "nova" && !novaTag.trim())} onClick={executar}>
            {rodando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            Restaurar {encontrados.length || ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
