import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import { dataHoraBrt } from "@/utils/date";

export interface UsuarioRelatorio {
  id: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  oab: string | null;
  filial: string | null;
  area_principal: string | null;
  ativo: boolean | null;
  created_at: string | null;
  notificacoes_email: boolean | null;
  notificacoes_email_360: boolean | null;
  roleLabel: string;
}

interface Params {
  usuarios: UsuarioRelatorio[];
  filtroFilial?: string;
}

const dash = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v).trim();
  return s || "—";
};

const dataBr = (iso: string | null) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch {
    return "—";
  }
};

const telefoneBr = (tel: string | null) => {
  const d = (tel ?? "").replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return dash(tel);
};

/** Busca as coordenações de cada usuário (id -> nomes), com fallback na coordenação padrão. */
async function buscarCoordenacoes(ids: string[]): Promise<Record<string, string[]>> {
  const map: Record<string, string[]> = {};
  if (ids.length === 0) return map;
  try {
    const db = supabase as any;
    const [{ data: membros }, { data: perfis }] = await Promise.all([
      db.from("membros_coordenacao").select("user_id, coordenacao_id").in("user_id", ids),
      db.from("profiles").select("id, coordenacao_padrao_id").in("id", ids),
    ]);
    const coordIds = Array.from(
      new Set(
        [
          ...(membros ?? []).map((m: any) => m.coordenacao_id),
          ...(perfis ?? []).map((p: any) => p.coordenacao_padrao_id),
        ].filter(Boolean)
      )
    );
    if (coordIds.length === 0) return map;
    const { data: coords } = await db.from("coordenacoes").select("id, nome").in("id", coordIds);
    const nomes = new Map<string, string>(
      (coords ?? []).map((c: any) => [c.id as string, (c.nome as string) ?? ""])
    );
    (membros ?? []).forEach((m: any) => {
      const nome = nomes.get(m.coordenacao_id);
      if (!nome) return;
      const atuais = map[m.user_id] ?? [];
      if (!atuais.includes(nome)) map[m.user_id] = [...atuais, nome];
    });
    (perfis ?? []).forEach((p: any) => {
      const nome = p.coordenacao_padrao_id ? nomes.get(p.coordenacao_padrao_id) : null;
      if (!nome) return;
      const atuais = map[p.id] ?? [];
      if (!atuais.includes(nome)) map[p.id] = [...atuais, nome];
    });
  } catch {
    /* coordenações são complementares; segue sem elas */
  }
  return map;
}


