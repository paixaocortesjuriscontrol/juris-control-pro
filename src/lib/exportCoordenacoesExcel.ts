import ExcelJS from "exceljs";
import { supabase } from "@/integrations/supabase/client";

const NAVY = "FF111B34";
const GOLD = "FFD9A91C";
const LIGHT = "FFF2F5FA";
const PLACEHOLDER_LABEL = "Importado de outro Sistema/ sem acesso ao Sistema";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  coordenador: "Coordenador",
  advogado: "Advogado",
  advogado_senior: "Advogado Sênior",
  assistente: "Assistente",
  estagiario: "Estagiário",
  secretaria: "Secretária",
  assistente_coordenador: "Assistente Coordenador",
  advogado_temporario: "Advogado Temporário",
  cliente: "Cliente",
};

const CARGO_LABELS: Record<string, string> = {
  coordenador: "Coordenador",
  assistente_coordenador: "Assistente Coordenador",
  advogado_senior: "Advogado Sênior",
  advogado: "Advogado",
  estagiario: "Estagiário",
  assistente: "Assistente",
  secretaria: "Secretária",
};

function formatarEmail(email?: string | null): string {
  if (!email) return "—";
  if (email.toLowerCase().includes("placeholder") || email.endsWith("@sistema.local")) {
    return PLACEHOLDER_LABEL;
  }
  return email;
}

function styleHeader(ws: ExcelJS.Worksheet, row: number, cols: number) {
  const r = ws.getRow(row);
  for (let c = 1; c <= cols; c++) {
    const cell = r.getCell(c);
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Arial", size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      top: { style: "thin", color: { argb: "FFCCCCCC" } },
      bottom: { style: "thin", color: { argb: "FFCCCCCC" } },
      left: { style: "thin", color: { argb: "FFCCCCCC" } },
      right: { style: "thin", color: { argb: "FFCCCCCC" } },
    };
  }
  r.height = 20;
}

export async function exportarCoordenacoesExcel() {
  const [{ data: coords, error: e1 }, { data: membros, error: e2 }, { data: perfis, error: e3 }, { data: roles, error: e4 }] =
    await Promise.all([
      supabase.from("coordenacoes").select("id, nome, area, coordenador_id").order("nome"),
      supabase.from("membros_coordenacao").select("coordenacao_id, usuario_id, cargo"),
      supabase.from("profiles").select("id, nome, email"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
  if (e1) throw e1;
  if (e2) throw e2;
  if (e3) throw e3;
  if (e4) throw e4;

  const perfilMap = new Map((perfis || []).map((p) => [p.id, p]));
  const roleMap = new Map<string, string[]>();
  (roles || []).forEach((r) => {
    const list = roleMap.get(r.user_id) || [];
    list.push(ROLE_LABELS[r.role] || r.role);
    roleMap.set(r.user_id, list);
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Juris Control Pro";

  // ===== Aba 1: Coordenações e Usuários =====
  const ws = wb.addWorksheet("Coordenações e Usuários");
  ws.columns = [
    { width: 32 }, { width: 14 }, { width: 30 }, { width: 42 },
    { width: 22 }, { width: 24 }, { width: 18 },
  ];

  ws.mergeCells("A1:G1");
  const titulo = ws.getCell("A1");
  titulo.value = "Coordenações, Usuários e Cargos";
  titulo.font = { bold: true, size: 14, color: { argb: NAVY }, name: "Arial" };
  ws.mergeCells("A2:G2");
  const subtitulo = ws.getCell("A2");
  const agora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  subtitulo.value = `Gerado em ${agora} (horário de Brasília)`;
  subtitulo.font = { size: 9, italic: true, color: { argb: "FF666666" }, name: "Arial" };

  const headers = ["Coordenação", "Área", "Usuário", "E-mail", "Cargo no Sistema", "Cargo na Coordenação", "Coordenador Titular"];
  ws.getRow(4).values = headers;
  styleHeader(ws, 4, headers.length);

  let rowIdx = 5;
  let zebra = false;
  for (const coord of coords || []) {
    const membrosDaCoord = (membros || []).filter((m) => m.coordenacao_id === coord.id);
    const titularId = coord.coordenador_id;
    const titularNoElenco = titularId && membrosDaCoord.some((m) => m.usuario_id === titularId);

    const linhas: Array<{ usuarioId: string; cargo: string | null; titular: boolean }> = membrosDaCoord.map((m) => ({
      usuarioId: m.usuario_id,
      cargo: m.cargo,
      titular: m.usuario_id === titularId,
    }));
    if (titularId && !titularNoElenco) {
      linhas.unshift({ usuarioId: titularId, cargo: "coordenador", titular: true });
    }

    if (linhas.length === 0) {
      const r = ws.getRow(rowIdx);
      r.values = [coord.nome, coord.area || "—", "(sem membros)", "—", "—", "—", "—"];
      r.font = { name: "Arial", size: 10, italic: true, color: { argb: "FF888888" } };
      if (zebra) r.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT } }));
      rowIdx++;
      zebra = !zebra;
      continue;
    }

    for (const linha of linhas) {
      const perfil = perfilMap.get(linha.usuarioId);
      const cargoSistema = (roleMap.get(linha.usuarioId) || []).join(", ") || "—";
      const cargoCoord = linha.cargo ? CARGO_LABELS[linha.cargo] || linha.cargo : "Membro";
      const r = ws.getRow(rowIdx);
      r.values = [
        coord.nome,
        coord.area || "—",
        perfil?.nome || "Sem nome",
        formatarEmail(perfil?.email),
        cargoSistema,
        cargoCoord,
        linha.titular ? "Sim" : "Não",
      ];
      r.font = { name: "Arial", size: 10 };
      if (zebra) r.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT } }));
      if (linha.titular) {
        r.getCell(7).font = { name: "Arial", size: 10, bold: true, color: { argb: GOLD } };
      }
      rowIdx++;
    }
    zebra = !zebra;
  }

  ws.autoFilter = { from: "A4", to: `G${rowIdx - 1}` };
  ws.views = [{ state: "frozen", ySplit: 4 }];

  // ===== Aba 2: Resumo por Coordenação =====
  const ws2 = wb.addWorksheet("Resumo por Coordenação");
  ws2.columns = [{ width: 36 }, { width: 16 }, { width: 16 }, { width: 30 }];
  ws2.mergeCells("A1:D1");
  const t2 = ws2.getCell("A1");
  t2.value = "Resumo por Coordenação";
  t2.font = { bold: true, size: 14, color: { argb: NAVY }, name: "Arial" };
  ws2.getRow(3).values = ["Coordenação", "Área", "Total de Membros", "Coordenador Titular"];
  styleHeader(ws2, 3, 4);

  let r2 = 4;
  for (const coord of coords || []) {
    const total = (membros || []).filter((m) => m.coordenacao_id === coord.id).length;
    const titular = coord.coordenador_id ? perfilMap.get(coord.coordenador_id)?.nome || "—" : "—";
    const r = ws2.getRow(r2);
    r.values = [coord.nome, coord.area || "—", total, titular];
    r.font = { name: "Arial", size: 10 };
    if (r2 % 2 === 0) r.eachCell((c) => (c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT } }));
    r2++;
  }
  ws2.autoFilter = { from: "A3", to: `D${r2 - 1}` };
  ws2.views = [{ state: "frozen", ySplit: 3 }];

  const buf = await wb.xlsx.writeBuffer();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  a.download = `coordenacoes_usuarios_cargos_${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(a.href);
}
