import ExcelJS from "exceljs";
import { supabase } from "@/integrations/supabase/client";

export interface VinculoProc { processo_id: string; usuario_id: string; coordenacao_id: string | null; papel: string | null }
export interface Membro { usuario_id: string; coordenacao_id: string; cargo: string | null }

export const ehResponsavel = (papel: string | null) =>
  (papel || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() === "responsavel";

/** Conta processos distintos por usuário (geral) e por usuário+coordenação. */
export function agregarVinculos(vinculos: VinculoProc[]) {
  const geral = new Map<string, { resp: Set<string>; env: Set<string> }>();
  const porCoord = new Map<string, { resp: Set<string>; env: Set<string> }>();
  const procCoord = new Map<string, Set<string>>();
  const get = (m: typeof geral, k: string) => {
    let v = m.get(k); if (!v) { v = { resp: new Set(), env: new Set() }; m.set(k, v); } return v;
  };
  for (const v of vinculos) {
    const r = ehResponsavel(v.papel);
    const g = get(geral, v.usuario_id);
    (r ? g.resp : g.env).add(v.processo_id);
    if (v.coordenacao_id) {
      const c = get(porCoord, `${v.usuario_id}|${v.coordenacao_id}`);
      (r ? c.resp : c.env).add(v.processo_id);
      let s = procCoord.get(v.coordenacao_id); if (!s) { s = new Set(); procCoord.set(v.coordenacao_id, s); } s.add(v.processo_id);
    }
  }
  const cnt = (x?: { resp: Set<string>; env: Set<string> }) => {
    if (!x) return { responsavel: 0, envolvido: 0, total: 0 };
    const tot = new Set([...x.resp, ...x.env]).size;
    return { responsavel: x.resp.size, envolvido: x.env.size, total: tot };
  };
  return {
    geral: (u: string) => cnt(geral.get(u)),
    coord: (u: string, c: string) => cnt(porCoord.get(`${u}|${c}`)),
    processosCoord: (c: string) => procCoord.get(c)?.size ?? 0,
  };
}

async function lerTudo<T>(tabela: string, colunas: string, filtro?: (q: any) => any): Promise<T[]> {
  const out: T[] = [];
  for (let de = 0; ; de += 1000) {
    let q: any = (supabase as any).from(tabela).select(colunas).range(de, de + 999).order("id");
    if (filtro) q = filtro(q);
    const { data, error } = await q;
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

const CARGO: Record<string, string> = {
  coordenador: "Coordenador", assistente_coordenador: "Assistente de Coordenador", advogado: "Advogado",
  advogado_senior: "Advogado Sênior", assistente: "Assistente", estagiario: "Estagiário", secretaria: "Secretária",
  controladoria: "Controladoria", membro: "Membro",
};
const rot = (c: string | null) => (c ? CARGO[c] || c.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) : "—");
const PERFIL: Record<string, string> = {
  admin: "Administrador", coordenador: "Coordenador", advogado: "Advogado", estagiario: "Estagiário",
  assistente: "Assistente", secretaria: "Secretária", cliente: "Cliente", advogado_temporario: "Advogado Temporário",
  assistente_coordenador: "Assistente de Coordenador", assistente_juridico_geral: "Assistente Jurídico Geral", controladoria: "Controladoria",
};

export async function gerarPlanilhaUsuariosCoordenacoes() {
  const [perfis, roles, coords, membros, vinculos] = await Promise.all([
    lerTudo<any>("profiles", "id, nome, email, ativo"),
    lerTudo<any>("user_roles", "id, user_id, role"),
    lerTudo<any>("coordenacoes", "id, nome"),
    lerTudo<Membro & { id: string }>("membros_coordenacao", "id, usuario_id, coordenacao_id, cargo"),
    lerTudo<VinculoProc & { id: string }>("processos_responsaveis", "id, processo_id, usuario_id, coordenacao_id, papel", (q) => q.eq("ativo", true)),
  ]);
  const agg = agregarVinculos(vinculos);
  const nomeCoord = new Map(coords.map((c: any) => [c.id, c.nome as string]));
  const perfil = new Map(perfis.map((p: any) => [p.id, p]));
  const rolesU = new Map<string, string[]>();
  roles.forEach((r: any) => rolesU.set(r.user_id, [...(rolesU.get(r.user_id) || []), PERFIL[r.role] || r.role]));
  const membrosU = new Map<string, Membro[]>();
  membros.forEach((m) => membrosU.set(m.usuario_id, [...(membrosU.get(m.usuario_id) || []), m]));
  const nome = (id: string) => perfil.get(id)?.nome || perfil.get(id)?.email || id;

  const wb = new ExcelJS.Workbook();
  wb.creator = "Juris Control";
  const agora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const font = { name: "Calibri", size: 11 };

  const aba = (titulo: string, nomeAba: string, cols: { h: string; w: number }[]) => {
    const ws = wb.addWorksheet(nomeAba, { views: [{ state: "frozen", ySplit: 3 }] });
    ws.columns = cols.map((c) => ({ width: c.w }));
    ws.mergeCells(1, 1, 1, cols.length);
    const t = ws.getCell(1, 1);
    t.value = titulo; t.font = { ...font, size: 14, bold: true, color: { argb: "FF1F3864" } };
    ws.mergeCells(2, 1, 2, cols.length);
    ws.getCell(2, 1).value = `Gerado em ${agora} (horário de Brasília)`;
    ws.getCell(2, 1).font = { ...font, italic: true, color: { argb: "FF666666" } };
    const hr = ws.getRow(3);
    cols.forEach((c, i) => {
      const cell = hr.getCell(i + 1);
      cell.value = c.h;
      cell.font = { ...font, bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F3864" } };
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    });
    hr.height = 30;
    ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: cols.length } };
    return ws;
  };
  const linha = (ws: ExcelJS.Worksheet, vals: any[], idx: number, destaque = false) => {
    const r = ws.addRow(vals);
    r.eachCell({ includeEmpty: true }, (c, n) => {
      c.font = { ...font, bold: destaque };
      c.alignment = { vertical: "middle", horizontal: typeof vals[n - 1] === "number" ? "center" : "left", wrapText: true };
      c.border = { bottom: { style: "thin", color: { argb: "FFD9D9D9" } } };
      if (destaque) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDDEBF7" } };
      else if (idx % 2) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F7FA" } };
    });
  };

  // Aba 1
  const ws1 = aba("Usuários – resumo geral", "Resumo por usuário", [
    { h: "Usuário", w: 34 }, { h: "E-mail", w: 34 }, { h: "Perfil geral", w: 22 }, { h: "Situação", w: 11 },
    { h: "Coordenações (cargo)", w: 60 }, { h: "Processos como responsável", w: 16 }, { h: "Processos como envolvido", w: 16 }, { h: "Total de processos", w: 14 },
  ]);
  [...perfis].sort((a: any, b: any) => (a.nome || "").localeCompare(b.nome || "", "pt-BR")).forEach((p: any, i) => {
    const g = agg.geral(p.id);
    const cs = (membrosU.get(p.id) || []).map((m) => `${nomeCoord.get(m.coordenacao_id) || "?"} (${rot(m.cargo)})`).sort().join("; ");
    linha(ws1, [p.nome || "", p.email || "", (rolesU.get(p.id) || []).join(", ") || "—", p.ativo === false ? "Inativo" : "Ativo", cs || "—", g.responsavel, g.envolvido, g.total], i);
  });

  // Aba 2
  const ws2 = aba("Usuários por coordenação", "Por coordenação", [
    { h: "Coordenação", w: 40 }, { h: "Usuário", w: 34 }, { h: "Cargo na coordenação", w: 26 }, { h: "Situação", w: 11 },
    { h: "Processos como responsável", w: 16 }, { h: "Processos como envolvido", w: 16 }, { h: "Total de processos", w: 14 },
  ]);
  const coordsOrd = [...coords].sort((a: any, b: any) => a.nome.localeCompare(b.nome, "pt-BR"));
  coordsOrd.forEach((c: any) => {
    const ms = membros.filter((m) => m.coordenacao_id === c.id).sort((a, b) => nome(a.usuario_id).localeCompare(nome(b.usuario_id), "pt-BR"));
    if (!ms.length) return;
    let sr = 0, se = 0;
    ms.forEach((m, i) => {
      const x = agg.coord(m.usuario_id, c.id); sr += x.responsavel; se += x.envolvido;
      linha(ws2, [c.nome, nome(m.usuario_id), rot(m.cargo), perfil.get(m.usuario_id)?.ativo === false ? "Inativo" : "Ativo", x.responsavel, x.envolvido, x.total], i);
    });
    linha(ws2, [`Subtotal – ${c.nome}`, `${ms.length} membro(s)`, "", "", sr, se, agg.processosCoord(c.id)], 0, true);
  });

  // Aba 3
  const cargos = [...new Set(membros.map((m) => m.cargo || ""))].sort();
  const ws3 = aba("Resumo das coordenações", "Resumo coordenações", [
    { h: "Coordenação", w: 40 }, { h: "Total de membros", w: 12 }, ...cargos.map((c) => ({ h: rot(c || null), w: 14 })), { h: "Processos com responsáveis", w: 16 },
  ]);
  coordsOrd.forEach((c: any, i) => {
    const ms = membros.filter((m) => m.coordenacao_id === c.id);
    linha(ws3, [c.nome, ms.length, ...cargos.map((k) => ms.filter((m) => (m.cargo || "") === k).length), agg.processosCoord(c.id)], i);
  });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const d = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }).replace(/\//g, "-");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `usuarios_por_coordenacao_${d}.xlsx`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