/** Gera o relatório profissional de usuários cadastrados (sem dados de senha). */
export async function gerarRelatorioUsuariosPdf({ usuarios, filtroFilial }: Params) {
  const coordMap = await buscarCoordenacoes(usuarios.map((u) => u.id));

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const largura = doc.internal.pageSize.getWidth();
  const altura = doc.internal.pageSize.getHeight();

  // ---- Cabeçalho
  doc.setFillColor(23, 37, 84);
  doc.rect(0, 0, largura, 70, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Relatório de Usuários Cadastrados", 40, 32);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    `Filial: ${filtroFilial && filtroFilial !== "todas" ? filtroFilial : "Todas"}`,
    40,
    52
  );
  doc.text(`Gerado em: ${dataHoraBrt(new Date())} (BRT)`, largura - 40, 32, { align: "right" });
  doc.text("Documento interno — não contém credenciais de acesso", largura - 40, 52, {
    align: "right",
  });
  doc.setTextColor(0, 0, 0);

  // ---- Sumário
  const ativos = usuarios.filter((u) => u.ativo !== false).length;
  const inativos = usuarios.length - ativos;
  const comOab = usuarios.filter((u) => (u.oab ?? "").trim()).length;
  const porPerfil = new Map<string, number>();
  usuarios.forEach((u) => porPerfil.set(u.roleLabel, (porPerfil.get(u.roleLabel) ?? 0) + 1));
  const perfis = Array.from(porPerfil.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([p, q]) => `${p}: ${q}`)
    .join("   ·   ");

  const porCoordenacao = new Map<string, number>();
  usuarios.forEach((u) => {
    const nomes = coordMap[u.id] ?? [];
    if (nomes.length === 0) {
      porCoordenacao.set("Sem coordenação", (porCoordenacao.get("Sem coordenação") ?? 0) + 1);
      return;
    }
    nomes.forEach((n) => porCoordenacao.set(n, (porCoordenacao.get(n) ?? 0) + 1));
  });
  const coordenacoesResumo = Array.from(porCoordenacao.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([c, q]) => `${c}: ${q}`)
    .join("   ·   ");

  autoTable(doc, {
    startY: 88,
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 5, lineColor: [210, 214, 220], textColor: 30 },
    headStyles: { fillColor: [241, 245, 249], textColor: 30, fontStyle: "bold" },
    body: [
      ["Total de usuários", String(usuarios.length)],
      ["Ativos", String(ativos)],
      ["Inativos", String(inativos)],
      ["Com OAB cadastrada", String(comOab)],
      ["Distribuição por perfil", perfis || "—"],
      ["Distribuição por coordenação", coordenacoesResumo || "—"],
    ],
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 150 } },
    margin: { left: 40, right: 40 },
  });


  const afterResumo = (doc as any).lastAutoTable?.finalY ?? 120;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Relação de usuários", 40, afterResumo + 24);

  // ---- Tabela principal
  const body = usuarios.map((u, i) => [
    String(i + 1),
    dash(u.nome),
    dash(u.email),
    telefoneBr(u.telefone),
    dash(u.oab),
    dash(u.filial),
    u.roleLabel,
    dash(u.area_principal),
    (coordMap[u.id] ?? []).join(", ") || "—",
    u.ativo === false ? "Inativo" : "Ativo",
    [
      u.notificacoes_email ? "E-mail" : null,
      u.notificacoes_email_360 ? "360" : null,
    ]
      .filter(Boolean)
      .join(" / ") || "—",
    dataBr(u.created_at),
  ]);

  autoTable(doc, {
    startY: afterResumo + 34,
    head: [
      [
        "#",
        "Nome",
        "E-mail",
        "Telefone",
        "OAB",
        "Filial",
        "Perfil",
        "Área",
        "Coordenações",
        "Status",
        "Notificações",
        "Cadastro",
      ],
    ],
    body,
    theme: "striped",
    styles: {
      fontSize: 7,
      cellPadding: 3,
      overflow: "linebreak",
      lineColor: [220, 224, 230],
      lineWidth: 0.4,
      textColor: 30,
    },
    headStyles: { fillColor: [23, 37, 84], textColor: 255, fontStyle: "bold", fontSize: 7 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    // Largura útil A4 paisagem = 842 - 2*30 = 782pt. Somatório abaixo = 778pt.
    columnStyles: {
      0: { cellWidth: 20, halign: "right" },
      1: { cellWidth: 105 },
      2: { cellWidth: 132 },
      3: { cellWidth: 70 },
      4: { cellWidth: 44 },
      5: { cellWidth: 48 },
      6: { cellWidth: 80 },
      7: { cellWidth: 50 },
      8: { cellWidth: 90 },
      9: { cellWidth: 36 },
      10: { cellWidth: 46 },
      11: { cellWidth: 45 },
    },
    margin: { left: 30, right: 30, top: 60 },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 9 && data.cell.raw === "Inativo") {
        data.cell.styles.textColor = [185, 28, 28];
        data.cell.styles.fontStyle = "bold";
      }
    },
    didDrawPage: () => {
      const pagina = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text("Relatório de Usuários Cadastrados", 40, altura - 20);
      doc.text(`Página ${pagina}`, largura - 40, altura - 20, { align: "right" });
      doc.setTextColor(0, 0, 0);
    },
  });

  const dataArquivo = new Date().toISOString().slice(0, 10);
  doc.save(`relatorio-usuarios-${dataArquivo}.pdf`);
}
