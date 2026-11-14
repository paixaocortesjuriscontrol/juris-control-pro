import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Upload, Download, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lerPlanilha, norm, digitos, formatarCnj, paraData } from "@/lib/migracaoProjuris";
import { casarNomeAproximado, dividirPipe } from "./agendaFuturaProjuris";
import { tipoWorkflow, chaveWorkflow } from "./tarefasWorkflowProjuris";

const db = supabase as any;
const COORD = "968631d0-6659-46f1-b45d-899892cb0121"; // Coordenação Santander Cível
const raw = (r: Record<string, any>, nome: string) => {
  const k = Object.keys(r).find((h) => norm(h) === norm(nome));
  return k ? r[k] : "";
};
const col = (r: Record<string, any>, nome: string) => String(raw(r, nome) ?? "").trim();
const semPapel = (s: string) => s.replace(/\s*\((cliente|contrário|contrario)\)\s*$/i, "").trim();
const ROT: Record<string, string> = { prazos: "Prazos criados", tarefas: "Tarefas criadas", processosCriados: "Processos criados", processosVinculados: "Processos de outra coordenação vinculados", etiquetas: "Etiquetas aplicadas", erros: "Com erro", pulados: "Linhas puladas" };

export function ImportarTarefasWorkflowProjuris({ userId, onConcluido }: { userId: string; onConcluido?: () => void }) {
  const [linhas, setLinhas] = useState<any[] | null>(null);
  const [rodando, setRodando] = useState(false);
  const [prog, setProg] = useState({ etapa: "", feito: 0, total: 0 });
  const [rel, setRel] = useState<any | null>(null);
  const cancelar = useRef(false);

  const ler = async (f?: File) => {
    if (!f) return;
    setRodando(true); setRel(null); setProg({ etapa: "Lendo e conferindo a planilha", feito: 0, total: 1 });
    try {
      const ps = await lerPlanilha(f);
      const p = ps.find((x) => x.headers.some((h) => norm(h) === "classificacao"));
      if (!p) throw new Error("A planilha não tem a coluna 'CLASSIFICAÇÃO'.");
      const ls = p.linhas.map((r) => {
        const dig = digitos(col(r, "Processo Vinculado"));
        const fatal = paraData(raw(r, "Data Fatal")) || paraData(raw(r, "Data de Conclusão Prevista"));
        const titulo = col(r, "TÍTULO DA ATIVIDADE");
        return {
          tipo: tipoWorkflow(col(r, "CLASSIFICAÇÃO")), titulo, obs: col(r, "OBSERVAÇÃO"), cliente: dividirPipe(col(r, "Cliente"))[0] || "",
          responsaveis: dividirPipe(col(r, "Responsáveis")), etiquetas: dividirPipe(col(r, "Marcadores")),
          inclusao: paraData(raw(r, "Data da Inclusão")), fatal, prevista: paraData(raw(r, "Data de Conclusão Prevista")) || fatal,
          dig, pro: col(r, "Identificador do Módulo Vinculado"), ativas: dividirPipe(col(r, "Parte Ativa")), passivas: dividirPipe(col(r, "Parte Passiva")),
          chave: chaveWorkflow(dig, titulo, fatal), motivo: null as string | null,
        };
      }).filter((l) => l.titulo || l.tipo || l.dig);
      // Já migradas por este importador
      const chaves = ls.map((l) => l.chave);
      const ja = new Set<string>();
      for (let k = 0; k < chaves.length; k += 200) {
        const { data, error } = await db.from("migracoes_projuris_itens").select("chave_externa").eq("status", "criado").in("chave_externa", chaves.slice(k, k + 200));
        if (error) throw error;
        (data || []).forEach((d: any) => ja.add(d.chave_externa));
      }
      // Atividades iguais já existentes no Santander Cível (ex.: Agenda Futura)
      const digs = Array.from(new Set(ls.map((l) => l.dig).filter((d) => d.length === 20)));
      for (let k = 0; k < digs.length; k += 100) {
        const parte = digs.slice(k, k + 100);
        const { data: procs } = await db.from("processos").select("id, numero").in("numero", [...parte, ...parte.map(formatarCnj)]);
        const ids = (procs || []).map((x: any) => x.id); if (!ids.length) continue;
        const numPor = new Map<string, string>((procs || []).map((x: any) => [x.id, digitos(x.numero)]));
        const { data: ts } = await db.from("tarefas").select("processo_id, titulo, data_fatal").eq("coordenacao_id", COORD).in("processo_id", ids).not("status", "in", "(cancelado,cancelado_oculto)");
        (ts || []).forEach((t: any) => ja.add(chaveWorkflow(numPor.get(t.processo_id) || "", t.titulo || "", t.data_fatal)));
      }
      const vistos = new Set<string>();
      ls.forEach((l) => {
        if (!l.tipo) l.motivo = "Classificação vazia ou desconhecida";
        else if (!l.titulo) l.motivo = "Sem título";
        else if (l.dig.length !== 20) l.motivo = "Sem número de processo válido";
        else if (!l.fatal) l.motivo = "Sem data fatal";
        else if (vistos.has(l.chave)) l.motivo = "Repetida na planilha";
        else if (ja.has(l.chave)) l.motivo = "Já existe no sistema (mesmo processo, título e data fatal)";
        vistos.add(l.chave);
      });
      setLinhas(ls);
    } catch (e: any) { toast.error(e?.message || String(e)); }
    setRodando(false); setProg({ etapa: "", feito: 0, total: 0 });
  };

  const importar = async () => {
    if (!linhas) return;
    setRodando(true); cancelar.current = false;
    const ok = linhas.filter((l) => !l.motivo);
    const cont: Record<string, number> = { prazos: 0, tarefas: 0, processosCriados: 0, processosVinculados: 0, etiquetas: 0, erros: 0, pulados: linhas.length - ok.length };
    const semUsuario = new Map<string, number>(); const erros: any[] = []; const procCriados: any[] = [];
    const { data: mig, error: em } = await db.from("migracoes_projuris").insert({ coordenacao_id: COORD, nome: `Projuris Tarefas de workflows ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`, mapeamento: { modulo: "tarefas_workflow" }, criado_por: userId }).select("id").single();
    if (em || !mig) { toast.error(em?.message || "Falha ao abrir migração"); setRodando(false); return; }
    const mid = mig.id;
    const log = async (rows: any[]) => { for (let k = 0; k < rows.length; k += 200) await db.from("migracoes_projuris_itens").insert(rows.slice(k, k + 200).map((x) => ({ migracao_id: mid, ...x }))); };
    try {
      setProg({ etapa: "Carregando usuários, modelos, etiquetas e clientes", feito: 0, total: ok.length });
      const [{ data: perfis }, { data: modelos }, { data: etqs }, { data: clis }] = await Promise.all([
        supabase.from("profiles").select("id, nome"),
        db.from("modelos_titulo_coordenacao").select("id, nome, titulo").eq("coordenacao_id", COORD).eq("ativo", true),
        db.from("etiquetas").select("id, nome").eq("coordenacao_id", COORD),
        db.from("clientes").select("id, nome").ilike("nome", "%SANTANDER%"),
      ]);
      const usuarios = (perfis || []) as { id: string; nome: string }[];
      const casar = (n: string) => {
        const k = norm(n); if (!k) return null;
        const ex = usuarios.filter((u) => norm(u.nome) === k); if (ex.length === 1) return ex[0].id;
        const ap = casarNomeAproximado(n, usuarios); if (ap) return ap;
        semUsuario.set(n, (semUsuario.get(n) || 0) + 1); return null;
      };
      const modeloPor = new Map<string, string>();
      (modelos || []).forEach((m: any) => [m.nome, m.titulo].forEach((x) => x && !modeloPor.has(norm(x)) && modeloPor.set(norm(x), m.id)));
      const cliPor = new Map<string, string>((clis || []).map((c: any) => [norm(c.nome), c.id]));
      const etqId = new Map<string, string>((etqs || []).map((e: any) => [norm(e.nome), e.id]));
      const faltam = Array.from(new Set(ok.flatMap((l) => l.etiquetas).filter((e: string) => norm(e) !== "captura" && !etqId.has(norm(e)))));
      if (faltam.length) {
        const { data, error } = await db.from("etiquetas").insert(faltam.map((nome) => ({ nome: String(nome).toUpperCase(), coordenacao_id: COORD, created_by: userId }))).select("id, nome");
        if (error) erros.push({ Etapa: "Etiquetas", Erro: error.message });
        (data || []).forEach((e: any) => etqId.set(norm(e.nome), e.id));
      }
      // Processos
      const primeira = new Map<string, any>(); ok.forEach((l) => !primeira.has(l.dig) && primeira.set(l.dig, l));
      const digs = Array.from(primeira.keys());
      const proc = new Map<string, { id: string; coord: string | null }>();
      for (let k = 0; k < digs.length; k += 100) {
        const parte = digs.slice(k, k + 100);
        const { data, error } = await db.from("processos").select("id, numero, coordenacao_id").in("numero", [...parte, ...parte.map(formatarCnj)]);
        if (error) throw error;
        (data || []).forEach((p: any) => proc.set(digitos(p.numero), { id: p.id, coord: p.coordenacao_id }));
        setProg({ etapa: "Procurando processos", feito: Math.min(k + 100, digs.length), total: digs.length });
      }
      const outras = digs.filter((d) => proc.has(d) && proc.get(d)!.coord !== COORD);
      if (outras.length) await db.from("processos_coordenacoes_responsaveis").upsert(outras.map((d) => ({ processo_id: proc.get(d)!.id, coordenacao_id: COORD })), { onConflict: "processo_id,coordenacao_id", ignoreDuplicates: true });
      cont.processosVinculados = outras.length;
      for (const d of digs.filter((x) => proc.has(x))) {
        const l = primeira.get(d); if (l.pro) await db.from("processos").update({ identificador_projuris: l.pro }).eq("id", proc.get(d)!.id).is("identificador_projuris", null);
      }
      const novos = digs.filter((d) => !proc.has(d));
      for (let k = 0; k < novos.length && !cancelar.current; k += 50) {
        const parte = novos.slice(k, k + 50).map((d) => primeira.get(d));
        const { data, error } = await db.from("processos").insert(parte.map((l: any) => ({
          numero: formatarCnj(l.dig), area: "civil", status: "ativo", coordenacao_id: COORD, cliente_id: cliPor.get(norm(l.cliente)) || null,
          identificador_projuris: l.pro || null, polo_ativo: l.ativas.map(semPapel).join("; ") || null, polo_passivo: l.passivas.map(semPapel).join("; ") || null,
          observacoes_processo: "Importado Projuris (Tarefas de workflows)",
        }))).select("id, numero");
        if (error) { erros.push(...parte.map((l: any) => ({ Processo: formatarCnj(l.dig), Erro: error.message }))); continue; }
        (data || []).forEach((p: any) => { proc.set(digitos(p.numero), { id: p.id, coord: COORD }); procCriados.push({ Processo: p.numero, "PRO.": primeira.get(digitos(p.numero))?.pro || "" }); });
        await log((data || []).map((p: any) => ({ tipo: "processo", chave_externa: digitos(p.numero), registro_id: p.id, status: "criado", dados: { pro: primeira.get(digitos(p.numero))?.pro } })));
        cont.processosCriados += (data || []).length;
        setProg({ etapa: "Criando processos", feito: Math.min(k + 50, novos.length), total: novos.length });
      }
      // Atividades
      const LOTE = 50; let feito = 0;
      for (let k = 0; k < ok.length && !cancelar.current; k += LOTE) {
        const lote = ok.slice(k, k + LOTE).filter((l) => proc.has(l.dig));
        ok.slice(k, k + LOTE).filter((l) => !proc.has(l.dig)).forEach((l) => { cont.erros++; erros.push({ Processo: formatarCnj(l.dig), Título: l.titulo, Erro: "Processo não pôde ser criado" }); });
        if (lote.length) {
          const resps = lote.map((l) => Array.from(new Set(l.responsaveis.map(casar).filter(Boolean))) as string[]);
          const { data, error } = await db.from("tarefas").insert(lote.map((l, j) => ({
            titulo: l.titulo.slice(0, 500), descricao: l.obs || null, tipo_tarefa: l.tipo === "prazo" ? "PRAZO" : "TAREFA", tipo_registro: l.tipo,
            data_vencimento: l.prevista, data_prevista: l.prevista, data_fatal: l.fatal, status: "pendente", prioridade: "media",
            processo_id: proc.get(l.dig)!.id, coordenacao_id: COORD, responsavel_id: resps[j][0] || null, criado_por: null, origem: "projuris",
            identificador_modulo: l.pro || null, modulo: "Processo", modelo_tarefa_id: modeloPor.get(norm(l.titulo)) || null,
            partes_ativas: l.ativas.join(" | ") || null, partes_passivas: l.passivas.join(" | ") || null, marcadores: l.etiquetas.join(" | ") || null,
            data_criacao_projuris: l.inclusao, observacoes: [l.obs, `Importado Projuris (Tarefas de workflows)${l.pro ? ` — ${l.pro}` : ""}`].filter(Boolean).join("\n"),
            ...(l.inclusao ? { created_at: `${l.inclusao}T12:00:00-03:00` } : {}),
          }))).select("id");
          if (error) { cont.erros += lote.length; erros.push(...lote.map((l) => ({ Processo: formatarCnj(l.dig), Título: l.titulo, Erro: error.message }))); }
          else {
            const rows = data || [];
            const respRows = rows.flatMap((r: any, j: number) => resps[j].map((u) => ({ tarefa_id: r.id, usuario_id: u })));
            const etqRows = rows.flatMap((r: any, j: number) => lote[j].etiquetas.filter((e: string) => etqId.has(norm(e))).map((e: string) => ({ etiqueta_id: etqId.get(norm(e)), entidade: lote[j].tipo, entidade_id: r.id, created_by: userId })));
            if (respRows.length) { const { error: e1 } = await db.from("tarefa_responsaveis").insert(respRows); if (e1) erros.push({ Etapa: "Responsáveis", Erro: e1.message }); }
            if (etqRows.length) { const { error: e2 } = await db.from("etiquetas_itens").insert(etqRows); if (e2) erros.push({ Etapa: "Etiquetas", Erro: e2.message }); else cont.etiquetas += etqRows.length; }
            rows.forEach((_: any, j: number) => (lote[j].tipo === "prazo" ? cont.prazos++ : cont.tarefas++));
            await log(rows.map((r: any, j: number) => ({ tipo: "tarefa", chave_externa: lote[j].chave, registro_id: r.id, status: "criado", dados: { titulo: lote[j].titulo, fatal: lote[j].fatal, pro: lote[j].pro, tipo: lote[j].tipo } })));
          }
        }
        feito = Math.min(k + LOTE, ok.length); setProg({ etapa: "Gravando prazos e tarefas", feito, total: ok.length });
      }
      await db.from("migracoes_projuris").update({ status: cancelar.current ? "cancelada" : "concluida", contadores: cont }).eq("id", mid);
      setRel({ cont, semUsuario: Array.from(semUsuario), erros, procCriados, pulados: linhas.filter((l) => l.motivo) });
      toast.success(`Tarefas de workflows: ${cont.prazos} prazos e ${cont.tarefas} tarefas.`);
      setLinhas(null); onConcluido?.();
    } catch (e: any) {
      await db.from("migracoes_projuris").update({ status: "erro", contadores: cont }).eq("id", mid);
      toast.error(e?.message || String(e));
    }
    setRodando(false);
  };

  const baixar = () => {
    const wb = XLSX.utils.book_new();
    const aba = (rows: any[], nome: string) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ Aviso: "Nenhum registro" }]), nome);
    aba(Object.keys(ROT).map((k) => ({ Item: ROT[k], Quantidade: rel.cont[k] || 0 })), "Resumo");
    aba(rel.semUsuario.map(([n, q]: any) => ({ "Responsável no Projuris": n, Ocorrências: q })), "Pessoas não encontradas");
    aba(rel.procCriados, "Processos criados");
    aba(rel.pulados.map((l: any) => ({ Processo: l.dig ? formatarCnj(l.dig) : "", Título: l.titulo, "Data fatal": l.fatal ? l.fatal.split("-").reverse().join("/") : "", Motivo: l.motivo })), "Linhas puladas");
    aba(rel.erros, "Erros");
    XLSX.writeFile(wb, "Relatorio_Tarefas_Workflows_Projuris.xlsx");
  };

  const cont = (t: string) => (linhas || []).filter((l) => !l.motivo && l.tipo === t).length;
  const aImportar = linhas ? linhas.filter((l) => !l.motivo).length : 0;
  const pct = prog.total ? Math.round((prog.feito / prog.total) * 100) : 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tarefas de workflows (planilha do Projuris) — Coordenação Santander Cível</CardTitle>
        <CardDescription>O tipo segue a coluna "CLASSIFICAÇÃO" (Prazo ou Tarefa). Sem identificador TAR., não duplica pelo processo + título + data fatal.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed p-6 text-sm text-muted-foreground hover:bg-muted/40">
          <Upload className="h-6 w-6" /> Enviar TAREFAS_DECORRENTES_DE_WFLOWS.xlsx
          <input type="file" accept=".xlsx,.xls" className="hidden" disabled={rodando} onChange={(e) => { void ler(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        {rodando && prog.etapa && (
          <div className="space-y-1 rounded-md border bg-muted/30 p-3">
            <div className="flex justify-between text-sm font-medium"><span>{cancelar.current ? "Cancelando…" : prog.etapa}</span><span>{pct}%</span></div>
            <Progress value={pct} />
            <p className="text-xs text-muted-foreground">{prog.feito} de {prog.total}</p>
          </div>
        )}
        {linhas && (
          <div className="space-y-2 rounded-md border p-3">
            <h4 className="text-sm font-semibold">Conferência (nada foi gravado ainda)</h4>
            {[["Prazos a importar", cont("prazo")], ["Tarefas a importar", cont("tarefa")], ["Puladas", linhas.length - aImportar]].map(([k, n]) => (
              <div key={k as string} className="flex justify-between text-sm"><span>{k}</span><Badge variant="secondary">{n}</Badge></div>
            ))}
            {linhas.filter((l: any) => l.motivo).length > 0 && (
              <ul className="space-y-1 rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                {linhas.filter((l: any) => l.motivo).map((l: any, i: number) => (
                  <li key={i}><span className="font-medium text-foreground">{l.titulo || "(sem título)"}{l.dig ? ` — ${formatarCnj(l.dig)}` : ""}{l.linha ? ` (linha ${l.linha})` : ""}:</span> {l.motivo}</li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <Button disabled={rodando || !aImportar} onClick={importar}>{rodando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Importar {aImportar} atividades</Button>
              {rodando && <Button variant="outline" onClick={() => { cancelar.current = true; }}><X className="mr-1 h-4 w-4" />Cancelar</Button>}
            </div>
          </div>
        )}
        {rel && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm">
            <span>{rel.cont.prazos} prazos · {rel.cont.tarefas} tarefas · {rel.cont.processosCriados} processos criados · {rel.cont.erros} erros</span>
            <Button size="sm" variant="outline" className="ml-auto" onClick={baixar}><Download className="mr-1 h-4 w-4" />Relatório Excel</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
