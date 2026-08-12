import * as XLSX from "xlsx";
import { dataHoraBrt } from "@/utils/date";
import type { AuditoriaPdfParams, AuditoriaPdfRow } from "./relatorioAuditoriaCoordenacaoPdf";

const CAMPOS_DESTAQUE = ["responsavel_id", "responsaveis", "envolvidos", "status", "situacao"];

/** Gera a planilha Excel de auditoria da coordenação (mesmos dados do PDF). */
export function gerarRelatorioAuditoriaExcel({
  coordenacaoNome,
  periodo,
  tipoLabel,
  usuarioLabel,
  rows,
  labelCampo,
  formatValor,
}: AuditoriaPdfParams) {
  const linhas: any[] = [];
  const push = (r: AuditoriaPdfRow, campo: string | null, de: any, para: any) => {
    linhas.push({
      "DATA/HORA (BRT)": dataHoraBrt(r.created_at),
      "AUTOR": r.usuarioNome,
      "E-MAIL": r.usuarioEmail || "",
      "TIPO": r.tipo_item || "",
      "ITEM": r.titulo,
      "PROCESSO": r.processo || "",
      "AÇÃO": r.acao,
      "CAMPO ALTERADO": campo ? labelCampo(campo) : "",
      "VALOR ANTERIOR": campo ? formatValor(de) : "",
      "VALOR NOVO": campo ? formatValor(para) : "",
      "DESTAQUE": campo && CAMPOS_DESTAQUE.includes(campo) ? "SIM" : "",
      "ORIGEM": r.origem,
    });
  };

  for (const r of rows) {
    if (r.campos.length === 0) push(r, null, null, null);
    else for (const c of r.campos) push(r, c.campo, c.de, c.para);
  }

  const porUsuario = new Map<string, number>();
  const porCampo = new Map<string, number>();
  for (const r of rows) {
    porUsuario.set(r.usuarioNome, (porUsuario.get(r.usuarioNome) ?? 0) + 1);
    for (const c of r.campos) {
      const k = labelCampo(c.campo);
      porCampo.set(k, (porCampo.get(k) ?? 0) + 1);
    }
  }

  const resumo: any[][] = [
    ["Relatório de Auditoria da Coordenação"],
    ["Coordenação", coordenacaoNome],
    ["Período", periodo],
    ["Tipo de item", tipoLabel],
    ["Usuário", usuarioLabel],
    ["Gerado em (BRT)", dataHoraBrt(new Date())],
    ["Total de alterações", rows.length],
    [],
    ["Por usuário", "Quantidade"],
    ...Array.from(porUsuario.entries()).sort((a, b) => b[1] - a[1]),
    [],
    ["Campo alterado", "Quantidade"],
    ...Array.from(porCampo.entries()).sort((a, b) => b[1] - a[1]),
  ];

  const wb = XLSX.utils.book_new();
  const wsResumo = XLSX.utils.aoa_to_sheet(resumo);
  wsResumo["!cols"] = [{ wch: 32 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

  const ws = XLSX.utils.json_to_sheet(linhas);
  ws["!cols"] = [
    { wch: 18 }, { wch: 26 }, { wch: 32 }, { wch: 12 }, { wch: 45 },
    { wch: 24 }, { wch: 12 }, { wch: 22 }, { wch: 40 }, { wch: 40 },
    { wch: 10 }, { wch: 22 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "Alterações");

  const slug = coordenacaoNome.normalize("NFD").replace(/[^\w]+/g, "_").slice(0, 40);
  XLSX.writeFile(wb, `AUDITORIA_${slug || "COORDENACAO"}_${periodo.replace(/[^\d]+/g, "-")}.xlsx`);
}
