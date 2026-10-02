import { useEffect, useMemo, useRef, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Upload, FileArchive, FileSpreadsheet, Loader2, CheckCircle2, AlertTriangle, Download, Undo2, Pause, Play, X } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { BlobReader, BlobWriter, ZipReader, type Entry } from "@zip.js/zip.js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { Navigate } from "react-router-dom";
import {
  CAMPOS, type CampoMapa, type Planilha, lerPlanilha, mapearAutomatico, norm, digitos, formatarCnj,
  paraData, paraHora, classificarTipo, mapearSituacao, sanitizarNome,
} from "@/lib/migracaoProjuris";
import { TIPOS_TAREFA } from "@/constants/tiposTarefa";

const COORD_PADRAO = "968631d0-6659-46f1-b45d-899892cb0121"; // Coordenação Santander Cível
const SEM = "__nenhuma__";
const LOTE = 200;

type ZipInfo = { file: File; entries: Entry[] };
type Linha = {
  idx: number; id_externo: string; processo_dig: string; titulo: string; tipo: string;
  data: string | null; data_fatal: string | null; hora: string | null; responsavelNome: string;
  responsavelId: string | null; status: string; observacoes: string;
  processoId: string | null; duplicada: boolean; erro: string | null;
};
type Anexo = { zip: number; entry: Entry; nome: string; chave: string | null; destino: "tarefa" | "processo" | null };

const etapas = ["Arquivos", "Colunas", "Conferência", "Importação", "Relatório"];

