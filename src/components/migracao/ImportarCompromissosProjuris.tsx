import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Upload, Download, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lerPlanilha, norm, digitos, formatarCnj, paraData, paraHora } from "@/lib/migracaoProjuris";
import { casarNomeAproximado, dividirPipe } from "./agendaFuturaProjuris";
import { tipoCompromisso, cnjDoTexto } from "./compromissosProjuris";

const db = supabase as any;
const COORD = "968631d0-6659-46f1-b45d-899892cb0121"; // Coordenação Santander Cível
const col = (r: Record<string, any>, nome: string) => {
  const k = Object.keys(r).find((h) => norm(h) === norm(nome));
  return k ? String(r[k] ?? "").trim() : "";
};
const isoBRT = (d: string | null, h: string | null) => (d ? `${d}T${h || "12:00"}:00-03:00` : null);
const ROT: Record<string, string> = { eventos: "Eventos criados", tarefas: "Tarefas criadas", audiencias: "Audiências criadas", vinculadas: "Audiências ligadas a processo", erros: "Com erro", pulados: "Linhas puladas" };

export function ImportarCompromissosProjuris({ userId, onConcluido }: { userId: string; onConcluido?: () => void }) {
  const [linhas, setLinhas] = useState<any[] | null>(null);
  const [rodando, setRodando] = useState(false);
  const [prog, setProg] = useState({ etapa: "", feito: 0, total: 0 });
  const [rel, setRel] = useState<any | null>(null);
  const cancelar = useRef(false);

  const ler = async (f?: File) => {
    if (!f) return;
    setRodando(true); setRel(null);
    try {
      const ps = await lerPlanilha(f);
      const p = ps.find((x) => x.headers.some((h) => norm(h) === "agendar como"));
      if (!p) throw new Error("A planilha não tem a coluna 'AGENDAR COMO'.");
      const ls = p.linhas.map((r) => {
        const obs = col(r, "OBS");
        return {
          tipo: tipoCompromisso(col(r, "AGENDAR COMO")), titulo: col(r, "TÍTULO DO EVENTO"), tar: col(r, "Identificador"), obs,
          responsaveis: dividirPipe(col(r, "Responsáveis")), inclusao: paraData(col(r, "Data da Inclusão")),
          inicio: paraData(col(r, "Data de Início do Compromisso")) || paraData(col(r, "Data de Conclusão")) || paraData(col(r, "Data Fatal")),
          hora: paraHora(col(r, "Horário do Compromisso")) || paraHora(col(r, "Hora Fatal")),
          fim: paraData(col(r, "Data de Término do Compromisso")), fatal: paraData(col(r, "Data Fatal")),
          dig: cnjDoTexto(obs), motivo: null as string | null,
        };
      });
      const tars = ls.map((l) => l.tar).filter(Boolean);
      const ja = new Set<string>();
      for (let k = 0; k < tars.length; k += 200) {
        const { data, error } = await db.from("migracoes_projuris_itens").select("chave_externa").eq("status", "criado").in("tipo", ["tarefa", "evento", "audiencia"]).in("chave_externa", tars.slice(k, k + 200));
        if (error) throw error;
        (data || []).forEach((d: any) => ja.add(d.chave_externa));
      }
      const vistos = new Set<string>();
      ls.forEach((l) => {
        if (!l.tar) l.motivo = "Sem identificador";
        else if (!l.tipo) l.motivo = "Tipo desconhecido na coluna AGENDAR COMO";
        else if (vistos.has(l.tar)) l.motivo = "Repetida na planilha";
        else if (ja.has(l.tar)) l.motivo = "Já migrada antes";
        else if (!l.inicio) l.motivo = "Sem data";
        vistos.add(l.tar);
      });
      setLinhas(ls);
    } catch (e: any) { toast.error(e?.message || String(e)); }
    setRodando(false);
  };

  const importar = async () => {
    if (!linhas) return;
    setRodando(true); cancelar.current = false;
    const ok = linhas.filter((l) => !l.motivo);
    const cont: Record<string, number> = { eventos: 0, tarefas: 0, audiencias: 0, vinculadas: 0, erros: 0, pulados: linhas.length - ok.length };
    const semUsuario = new Map<string, number>(); const semProc: any[] = []; const erros: any[] = []; const criados: any[] = [];
    const { data: mig, error: em } = await db.from("migracoes_projuris").insert({ coordenacao_id: COORD, nome: `Projuris Compromissos ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`, mapeamento: { modulo: "compromissos" }, criado_por: userId }).select("id").single();
    if (em || !mig) { toast.error(em?.message || "Falha ao abrir migração"); setRodando(false); return; }
    const mid = mig.id;
    try {
      setProg({ etapa: "Carregando usuários, modelos e processos", feito: 0, total: ok.length });
      const [{ data: perfis }, { data: modelos }] = await Promise.all([
        supabase.from("profiles").select("id, nome"),
        db.from("modelos_titulo_coordenacao").select("id, nome, titulo").eq("coordenacao_id", COORD).eq("ativo", true),
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
      const digs = Array.from(new Set(ok.map((l) => l.dig).filter(Boolean))) as string[];
      const proc = new Map<string, string>();
      if (digs.length) {
        const { data } = await db.from("processos").select("id, numero").in("numero", [...digs, ...digs.map(formatarCnj)]);
        (data || []).forEach((p: any) => proc.set(digitos(p.numero), p.id));
      }
      let feito = 0;
      for (const l of ok) {
        if (cancelar.current) break;
        const resp = Array.from(new Set(l.responsaveis.map(casar).filter(Boolean))) as string[];
        const pid = l.dig ? proc.get(l.dig) || null : null;
        const obsTxt = [l.obs, `Importado Projuris — ${l.tar}`].filter(Boolean).join("\n");
        const criado = l.inclusao ? { created_at: isoBRT(l.inclusao, null) } : {};
        let id: string | null = null; let erro: any = null;
        if (l.tipo === "evento") {
          const r = await db.from("eventos_agenda").insert({ titulo: l.titulo.slice(0, 500), descricao: obsTxt, tipo: "evento", status: "pendente", data_inicio: isoBRT(l.inicio, l.hora), data_fim: l.fim ? isoBRT(l.fim, l.hora) : null, dia_inteiro: !l.hora, criado_por: userId, coordenacao_id: COORD, origem: "projuris", identificador_externo: l.tar, ...criado }).select("id").single();
          id = r.data?.id; erro = r.error;
          if (id && resp.length) await db.from("evento_responsaveis").insert(resp.map((u) => ({ evento_id: id, usuario_id: u })));
        } else if (l.tipo === "tarefa") {
          const r = await db.from("tarefas").insert({ titulo: l.titulo.slice(0, 500), descricao: l.obs || null, tipo_tarefa: "TAREFA", tipo_registro: "tarefa", data_vencimento: l.inicio, data_prevista: l.inicio, data_fatal: l.fatal || l.inicio, hora_prevista: l.hora, status: "pendente", prioridade: "media", coordenacao_id: COORD, responsavel_id: resp[0] || null, criado_por: null, origem: "projuris", identificador_projuris: l.tar, modelo_tarefa_id: modeloPor.get(norm(l.titulo)) || null, observacoes: obsTxt, data_criacao_projuris: l.inclusao, ...criado }).select("id").single();
          id = r.data?.id; erro = r.error;
          if (id && resp.length) await db.from("tarefa_responsaveis").insert(resp.map((u) => ({ tarefa_id: id, usuario_id: u })));
        } else {
          const hora = l.hora || "12:00";
          const r = await db.from("audiencias_detectadas").insert({ titulo: l.titulo, tipo_audiencia: l.titulo, data_audiencia: isoBRT(l.inicio, hora), hora, hora_brasilia: hora, status: "pendente", processo_id: pid, processo_numero: l.dig ? formatarCnj(l.dig) : null, coordenacao_id: COORD, advogado: l.responsaveis.join(", ") || null, origem: "projuris", observacoes: obsTxt, ...criado }).select("id").single();
          id = r.data?.id; erro = r.error;
          if (id && resp.length) await db.from("audiencias_advogados").insert(resp.map((u) => ({ audiencia_id: id, advogado_id: u })));
          if (id) { if (pid) cont.vinculadas++; else semProc.push({ Identificador: l.tar, Título: l.titulo, "Processo na observação": l.dig ? formatarCnj(l.dig) : "(não encontrado no texto)" }); }
        }
        if (erro || !id) { cont.erros++; erros.push({ Identificador: l.tar, Título: l.titulo, Erro: erro?.message || "sem retorno" }); }
        else {
          cont[l.tipo === "evento" ? "eventos" : l.tipo === "tarefa" ? "tarefas" : "audiencias"]++;
          criados.push({ tipo: l.tipo, chave_externa: l.tar, registro_id: id, status: "criado", dados: { titulo: l.titulo, data: l.inicio } });
          if (criados.length >= 50) { await db.from("migracoes_projuris_itens").insert(criados.splice(0).map((x) => ({ migracao_id: mid, ...x }))); }
        }
        feito++; setProg({ etapa: "Gravando compromissos", feito, total: ok.length });
      }
      if (criados.length) await db.from("migracoes_projuris_itens").insert(criados.map((x) => ({ migracao_id: mid, ...x })));
      await db.from("migracoes_projuris").update({ status: cancelar.current ? "cancelada" : "concluida", contadores: cont }).eq("id", mid);
      setRel({ cont, semUsuario: Array.from(semUsuario), semProc, erros, pulados: linhas.filter((l) => l.motivo) });
      toast.success(`Compromissos: ${cont.eventos} eventos, ${cont.tarefas} tarefas e ${cont.audiencias} audiências.`);
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
    aba(rel.semProc, "Audiências sem processo");
    aba(rel.pulados.map((l: any) => ({ Identificador: l.tar, Título: l.titulo, Motivo: l.motivo })), "Linhas puladas");
    aba(rel.erros, "Erros");
    XLSX.writeFile(wb, "Relatorio_Compromissos_Projuris.xlsx");
  };

  const cont = (t: string) => (linhas || []).filter((l) => !l.motivo && l.tipo === t).length;
  const aImportar = linhas ? linhas.filter((l) => !l.motivo).length : 0;
  const pct = prog.total ? Math.round((prog.feito / prog.total) * 100) : 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Compromissos (planilha do Projuris) — Coordenação Santander Cível</CardTitle>
        <CardDescription>O tipo segue a coluna "AGENDAR COMO" (Evento, Tarefa ou Audiência). O identificador TAR. é guardado; reimportar não duplica.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed p-6 text-sm text-muted-foreground hover:bg-muted/40">
          <Upload className="h-6 w-6" /> Enviar COMPROMISSOS_PROJURIS.xlsx
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
            {[["Eventos a importar", cont("evento")], ["Tarefas a importar", cont("tarefa")], ["Audiências a importar", cont("audiencia")], ["Puladas", linhas.length - aImportar]].map(([k, n]) => (
              <div key={k as string} className="flex justify-between text-sm"><span>{k}</span><Badge variant="secondary">{n}</Badge></div>
            ))}
            <div className="flex gap-2">
              <Button disabled={rodando || !aImportar} onClick={importar}>{rodando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Importar {aImportar} compromissos</Button>
              {rodando && <Button variant="outline" onClick={() => { cancelar.current = true; }}><X className="mr-1 h-4 w-4" />Cancelar</Button>}
            </div>
          </div>
        )}
        {rel && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm">
            <span>{rel.cont.eventos} eventos · {rel.cont.tarefas} tarefas · {rel.cont.audiencias} audiências · {rel.cont.erros} erros</span>
            <Button size="sm" variant="outline" className="ml-auto" onClick={baixar}><Download className="mr-1 h-4 w-4" />Relatório Excel</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
