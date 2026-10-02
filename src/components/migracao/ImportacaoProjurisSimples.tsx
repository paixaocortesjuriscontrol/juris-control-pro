import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import { lerPlanilha, norm, digitos, formatarCnj, paraData, paraHora, type Planilha } from "@/lib/migracaoProjuris";

export type ModuloSimples = "processos" | "comentarios" | "andamentos";
type Campo = { campo: string; label: string; obrigatorio?: boolean; pistas: string[] };

const CAMPOS: Record<ModuloSimples, Campo[]> = {
  processos: [
    { campo: "processo", label: "Número do processo (CNJ)", obrigatorio: true, pistas: ["numero cnj", "cnj", "numero do processo", "processo"] },
    { campo: "id_externo", label: "Identificador do processo (Projuris)", pistas: ["identificador do processo", "id processo", "identificador", "codigo"] },
    { campo: "pasta", label: "Pasta", pistas: ["pasta", "numero da pasta"] },
    { campo: "autor", label: "Polo ativo / autor", pistas: ["polo ativo", "autor", "reclamante", "requerente", "cliente"] },
    { campo: "reu", label: "Polo passivo / réu", pistas: ["polo passivo", "reu", "reclamado", "requerido", "parte contraria", "adverso"] },
    { campo: "vara", label: "Vara / órgão", pistas: ["vara", "orgao julgador", "orgao", "juizo"] },
    { campo: "comarca", label: "Comarca", pistas: ["comarca", "cidade", "foro"] },
    { campo: "uf", label: "UF", pistas: ["uf", "estado"] },
    { campo: "tribunal", label: "Tribunal", pistas: ["tribunal"] },
    { campo: "classe", label: "Classe / ação", pistas: ["classe", "tipo de acao", "acao", "rito"] },
    { campo: "assunto", label: "Assunto / objeto", pistas: ["assunto", "objeto"] },
    { campo: "fase", label: "Fase", pistas: ["fase", "instancia"] },
    { campo: "valor", label: "Valor da causa", pistas: ["valor da causa", "valor"] },
    { campo: "distribuicao", label: "Data de distribuição", pistas: ["data de distribuicao", "distribuicao", "data de cadastro"] },
    { campo: "responsavel", label: "Responsável", pistas: ["responsavel", "advogado"] },
    { campo: "observacoes", label: "Observações", pistas: ["observacao", "observacoes", "detalhes"] },
  ],
  comentarios: [
    { campo: "id_tarefa", label: "Identificador da tarefa (Projuris)", obrigatorio: true, pistas: ["identificador da tarefa", "id tarefa", "tarefa"] },
    { campo: "texto", label: "Comentário / texto", obrigatorio: true, pistas: ["comentario", "texto", "descricao", "mensagem", "historico", "observacao"] },
    { campo: "autor", label: "Autor", pistas: ["autor", "usuario", "responsavel", "criado por"] },
    { campo: "data", label: "Data", pistas: ["data do comentario", "data de cadastro", "data", "criado em"] },
    { campo: "hora", label: "Hora", pistas: ["hora"] },
  ],
  andamentos: [
    { campo: "processo", label: "Número do processo (CNJ)", obrigatorio: true, pistas: ["numero cnj", "cnj", "numero do processo", "processo"] },
    { campo: "data", label: "Data do andamento", obrigatorio: true, pistas: ["data do andamento", "data da movimentacao", "data"] },
    { campo: "texto", label: "Descrição", obrigatorio: true, pistas: ["descricao", "andamento", "movimentacao", "texto", "conteudo"] },
    { campo: "tipo", label: "Tipo", pistas: ["tipo"] },
  ],
};

const INFO: Record<ModuloSimples, { titulo: string; desc: string; tipoItem: string }> = {
  processos: { titulo: "Processos", tipoItem: "processo", desc: "Cadastra os processos do Projuris. Não duplica (número comparado em todas as coordenações); processos de outras coordenações recebem esta coordenação como responsável." },
  comentarios: { titulo: "Comentários", tipoItem: "comentario", desc: "Liga cada comentário à tarefa já migrada pelo identificador do Projuris. Autor não reconhecido: fica com você e o nome original vai no texto." },
  andamentos: { titulo: "Andamentos", tipoItem: "andamento", desc: "Liga cada andamento ao processo pelo número, sem repetir o mesmo processo + data + descrição." },
};

const LOTE = 200;
const ceder = () => new Promise((r) => setTimeout(r, 0));