export default function MigracaoProjuris() {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [etapa, setEtapa] = useState(0);
  const [coordId, setCoordId] = useState(COORD_PADRAO);
  const [coords, setCoords] = useState<{ id: string; nome: string }[]>([]);
  const [planilhas, setPlanilhas] = useState<Planilha[]>([]);
  const [zips, setZips] = useState<ZipInfo[]>([]);
  const [lendo, setLendo] = useState<string | null>(null);
  const [mapa, setMapa] = useState<Partial<Record<CampoMapa, string>>>({});
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [membros, setMembros] = useState<{ id: string; nome: string }[]>([]);
  const [respManual, setRespManual] = useState<Record<string, string>>({});
  const [usuarioAssume, setUsuarioAssume] = useState<string>(SEM);
  const [criarProcessos, setCriarProcessos] = useState(true);
  const [preparando, setPreparando] = useState(false);
  const [analiseMsg, setAnaliseMsg] = useState("");
  const [progresso, setProgresso] = useState({ fase: "", feito: 0, total: 0 });
  const [rodando, setRodando] = useState(false);
  const pausado = useRef(false);
  const cancelado = useRef(false);
  const [pausa, setPausa] = useState(false);
  const [migracaoId, setMigracaoId] = useState<string | null>(null);
  const [historico, setHistorico] = useState<any[]>([]);

  const chaveP = (p: Planilha) => `${p.arquivo}|${p.aba}`;
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const usadas = useMemo(() => planilhas.filter((p) => selecionadas.has(chaveP(p))), [planilhas, selecionadas]);
  const headers = useMemo(() => Array.from(new Set(usadas.flatMap((p) => p.headers))), [usadas]);
  const adicionarPlanilhas = (ps: Planilha[]) => {
    setPlanilhas((p) => [...p, ...ps]);
    // Pré-seleciona como "tarefas" as planilhas cujo nome indica tarefas (ex.: tarefa.csv)
    const auto = ps.filter((p) => /tarefa/i.test(p.arquivo) && !/cache|kanban|terceiro/i.test(p.arquivo));
    if (auto.length) setSelecionadas((s) => { const n = new Set(s); auto.forEach((p) => n.add(chaveP(p))); return n; });
  };
  const alternar = (p: Planilha) => setSelecionadas((s) => { const n = new Set(s); const k = chaveP(p); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const carregarHistorico = async () => {
    const { data } = await supabase.from("migracoes_projuris" as any).select("*").order("created_at", { ascending: false }).limit(30);
    setHistorico((data as any[]) || []);
  };

  useEffect(() => {
    supabase.from("coordenacoes").select("id, nome").not("nome", "ilike", "INATIVA%").order("nome").then(({ data }) => setCoords((data as any) || []));
    carregarHistorico();
  }, []);

  useEffect(() => {
    (async () => {
      const { data: m } = await supabase.from("membros_coordenacao").select("usuario_id").eq("coordenacao_id", coordId);
      const ids = (m || []).map((x: any) => x.usuario_id);
      if (!ids.length) return setMembros([]);
      const { data: p } = await supabase.from("profiles").select("id, nome").in("id", ids);
      setMembros(((p as any[]) || []).sort((a, b) => String(a.nome).localeCompare(String(b.nome))));
    })();
  }, [coordId]);


  // ---------- Etapa 1: arquivos ----------
  const adicionarArquivos = async (files: FileList | null) => {
    if (!files) return;
    for (const f of Array.from(files)) {
      const nome = f.name.toLowerCase();
      try {
        setLendo(f.name);
        if (nome.endsWith(".zip")) {
          const reader = new ZipReader(new BlobReader(f));
          const todas = (await reader.getEntries()).filter((e) => !e.directory);
          const ehPlanilha = (e: Entry) => /\.(xlsx|xls|csv)$/i.test(e.filename) && !/(^|\/)(__MACOSX|\.)/.test(e.filename);
          // Planilhas dentro do zip são lidas como planilhas (não como anexos)
          const internas = todas.filter(ehPlanilha);
          for (const e of internas) {
            try {
              const blob: Blob = await (e as any).getData(new BlobWriter());
              const nomeInterno = e.filename.split("/").pop() || e.filename;
              const ps = await lerPlanilha(new File([blob], nomeInterno));
              adicionarPlanilhas(ps);
            } catch (err: any) {
              toast.error(`Erro ao ler ${e.filename}: ${err?.message || err}`);
            }
          }
          const entries = todas.filter((e) => !ehPlanilha(e));
          if (entries.length) setZips((z) => [...z, { file: f, entries }]);
          if (internas.length) toast.success(`${f.name}: ${internas.length} planilha(s) lida(s) de dentro do zip`);
        } else if (/\.(xlsx|xls|csv)$/.test(nome)) {
          const ps = await lerPlanilha(f);
          adicionarPlanilhas(ps);
        } else {
          toast.warning(`${f.name}: formato não suportado`);
        }
      } catch (e: any) {
        toast.error(`Erro ao ler ${f.name}: ${e?.message || e}`);
      } finally {
        setLendo(null);
      }
    }
  };

  const irParaColunas = () => {
    setMapa(mapearAutomatico(headers));
    setEtapa(1);
  };

  // ---------- Etapa 3: conferência ----------
  const casarResponsavel = (nome: string): string | null => {
    const n = norm(nome);
    if (n) {
      if (respManual[n]) return respManual[n] === SEM ? null : respManual[n];
      const exato = membros.find((m) => norm(m.nome) === n);
      if (exato) return exato.id;
      const tok = n.split(" ");
      const parcial = membros.filter((m) => {
        const mt = norm(m.nome).split(" ");
        return mt[0] === tok[0] && (tok.length === 1 || mt.includes(tok[tok.length - 1]));
      });
      if (parcial.length === 1) return parcial[0].id;
    }
    // Sem responsável na planilha ou não reconhecido: assume o usuário escolhido
    return usuarioAssume !== SEM ? usuarioAssume : null;
  };

  const preparar = async () => {
    const faltando = CAMPOS.filter((c) => c.obrigatorio && !mapa[c.campo]);
    if (faltando.length) return toast.error(`Mapeie: ${faltando.map((c) => c.label).join(", ")}`);
    setPreparando(true);
    const ceder = () => new Promise((r) => setTimeout(r, 0));
    // Executa consultas em paralelo limitado (4 de cada vez)
    const emLotes = async <T,>(itens: T[], tam: number, fase: string, fn: (parte: T[]) => Promise<void>) => {
      const partes: T[][] = [];
      for (let k = 0; k < itens.length; k += tam) partes.push(itens.slice(k, k + tam));
      let feitos = 0;
      for (let k = 0; k < partes.length; k += 4) {
        await Promise.all(partes.slice(k, k + 4).map(fn));
        feitos += Math.min(4, partes.length - k);
        setAnaliseMsg(`${fase}: ${feitos} de ${partes.length} lotes`);
      }
    };
    try {
      const get = (r: any, c: CampoMapa) => (mapa[c] ? r[mapa[c]!] : "");
      const cacheResp = new Map<string, string | null>();
      const resp = (n: string) => { if (!cacheResp.has(n)) cacheResp.set(n, casarResponsavel(n)); return cacheResp.get(n)!; };
      const brutas: Linha[] = [];
      const total = usadas.reduce((s, p) => s + p.linhas.length, 0);
      let i = 0;
      for (const p of usadas) for (const r of p.linhas) {
        const id = String(get(r, "id_externo") ?? "").trim();
        const titulo = String(get(r, "titulo") ?? "").trim();
        const data = paraData(get(r, "data_vencimento"));
        const respNome = String(get(r, "responsavel") ?? "").trim();
        brutas.push({
          idx: i++, id_externo: id, processo_dig: digitos(get(r, "processo")), titulo,
          tipo: classificarTipo(titulo, String(get(r, "tipo") ?? "")),
          data, data_fatal: paraData(get(r, "data_fatal")), hora: paraHora(get(r, "hora")),
          responsavelNome: respNome, responsavelId: resp(respNome),
          status: mapearSituacao(get(r, "situacao"), data),
          observacoes: String(get(r, "observacoes") ?? "").trim(),
          processoId: null, duplicada: false,
          erro: !id ? "Sem identificador" : !titulo ? "Sem título" : !data ? "Data inválida" : null,
        });
        if (i % 3000 === 0) { setAnaliseMsg(`Lendo linhas: ${i} de ${total}`); await ceder(); }
      }
      // repetidas na própria planilha
      const vistos = new Set<string>();
      for (const l of brutas) {
        if (!l.id_externo) continue;
        if (vistos.has(l.id_externo)) l.duplicada = true;
        vistos.add(l.id_externo);
      }
      // já migradas antes
      const ids = Array.from(vistos);
      const ja = new Set<string>();
      await emLotes(ids, 200, "Verificando tarefas já migradas", async (parte) => {
        const { data, error } = await supabase.from("migracoes_projuris_itens" as any).select("chave_externa")
          .eq("tipo", "tarefa").eq("status", "criado").in("chave_externa", parte);
        if (error) throw error;
        ((data as any[]) || []).forEach((x) => ja.add(x.chave_externa));
      });
      brutas.forEach((l) => { if (ja.has(l.id_externo)) l.duplicada = true; });
      // processos existentes (qualquer coordenação)
      const procs = Array.from(new Set(brutas.map((l) => l.processo_dig).filter((d) => d.length === 20)));
      const achados = new Map<string, string>();
      await emLotes(procs, 100, "Procurando processos cadastrados", async (parte) => {
        const { data, error } = await supabase.from("processos").select("id, numero").in("numero", [...parte, ...parte.map(formatarCnj)]);
        if (error) throw error;
        ((data as any[]) || []).forEach((p) => achados.set(digitos(p.numero), p.id));
      });
      brutas.forEach((l) => { l.processoId = achados.get(l.processo_dig) || null; });

      // anexos: chave = identificador da tarefa ou CNJ no caminho
      setAnaliseMsg("Ligando anexos às tarefas");
      await ceder();
      const idSet = new Set(ids);
      const procSet = new Set(procs);
      const lista: Anexo[] = [];
      let n = 0;
      for (let zi = 0; zi < zips.length; zi++) for (const e of zips[zi].entries) {
        const caminho = e.filename;
        const partes = caminho.split(/[\\/]/);
        const nome = partes[partes.length - 1];
        let chave: string | null = null, destino: Anexo["destino"] = null;
        for (const seg of partes) {
          const tokens = seg.split(/[^0-9A-Za-z]+/).filter(Boolean);
          const t = tokens.find((x) => idSet.has(x)) || (idSet.has(seg) ? seg : null);
          if (t) { chave = t; destino = "tarefa"; break; }
        }
        if (!chave) {
          const d = (caminho.match(/\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}/) || [])[0];
          const dd = d ? digitos(d) : "";
          if (dd && (procSet.has(dd) || dd.length === 20)) { chave = dd; destino = "processo"; }
        }
        lista.push({ zip: zi, entry: e, nome, chave, destino });
        if (++n % 5000 === 0) await ceder();
      }
      setLinhas(brutas);
      setAnexos(lista);
      setEtapa(2);
    } catch (e: any) {
      toast.error(`Erro na análise: ${e?.message || e}`);
    } finally {
      setPreparando(false);
      setAnaliseMsg("");
    }
  };

  const validas = useMemo(() => linhas.filter((l) => !l.erro && !l.duplicada), [linhas]);
  const respNaoReconhecidos = useMemo(() => {
    const m = new Map<string, number>();
    linhas.filter((l) => l.responsavelNome && !l.responsavelId).forEach((l) => m.set(norm(l.responsavelNome), (m.get(norm(l.responsavelNome)) || 0) + 1));
    return Array.from(m.entries());
  }, [linhas]);

  const reaplicarResponsaveis = () =>
    setLinhas((ls) => ls.map((l) => ({ ...l, responsavelId: casarResponsavel(l.responsavelNome) })));

  // ---------- Etapa 4: importação ----------
  const esperar = async () => { while (pausado.current && !cancelado.current) await new Promise((r) => setTimeout(r, 400)); };

  const importar = async () => {
    if (!user) return;
    setRodando(true); setEtapa(3); cancelado.current = false;
    const nomeCoord = coords.find((c) => c.id === coordId)?.nome || "";
    const { data: mig, error } = await supabase.from("migracoes_projuris" as any).insert({
      coordenacao_id: coordId, nome: `Projuris ${nomeCoord} ${new Date().toLocaleString("pt-BR")}`,
      mapeamento: mapa, criado_por: user.id,
    }).select("id").single();
    if (error || !mig) { toast.error(error?.message || "Falha ao abrir migração"); setRodando(false); return; }
    const mid = (mig as any).id as string;
    setMigracaoId(mid);
    const cont = { processos_criados: 0, tarefas_criadas: 0, tarefas_puladas: linhas.length - validas.length, anexos_enviados: 0, anexos_sem_vinculo: 0, erros: 0 };
    const logItens = async (itens: any[]) => {
      for (let k = 0; k < itens.length; k += 500) await supabase.from("migracoes_projuris_itens" as any).insert(itens.slice(k, k + 500).map((x) => ({ migracao_id: mid, ...x })));
    };
    await logItens(linhas.filter((l) => l.erro || l.duplicada).map((l) => ({ tipo: "tarefa", chave_externa: l.id_externo || null, status: "pulado", motivo: l.erro || "Já migrada / repetida", dados: { titulo: l.titulo } })));

    try {
      // 1) processos
      const procMap = new Map<string, string>();
      linhas.forEach((l) => l.processoId && procMap.set(l.processo_dig, l.processoId));
      const novos = Array.from(new Set(validas.filter((l) => !l.processoId && l.processo_dig.length === 20).map((l) => l.processo_dig)));
      const existentes = Array.from(new Set(procMap.values()));
      setProgresso({ fase: "Processos", feito: 0, total: novos.length });
      if (criarProcessos) {
        for (let k = 0; k < novos.length; k += LOTE) {
          await esperar(); if (cancelado.current) break;
          const parte = novos.slice(k, k + LOTE);
          const { data, error: e } = await supabase.from("processos").insert(parte.map((d) => ({
            numero: formatarCnj(d), area: "civil", status: "ativo", coordenacao_id: coordId,
          }) as any)).select("id, numero");
          if (e) { cont.erros++; await logItens(parte.map((d) => ({ tipo: "processo", chave_externa: d, status: "erro", motivo: e.message }))); }
          ((data as any[]) || []).forEach((p) => procMap.set(digitos(p.numero), p.id));
          await logItens(((data as any[]) || []).map((p) => ({ tipo: "processo", chave_externa: digitos(p.numero), registro_id: p.id, status: "criado" })));
          cont.processos_criados += (data as any[])?.length || 0;
          setProgresso({ fase: "Processos", feito: Math.min(k + LOTE, novos.length), total: novos.length });
        }
      }
      // processos de outras coordenações: coordenação entra como responsável
      for (let k = 0; k < existentes.length; k += LOTE) {
        await supabase.from("processos_coordenacoes_responsaveis").upsert(
          existentes.slice(k, k + LOTE).map((pid) => ({ processo_id: pid, coordenacao_id: coordId })) as any,
          { onConflict: "processo_id,coordenacao_id", ignoreDuplicates: true },
        );
      }

      // 2) tarefas
      const tarefaMap = new Map<string, { id: string; processo_id: string | null }>();
      setProgresso({ fase: "Tarefas", feito: 0, total: validas.length });
      for (let k = 0; k < validas.length; k += LOTE) {
        await esperar(); if (cancelado.current) break;
        const parte = validas.slice(k, k + LOTE);
        const payload = parte.map((l) => {
          const pid = procMap.get(l.processo_dig) || null;
          return {
            titulo: l.titulo.slice(0, 500), tipo_tarefa: l.tipo, tipo_registro: l.tipo === "PRAZO" ? "prazo" : "tarefa",
            data_vencimento: l.data, data_prevista: l.data, data_fatal: l.data_fatal,
            status: l.status, data_cumprimento: l.status === "cumprido" ? `${l.data}T12:00:00-03:00` : null,
            prioridade: "media", processo_id: pid, coordenacao_id: coordId,
            responsavel_id: l.responsavelId || user.id, criado_por: user.id, origem: "projuris",
            observacoes: [l.observacoes, `Projuris #${l.id_externo}`, l.hora ? `Hora: ${l.hora}` : "", !l.responsavelId && l.responsavelNome ? `Responsável no Projuris: ${l.responsavelNome}` : ""].filter(Boolean).join("\n"),
          };
        });
        const { data, error: e } = await supabase.from("tarefas").insert(payload as any).select("id, processo_id");
        if (e) {
          cont.erros++;
          await logItens(parte.map((l) => ({ tipo: "tarefa", chave_externa: l.id_externo, status: "erro", motivo: e.message })));
        } else {
          const rows = (data as any[]) || [];
          rows.forEach((r, j) => tarefaMap.set(parte[j].id_externo, r));
          await supabase.from("tarefa_responsaveis").insert(rows.map((r, j) => ({ tarefa_id: r.id, usuario_id: parte[j].responsavelId || user.id })) as any);
          await logItens(rows.map((r, j) => ({ tipo: "tarefa", chave_externa: parte[j].id_externo, registro_id: r.id, status: "criado", dados: { titulo: parte[j].titulo, tipo: parte[j].tipo, data: parte[j].data } })));
          cont.tarefas_criadas += rows.length;
        }
        setProgresso({ fase: "Tarefas", feito: Math.min(k + LOTE, validas.length), total: validas.length });
      }

      // 3) anexos
      setProgresso({ fase: "Anexos", feito: 0, total: anexos.length });
      const base = import.meta.env.VITE_SUPABASE_URL;
      let feitos = 0;
      const fila = [...anexos];
      const trabalhador = async () => {
        while (fila.length && !cancelado.current) {
          await esperar();
          const a = fila.shift()!;
          const tarefa = a.destino === "tarefa" && a.chave ? tarefaMap.get(a.chave) : undefined;
          const procId = tarefa?.processo_id || (a.destino === "processo" && a.chave ? procMap.get(a.chave) : null) || null;
          if (!tarefa && !procId) {
            cont.anexos_sem_vinculo++;
            await logItens([{ tipo: "anexo", chave_externa: a.entry.filename, status: "pulado", motivo: "Sem tarefa/processo correspondente" }]);
          } else {
            try {
              const blob: Blob = await (a.entry as any).getData(new BlobWriter());
              const path = `${procId || `tarefas/${tarefa!.id}`}/projuris_${Date.now()}_${sanitizarNome(a.nome)}`;
              const { error: up } = await supabase.storage.from("documentos_processos").upload(path, blob);
              if (up) throw up;
              const { data: doc, error: ins } = await supabase.from("documentos").insert({
                nome: a.nome, tipo: blob.type || null, tamanho_bytes: blob.size,
                url: `${base}/storage/v1/object/sign/documentos_processos/${path}`,
                processo_id: procId, tarefa_id: tarefa?.id || null, uploaded_by: user.id,
              } as any).select("id").single();
              if (ins) throw ins;
              cont.anexos_enviados++;
              await logItens([{ tipo: "anexo", chave_externa: a.entry.filename, registro_id: (doc as any).id, status: "criado", dados: { path } }]);
            } catch (e: any) {
              cont.erros++;
              await logItens([{ tipo: "anexo", chave_externa: a.entry.filename, status: "erro", motivo: e?.message || String(e) }]);
            }
          }
          feitos++;
          setProgresso({ fase: "Anexos", feito: feitos, total: anexos.length });
        }
      };
      await Promise.all([trabalhador(), trabalhador(), trabalhador(), trabalhador()]);

      await supabase.from("migracoes_projuris" as any).update({ status: cancelado.current ? "cancelado" : "concluido", contadores: cont }).eq("id", mid);
      toast.success("Migração finalizada");
    } catch (e: any) {
      await supabase.from("migracoes_projuris" as any).update({ status: "erro", contadores: { ...cont, erro: e?.message } }).eq("id", mid);
      toast.error(`Erro na migração: ${e?.message || e}`);
    } finally {
      setRodando(false); setEtapa(4); carregarHistorico();
    }
  };

  // ---------- Relatório / desfazer ----------
  const baixarRelatorio = async (mid: string) => {
    const todos: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data } = await supabase.from("migracoes_projuris_itens" as any).select("tipo, chave_externa, status, motivo, registro_id, dados").eq("migracao_id", mid).range(from, from + 999);
      todos.push(...((data as any[]) || []));
      if (!data || data.length < 1000) break;
    }
    const wb = XLSX.utils.book_new();
    for (const tipo of ["tarefa", "processo", "anexo"]) {
      const rows = todos.filter((t) => t.tipo === tipo).map((t) => ({
        "Identificação Projuris / arquivo": t.chave_externa, "Situação": t.status, "Motivo": t.motivo || "",
        "Título": t.dados?.titulo || "", "Tipo": t.dados?.tipo || "",
        "Data": t.dados?.data ? t.dados.data.split("-").reverse().join("/") : "", "ID no Juris Control": t.registro_id || "",
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ Aviso: "Nenhum registro" }]), tipo === "tarefa" ? "Tarefas" : tipo === "processo" ? "Processos" : "Anexos");
    }
    XLSX.writeFile(wb, `Relatorio_Migracao_Projuris_${mid.slice(0, 8)}.xlsx`);
  };

  const desfazer = async (mid: string) => {
    if (!window.confirm("Desfazer este lote? Tarefas, anexos e processos criados por ele serão removidos.")) return;
    const ids = async (tipo: string) => {
      const out: string[] = [];
      for (let from = 0; ; from += 1000) {
        const { data } = await supabase.from("migracoes_projuris_itens" as any).select("registro_id").eq("migracao_id", mid).eq("tipo", tipo).eq("status", "criado").range(from, from + 999);
        out.push(...((data as any[]) || []).map((d) => d.registro_id).filter(Boolean));
        if (!data || data.length < 1000) break;
      }
      return out;
    };
    const t = toast.loading("Desfazendo lote...");
    try {
      for (const [tipo, tabela] of [["anexo", "documentos"], ["tarefa", "tarefas"], ["processo", "processos"]] as const) {
        const lista = await ids(tipo);
        for (let k = 0; k < lista.length; k += 200) {
          const { error } = await supabase.from(tabela as any).delete().in("id", lista.slice(k, k + 200));
          if (error) throw error;
        }
        await supabase.from("migracoes_projuris_itens" as any).update({ status: "desfeito" }).eq("migracao_id", mid).eq("tipo", tipo).eq("status", "criado");
      }
      await supabase.from("migracoes_projuris" as any).update({ status: "desfeito" }).eq("id", mid);
      toast.success("Lote desfeito", { id: t });
      carregarHistorico();
    } catch (e: any) {
      toast.error(`Erro ao desfazer: ${e?.message || e}`, { id: t });
    }
  };

  const porTipo = useMemo(() => {
    const m = new Map<string, number>();
    validas.forEach((l) => m.set(l.tipo, (m.get(l.tipo) || 0) + 1));
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [validas]);

  const totalEntradas = zips.reduce((s, z) => s + z.entries.length, 0);
  if (roleLoading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;
  const pct = progresso.total ? Math.round((progresso.feito / progresso.total) * 100) : 0;

  return (
    <MainLayout title="Migração Projuris" subtitle="Restaurar backup de tarefas e anexos do Projuris">
      <div className="space-y-6">
        {/* Etapas */}
        <div className="flex flex-wrap items-center gap-2">
          {etapas.map((e, i) => (
            <div key={e} className="flex items-center gap-2">
              <div className={`flex h-8 items-center gap-2 rounded-full px-3 text-sm ${i === etapa ? "bg-primary text-primary-foreground" : i < etapa ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                <span className="font-semibold">{i + 1}</span> {e}
              </div>
              {i < etapas.length - 1 && <div className="h-px w-6 bg-border" />}
            </div>
          ))}
        </div>

        {etapa === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>1. Arquivos do backup</CardTitle>
              <CardDescription>Envie as planilhas de tarefas e os zips com os anexos. Os zips são lidos aqui mesmo, sem limite de tamanho.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 max-w-md">
                <Label>Coordenação de destino</Label>
                <Select value={coordId} onValueChange={setCoordId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{coords.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2 max-w-md">
                <Label>Usuário que assume as tarefas sem responsável</Label>
                <Select value={usuarioAssume} onValueChange={setUsuarioAssume}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SEM}>— usar o responsável da planilha —</SelectItem>
                    {membros.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Se escolher alguém, todas as tarefas importadas ficam com esse usuário, ignorando o responsável da planilha.</p>
              </div>
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center hover:bg-muted/40"
                onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); adicionarArquivos(e.dataTransfer.files); }}>
                <Upload className="h-8 w-8 text-muted-foreground" />
                <span className="font-medium">Arraste os arquivos aqui ou clique para escolher</span>
                <span className="text-xs text-muted-foreground">.xlsx, .xls, .csv e .zip</span>
                <input type="file" multiple className="hidden" accept=".xlsx,.xls,.csv,.zip" onChange={(e) => adicionarArquivos(e.target.files)} />
              </label>
              {lendo && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Lendo {lendo}...</p>}
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="mb-1 text-sm font-semibold">Planilhas ({planilhas.length} abas · {usadas.length} marcadas como tarefas)</h4>
                  <p className="mb-2 text-xs text-muted-foreground">Marque somente as planilhas que contêm as tarefas (ex.: tarefa.csv). As demais são ignoradas.</p>
                  <div className="max-h-[420px] overflow-auto pr-1">
                  {planilhas.map((p, i) => (
                    <div key={i} className="flex items-center gap-2 border-b py-1 text-sm">
                      <Checkbox checked={selecionadas.has(chaveP(p))} onCheckedChange={() => alternar(p)} />
                      <FileSpreadsheet className="h-4 w-4 text-primary" /> <span className="truncate">{p.arquivo} · {p.aba}</span>
                      <Badge variant="secondary" className="ml-auto">{p.linhas.length} linhas</Badge>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setPlanilhas((ps) => ps.filter((_, j) => j !== i))}><X className="h-3 w-3" /></Button>
                    </div>
                  ))}
                  </div>
                </div>
                <div>
                  <h4 className="mb-2 text-sm font-semibold">Zips de anexos ({totalEntradas} arquivos)</h4>
                  {zips.map((z, i) => (
                    <div key={i} className="flex items-center gap-2 border-b py-1 text-sm">
                      <FileArchive className="h-4 w-4 text-primary" /> <span className="truncate">{z.file.name}</span>
                      <Badge variant="secondary" className="ml-auto">{z.entries.length} arquivos · {(z.file.size / 1048576).toFixed(0)} MB</Badge>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setZips((zs) => zs.filter((_, j) => j !== i))}><X className="h-3 w-3" /></Button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-end gap-3">
                {lendo && <span className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Ainda lendo {lendo}...</span>}
                {!lendo && planilhas.length > 0 && !usadas.length && <span className="text-sm text-destructive">Marque ao menos uma planilha de tarefas para continuar.</span>}
                <Button disabled={!usadas.length} onClick={irParaColunas}>Continuar</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {etapa === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>2. Colunas</CardTitle>
              <CardDescription>Confira de qual coluna da planilha vem cada informação.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {CAMPOS.map((c) => (
                <div key={c.campo} className="grid items-center gap-2 md:grid-cols-[280px_1fr]">
                  <Label>{c.label}{c.obrigatorio && <span className="text-destructive"> *</span>}</Label>
                  <Select value={mapa[c.campo] || SEM} onValueChange={(v) => setMapa((m) => ({ ...m, [c.campo]: v === SEM ? undefined : v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SEM}>— não usar —</SelectItem>
                      {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setEtapa(0)}>Voltar</Button>
                <div className="flex items-center gap-3">
                  {preparando && analiseMsg && <span className="text-sm text-muted-foreground">{analiseMsg}</span>}
                  <Button onClick={preparar} disabled={preparando}>{preparando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Analisar</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {etapa === 2 && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Tarefas a importar", validas.length],
                ["Puladas (repetidas / com erro)", linhas.length - validas.length],
                ["Processos novos", new Set(validas.filter((l) => !l.processoId && l.processo_dig.length === 20).map((l) => l.processo_dig)).size],
                ["Processos já existentes", new Set(validas.filter((l) => l.processoId).map((l) => l.processoId)).size],
                ["Sem número de processo", validas.filter((l) => l.processo_dig.length !== 20).length],
                ["Anexos ligados", anexos.filter((a) => a.destino).length],
                ["Anexos sem vínculo", anexos.filter((a) => !a.destino).length],
                ["Responsável não reconhecido", validas.filter((l) => !l.responsavelId).length],
              ].map(([l, v]) => (
                <Card key={l as string}><CardContent className="p-4"><div className="text-2xl font-bold">{v as number}</div><div className="text-xs text-muted-foreground">{l}</div></CardContent></Card>
              ))}
            </div>

            <Card>
              <CardHeader><CardTitle className="text-base">Tipos identificados pelo título</CardTitle></CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                {porTipo.map(([t, n]) => <Badge key={t} variant="outline">{t}: {n}</Badge>)}
              </CardContent>
            </Card>

            {respNaoReconhecidos.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><AlertTriangle className="h-4 w-4 text-primary" /> Responsáveis do Projuris não reconhecidos</CardTitle>
                  <CardDescription>Escolha o usuário da coordenação. Sem escolha, o item fica com você e o nome original vai nas observações.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {respNaoReconhecidos.map(([nome, n]) => (
                    <div key={nome} className="grid items-center gap-2 md:grid-cols-[1fr_320px]">
                      <span className="text-sm">{nome} <span className="text-muted-foreground">({n})</span></span>
                      <Select value={respManual[nome] || SEM} onValueChange={(v) => setRespManual((m) => ({ ...m, [nome]: v }))}>
                        <SelectTrigger><SelectValue placeholder="Escolher" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={SEM}>— deixar comigo —</SelectItem>
                          {membros.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" onClick={reaplicarResponsaveis}>Aplicar escolhas</Button>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader><CardTitle className="text-base">Prévia (primeiras 200 linhas)</CardTitle></CardHeader>
              <CardContent className="max-h-[480px] overflow-auto p-0">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Projuris</TableHead><TableHead>Processo</TableHead><TableHead>Título</TableHead>
                    <TableHead>Tipo</TableHead><TableHead>Data</TableHead><TableHead>Situação</TableHead><TableHead>Responsável</TableHead><TableHead>Aviso</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {linhas.slice(0, 200).map((l) => (
                      <TableRow key={l.idx} className={l.erro || l.duplicada ? "opacity-50" : ""}>
                        <TableCell className="text-xs">{l.id_externo}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{l.processo_dig ? formatarCnj(l.processo_dig) : "—"}{l.processo_dig && !l.processoId && <Badge variant="secondary" className="ml-1">novo</Badge>}</TableCell>
                        <TableCell className="max-w-[280px] truncate text-xs">{l.titulo}</TableCell>
                        <TableCell>
                          <Select value={l.tipo} onValueChange={(v) => setLinhas((ls) => ls.map((x) => x.idx === l.idx ? { ...x, tipo: v } : x))}>
                            <SelectTrigger className="h-7 w-40 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{TIPOS_TAREFA.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-xs">{l.data?.split("-").reverse().join("/")}</TableCell>
                        <TableCell className="text-xs">{l.status}</TableCell>
                        <TableCell className="text-xs">{membros.find((m) => m.id === l.responsavelId)?.nome || <span className="text-muted-foreground">{l.responsavelNome || "—"}</span>}</TableCell>
                        <TableCell className="text-xs">{l.erro || (l.duplicada ? "Já migrada / repetida" : "")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="flex items-center justify-between">
              <Button variant="outline" onClick={() => setEtapa(1)}>Voltar</Button>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={criarProcessos} onCheckedChange={(v) => setCriarProcessos(!!v)} /> Cadastrar processos que não existem</label>
                <Button disabled={!validas.length} onClick={importar}>Importar {validas.length} tarefas e {anexos.filter((a) => a.destino).length} anexos</Button>
              </div>
            </div>
          </div>
        )}

        {etapa === 3 && (
          <Card>
            <CardHeader><CardTitle>4. Importando</CardTitle><CardDescription>Não feche esta página até terminar.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm"><span>{progresso.fase}</span><span>{progresso.feito} / {progresso.total}</span></div>
              <Progress value={pct} />
              <div className="flex gap-2">
                <Button variant="outline" disabled={!rodando} onClick={() => { pausado.current = !pausado.current; setPausa(pausado.current); }}>
                  {pausa ? <><Play className="mr-2 h-4 w-4" />Continuar</> : <><Pause className="mr-2 h-4 w-4" />Pausar</>}
                </Button>
                <Button variant="destructive" disabled={!rodando} onClick={() => { cancelado.current = true; pausado.current = false; }}>Cancelar</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {etapa === 4 && migracaoId && (
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-primary" />5. Migração finalizada</CardTitle></CardHeader>
            <CardContent className="flex gap-2">
              <Button onClick={() => baixarRelatorio(migracaoId)}><Download className="mr-2 h-4 w-4" />Baixar relatório Excel</Button>
              <Button variant="outline" onClick={() => { setEtapa(0); setPlanilhas([]); setZips([]); setLinhas([]); setAnexos([]); setMigracaoId(null); }}>Nova migração</Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-base">Histórico de migrações</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Lote</TableHead><TableHead>Situação</TableHead><TableHead>Processos</TableHead><TableHead>Tarefas</TableHead><TableHead>Anexos</TableHead><TableHead>Sem vínculo</TableHead><TableHead>Erros</TableHead><TableHead />
              </TableRow></TableHeader>
              <TableBody>
                {historico.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="text-sm">{h.nome}</TableCell>
                    <TableCell><Badge variant="outline">{h.status}</Badge></TableCell>
                    <TableCell>{h.contadores?.processos_criados ?? 0}</TableCell>
                    <TableCell>{h.contadores?.tarefas_criadas ?? 0}</TableCell>
                    <TableCell>{h.contadores?.anexos_enviados ?? 0}</TableCell>
                    <TableCell>{h.contadores?.anexos_sem_vinculo ?? 0}</TableCell>
                    <TableCell>{h.contadores?.erros ?? 0}</TableCell>
                    <TableCell className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => baixarRelatorio(h.id)}><Download className="h-4 w-4" /></Button>
                      {h.status !== "desfeito" && <Button size="sm" variant="ghost" onClick={() => desfazer(h.id)}><Undo2 className="h-4 w-4" /></Button>}
                    </TableCell>
                  </TableRow>
                ))}
                {!historico.length && <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground">Nenhuma migração ainda</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