function mapear(campos: Campo[], headers: string[]) {
  const usados = new Set<string>(); const m: Record<string, string> = {};
  for (const c of campos) for (const p of c.pistas) {
    const h = headers.find((x) => !usados.has(x) && norm(x) === p) ?? headers.find((x) => !usados.has(x) && norm(x).includes(p));
    if (h) { m[c.campo] = h; usados.add(h); break; }
  }
  return m;
}

interface Props {
  modulo: ModuloSimples; coordId: string; nomeCoord: string; userId: string;
  usuarios: { id: string; nome: string }[]; onConcluido: () => void;
}

export function ImportacaoProjurisSimples({ modulo, coordId, nomeCoord, userId, usuarios, onConcluido }: Props) {
  const campos = CAMPOS[modulo]; const info = INFO[modulo];
  const [planilhas, setPlanilhas] = useState<Planilha[]>([]);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [lendo, setLendo] = useState<string | null>(null);
  const [mapa, setMapa] = useState<Record<string, string>>({});
  const [conf, setConf] = useState<null | { linhas: any[]; resumo: [string, number][] }>(null);
  const [msg, setMsg] = useState("");
  const [prog, setProg] = useState({ feito: 0, total: 0 });
  const [rodando, setRodando] = useState(false);
  const [semTarefa, setSemTarefa] = useState(false);

  const usadas = planilhas.filter((_, i) => sel.has(i));
  const headers = useMemo(() => Array.from(new Set(usadas.flatMap((p) => p.headers))), [usadas]);

  const enviar = async (files: FileList | null) => {
    if (!files) return;
    for (const f of Array.from(files)) {
      setLendo(f.name);
      try {
        const ps = await lerPlanilha(f);
        setPlanilhas((old) => {
          const base = old.length;
          setSel((s) => { const n = new Set(s); ps.forEach((p, j) => { const m = mapear(campos, p.headers); if (campos.filter((c) => c.obrigatorio).every((c) => m[c.campo])) n.add(base + j); }); return n; });
          return [...old, ...ps];
        });
      } catch (e: any) { toast.error(`${f.name}: ${e?.message || e}`); }
    }
    setLendo(null);
  };

  const irConferir = () => { setMapa(mapear(campos, headers)); setConf(null); };

  const nomeUser = (n: string) => {
    const k = norm(n); if (!k) return null;
    const ex = usuarios.find((u) => norm(u.nome) === k); if (ex) return ex.id;
    const t = k.split(" "); const p = usuarios.filter((u) => { const ut = norm(u.nome).split(" "); return ut[0] === t[0] && ut.includes(t[t.length - 1]); });
    return p.length === 1 ? p[0].id : null;
  };

  const buscarProcessos = async (digs: string[]) => {
    const out = new Map<string, string>();
    for (let k = 0; k < digs.length; k += 100) {
      const parte = digs.slice(k, k + 100);
      const { data, error } = await supabase.from("processos").select("id, numero").in("numero", [...parte, ...parte.map(formatarCnj)]);
      if (error) throw error;
      (data || []).forEach((p: any) => out.set(digitos(p.numero), p.id));
      setMsg(`Procurando processos: ${Math.min(k + 100, digs.length)} de ${digs.length}`);
    }
    return out;
  };

  const analisar = async () => {
    const falta = campos.filter((c) => c.obrigatorio && !mapa[c.campo]);
    if (falta.length) return toast.error(`Indique a coluna: ${falta.map((c) => c.label).join(", ")}`);
    setRodando(true); setMsg("Lendo linhas...");
    try {
      const g = (r: any, c: string) => (mapa[c] ? r[mapa[c]] : "");
      const linhas: any[] = [];
      for (const p of usadas) for (const r of p.linhas) {
        const o: any = {}; campos.forEach((c) => (o[c.campo] = String(g(r, c.campo) ?? "").trim()));
        if (modulo !== "comentarios") o.dig = digitos(o.processo);
        if (modulo === "andamentos" || modulo === "comentarios") o.dataIso = paraData(g(r, "data"));
        if (modulo === "processos") o.distIso = paraData(g(r, "distribuicao"));
        o.motivo = null; linhas.push(o);
      }
      await ceder();
      if (modulo === "processos") {
        const vistos = new Set<string>();
        linhas.forEach((l) => { if (l.dig.length !== 20) l.motivo = "Número CNJ inválido"; else if (vistos.has(l.dig)) l.motivo = "Repetido na planilha"; vistos.add(l.dig); });
        const ach = await buscarProcessos(Array.from(vistos));
        linhas.forEach((l) => { if (!l.motivo && ach.has(l.dig)) { l.existenteId = ach.get(l.dig); } });
      } else if (modulo === "andamentos") {
        const digs = Array.from(new Set(linhas.map((l) => l.dig).filter((d) => d.length === 20)));
        const ach = await buscarProcessos(digs);
        const ids = Array.from(new Set(ach.values()));
        const exist = new Set<string>();
        for (let k = 0; k < ids.length; k += 50) {
          for (let from = 0; ; from += 1000) {
            const { data } = await supabase.from("movimentacoes").select("processo_id, data_movimentacao, descricao").in("processo_id", ids.slice(k, k + 50)).range(from, from + 999);
            (data || []).forEach((m: any) => exist.add(`${m.processo_id}|${String(m.data_movimentacao).slice(0, 10)}|${norm(m.descricao)}`));
            if (!data || data.length < 1000) break;
          }
          setMsg(`Verificando andamentos existentes: ${Math.min(k + 50, ids.length)} de ${ids.length} processos`);
        }
        linhas.forEach((l) => {
          l.processoId = ach.get(l.dig) || null;
          const chave = `${l.processoId}|${l.dataIso}|${norm(l.texto)}`;
          if (l.dig.length !== 20) l.motivo = "Número CNJ inválido";
          else if (!l.processoId) l.motivo = "Processo não cadastrado (importe na aba Processos)";
          else if (!l.dataIso) l.motivo = "Data inválida";
          else if (!l.texto) l.motivo = "Sem descrição";
          else if (exist.has(chave)) l.motivo = "Andamento já existe";
          exist.add(chave);
        });
      } else {
        const ids = Array.from(new Set(linhas.map((l) => l.id_tarefa).filter(Boolean)));
        const mapT = new Map<string, string>();
        for (let k = 0; k < ids.length; k += 200) {
          const { data } = await supabase.from("migracoes_projuris_itens" as any).select("chave_externa, registro_id").eq("tipo", "tarefa").eq("status", "criado").in("chave_externa", ids.slice(k, k + 200));
          ((data as any[]) || []).forEach((d) => d.registro_id && mapT.set(d.chave_externa, d.registro_id));
          setMsg(`Procurando tarefas migradas: ${Math.min(k + 200, ids.length)} de ${ids.length}`);
        }
        const vistos = new Set<string>();
        linhas.forEach((l) => {
          l.tarefaId = mapT.get(l.id_tarefa) || null; l.autorId = nomeUser(l.autor);
          const ch = `${l.id_tarefa}|${l.dataIso}|${norm(l.texto)}`;
          if (!l.texto) l.motivo = "Sem texto";
          else if (!l.tarefaId) l.motivo = "Tarefa não migrada (importe na aba Tarefas)";
          else if (vistos.has(ch)) l.motivo = "Repetido na planilha";
          vistos.add(ch);
        });
      }
      const resumo = new Map<string, number>();
      linhas.forEach((l) => { const k = l.motivo || (l.existenteId ? "Já cadastrado (só vincula a coordenação)" : "Será importado"); resumo.set(k, (resumo.get(k) || 0) + 1); });
      setConf({ linhas, resumo: Array.from(resumo.entries()).sort((a, b) => b[1] - a[1]) });
    } catch (e: any) { toast.error(e?.message || String(e)); }
    setRodando(false); setMsg("");
  };

  const importar = async () => {
    if (!conf) return;
    setRodando(true);
    const { data: mig, error } = await supabase.from("migracoes_projuris" as any).insert({
      coordenacao_id: coordId, nome: `Projuris ${info.titulo} ${nomeCoord} ${new Date().toLocaleString("pt-BR")}`, mapeamento: { modulo, mapa }, criado_por: userId,
    }).select("id").single();
    if (error || !mig) { toast.error(error?.message || "Falha ao abrir migração"); setRodando(false); return; }
    const mid = (mig as any).id;
    const log = async (it: any[]) => { for (let k = 0; k < it.length; k += 500) await supabase.from("migracoes_projuris_itens" as any).insert(it.slice(k, k + 500).map((x) => ({ migracao_id: mid, ...x }))); };
    const tipo = info.tipoItem;
    const pular = conf.linhas.filter((l) => l.motivo && !(modulo === "comentarios" && semTarefa && l.motivo.startsWith("Tarefa não")));
    await log(pular.map((l) => ({ tipo, chave_externa: l.dig || l.id_tarefa || null, status: "pulado", motivo: l.motivo, dados: { titulo: (l.texto || l.autor || "").slice(0, 200) } })));
    const ok = conf.linhas.filter((l) => !l.motivo);
    const cont: Record<string, number> = { criados: 0, vinculados: 0, pulados: pular.length, erros: 0 };
    setProg({ feito: 0, total: ok.length });
    try {
      if (modulo === "processos") {
        const exist = ok.filter((l) => l.existenteId);
        for (let k = 0; k < exist.length; k += LOTE) {
          await supabase.from("processos_coordenacoes_responsaveis").upsert(exist.slice(k, k + LOTE).map((l) => ({ processo_id: l.existenteId, coordenacao_id: coordId })) as any, { onConflict: "processo_id,coordenacao_id", ignoreDuplicates: true });
        }
        await log(exist.map((l) => ({ tipo, chave_externa: l.dig, registro_id: l.existenteId, status: "existente", motivo: "Já cadastrado; coordenação vinculada" })));
        cont.vinculados = exist.length;
        const novos = ok.filter((l) => !l.existenteId);
        for (let k = 0; k < novos.length; k += LOTE) {
          const parte = novos.slice(k, k + LOTE);
          const valor = (v: string) => { const n = Number(String(v).replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3})/g, "").replace(",", ".")); return isFinite(n) && v ? n : null; };
          const { data, error: e } = await supabase.from("processos").insert(parte.map((l) => ({
            numero: formatarCnj(l.dig), area: "civil", status: "ativo", coordenacao_id: coordId,
            identificador_projuris: l.id_externo || null, pasta_cliente: l.pasta || null,
            polo_ativo: l.autor || null, polo_passivo: l.reu || null, vara: l.vara || null, comarca: l.comarca || null,
            uf: l.uf || null, tribunal: l.tribunal || null, classe: l.classe || null, assunto: l.assunto || null, fase: l.fase || null,
            valor_causa: valor(l.valor), data_distribuicao: l.distIso, responsaveis_projuris: l.responsavel || null, observacoes_processo: l.observacoes || null,
          }) as any)).select("id, numero");
          if (e) { cont.erros += parte.length; await log(parte.map((l) => ({ tipo, chave_externa: l.dig, status: "erro", motivo: e.message }))); }
          await log(((data as any[]) || []).map((p) => ({ tipo, chave_externa: digitos(p.numero), registro_id: p.id, status: "criado" })));
          cont.criados += (data as any[])?.length || 0;
          setProg({ feito: exist.length + k + parte.length, total: ok.length });
        }
      } else if (modulo === "andamentos") {
        for (let k = 0; k < ok.length; k += LOTE) {
          const parte = ok.slice(k, k + LOTE);
          const { data, error: e } = await supabase.from("movimentacoes").insert(parte.map((l) => ({
            processo_id: l.processoId, data_movimentacao: l.dataIso, descricao: l.texto, tipo: l.tipo || null, fonte: "projuris",
          }) as any)).select("id");
          if (e) { cont.erros += parte.length; await log(parte.map((l) => ({ tipo, chave_externa: l.dig, status: "erro", motivo: e.message }))); }
          await log(((data as any[]) || []).map((d, j) => ({ tipo, chave_externa: parte[j]?.dig, registro_id: d.id, status: "criado", dados: { data: parte[j]?.dataIso, titulo: parte[j]?.texto?.slice(0, 200) } })));
          cont.criados += (data as any[])?.length || 0;
          setProg({ feito: k + parte.length, total: ok.length });
        }
      } else {
        for (let k = 0; k < ok.length; k += LOTE) {
          const parte = ok.slice(k, k + LOTE);
          const { data, error: e } = await supabase.from("comentarios_tarefas").insert(parte.map((l) => {
            const hora = paraHora(l.hora) || "12:00";
            return {
              tarefa_id: l.tarefaId, autor_id: l.autorId || userId,
              conteudo: !l.autorId && l.autor ? `[Projuris – ${l.autor}] ${l.texto}` : l.texto,
              ...(l.dataIso ? { created_at: `${l.dataIso}T${hora}:00-03:00` } : {}),
            };
          }) as any).select("id");
          if (e) { cont.erros += parte.length; await log(parte.map((l) => ({ tipo, chave_externa: l.id_tarefa, status: "erro", motivo: e.message }))); }
          await log(((data as any[]) || []).map((d, j) => ({ tipo, chave_externa: parte[j]?.id_tarefa, registro_id: d.id, status: "criado", dados: { data: parte[j]?.dataIso, titulo: parte[j]?.texto?.slice(0, 200) } })));
          cont.criados += (data as any[])?.length || 0;
          setProg({ feito: k + parte.length, total: ok.length });
        }
      }
      await supabase.from("migracoes_projuris" as any).update({ status: "concluida", contadores: cont }).eq("id", mid);
      toast.success(`${info.titulo}: ${cont.criados} importados${cont.vinculados ? `, ${cont.vinculados} já existentes vinculados` : ""}, ${cont.pulados} pulados`);
      setConf(null); setPlanilhas([]); setSel(new Set()); onConcluido();
    } catch (e: any) {
      await supabase.from("migracoes_projuris" as any).update({ status: "erro", contadores: cont }).eq("id", mid);
      toast.error(e?.message || String(e));
    }
    setRodando(false);
  };

  const pct = prog.total ? Math.round((prog.feito / prog.total) * 100) : 0;
  const aImportar = conf ? conf.linhas.filter((l) => !l.motivo).length : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{info.titulo}</CardTitle>
        <CardDescription>{info.desc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed p-6 text-sm text-muted-foreground hover:bg-muted/40">
          <Upload className="h-6 w-6" /> Clique para enviar as planilhas de {info.titulo.toLowerCase()} (.xlsx, .xls, .csv)
          <input type="file" multiple accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { void enviar(e.target.files); e.target.value = ""; }} />
        </label>
        {lendo && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Lendo {lendo}...</p>}
        {planilhas.length > 0 && (
          <div>
            <div className="mb-1 flex items-center gap-2">
              <h4 className="text-sm font-semibold">Planilhas ({sel.size} de {planilhas.length} marcadas)</h4>
              <Button size="sm" variant="outline" className="ml-auto h-6 px-2 text-xs" onClick={() => setSel(new Set(planilhas.map((_, i) => i)))}>Marcar todas</Button>
              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setSel(new Set())}>Limpar</Button>
            </div>
            <p className="mb-1 text-xs text-muted-foreground">Vêm marcadas as que têm as colunas obrigatórias desta aba.</p>
            <div className="max-h-64 overflow-auto">
              {planilhas.map((p, i) => (
                <div key={i} className="flex items-center gap-2 border-b py-1 text-sm">
                  <Checkbox checked={sel.has(i)} onCheckedChange={() => setSel((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; })} />
                  <FileSpreadsheet className="h-4 w-4 text-primary" /><span className="truncate">{p.arquivo} · {p.aba}</span>
                  <Badge variant="secondary" className="ml-auto">{p.linhas.length} linhas</Badge>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setPlanilhas((ps) => ps.filter((_, j) => j !== i)); setSel(new Set()); }}><X className="h-3 w-3" /></Button>
                </div>
              ))}
            </div>
            <Button className="mt-2" disabled={!usadas.length} onClick={irConferir}>Conferir colunas</Button>
          </div>
        )}
        {Object.keys(mapa).length > 0 || (usadas.length > 0 && headers.length && false) ? null : null}
        {usadas.length > 0 && Object.keys(mapa).length > 0 && (
          <div className="space-y-2 rounded-md border p-3">
            <h4 className="text-sm font-semibold">Colunas</h4>
            <div className="grid gap-2 md:grid-cols-2">
              {campos.map((c) => (
                <div key={c.campo} className="grid gap-1">
                  <Label className="text-xs">{c.label}{c.obrigatorio && " *"}</Label>
                  <Select value={mapa[c.campo] || "__nada"} onValueChange={(v) => setMapa((m) => ({ ...m, [c.campo]: v === "__nada" ? "" : v }))}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__nada">— não usar —</SelectItem>
                      {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Button disabled={rodando} onClick={analisar}>{rodando && !conf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Analisar (nada é gravado)</Button>
              {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
            </div>
          </div>
        )}
        {conf && (
          <div className="space-y-2 rounded-md border p-3">
            <h4 className="text-sm font-semibold">Conferência</h4>
            {conf.resumo.map(([k, n]) => <div key={k} className="flex justify-between text-sm"><span>{k}</span><Badge variant="secondary">{n.toLocaleString("pt-BR")}</Badge></div>)}
            {modulo === "comentarios" && (
              <p className="text-xs text-muted-foreground">Comentários de tarefas não migradas são pulados e aparecem no relatório.</p>
            )}
            {rodando && prog.total > 0 && <div className="space-y-1"><Progress value={pct} /><p className="text-xs text-muted-foreground">{prog.feito} de {prog.total}</p></div>}
            <Button disabled={rodando || (!aImportar)} onClick={importar}>
              {rodando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Importar {aImportar.toLocaleString("pt-BR")} {info.titulo.toLowerCase()}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function exportarLinhasXlsx() { return XLSX; }
