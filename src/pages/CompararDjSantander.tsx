import { useState, useCallback, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Upload, FileText, FileCheck, AlertTriangle, CheckCircle2, XCircle, ArrowRightLeft, Download, Database, CalendarIcon, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import JSZip from "jszip";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";

interface ComparisonResult {
  processos_doc: string[];
  processos_pdf: string[];
  comuns: string[];
  somente_doc: string[];
  somente_pdf: string[];
}

interface Coordenacao {
  id: string;
  nome: string;
}

interface MonitoramentoConfig {
  id: string;
  tipo: string;
  oab: string | null;
  uf: string | null;
  termo_busca: string | null;
  termos_or: string[] | null;
  exclusoes: string[] | null;
  tribunais: string[] | null;
  buscar_parte: boolean | null;
}

interface AnaliseProcesso {
  loading: boolean;
  motivos: string[];
}

interface TipoCounts {
  pauta: number;
  distribuicao: number;
  cejusc: number;
  outros: number;
  repetidos: number;
  total: number;
  pautaList: string[];
  distribuicaoList: string[];
  cejuscList: string[];
}

// Classifica cada bloco de publicação OLHANDO SÓ NO TÍTULO/CABEÇALHO
// (primeiras linhas após o cabeçalho do processo), nunca no conteúdo do corpo.
// Tipos:
//   - Pauta de Julgamento  → "Pauta de Julgamento"
//   - Lista de Distribuição → "Lista de Distribuição"
//   - CEJUSC-TST            → "CEJUSC"
function classificarTiposPorTitulo(texto: string): TipoCounts {
  const linhas = texto.replace(/\u00a0/g, " ").split(/\r?\n+/);
  // Detecta o tipo de cabeçalho que aparece no documento.
  // Em PDF Resumo cada bloco começa com "COMUNICAÇÃO PJE #..." e tem
  // uma linha interna "Processo NNNN" da tabela — não podemos contar
  // as duas como início de bloco.
  let hasComunicacao = false;
  let hasProcessoDj = false;
  for (const linha of linhas) {
    const limpa = normalizarLinha(linha);
    if (COMUNICACAO_PJE_TITULO_REGEX.test(limpa)) { hasComunicacao = true; break; }
    if (PROCESSO_DJ_TITULO_REGEX.test(colarCnjNaLinha(limpa))) hasProcessoDj = true;
  }

  const isHeader = (limpa: string) => {
    if (hasComunicacao) return COMUNICACAO_PJE_TITULO_REGEX.test(limpa);
    if (hasProcessoDj) return PROCESSO_DJ_TITULO_REGEX.test(colarCnjNaLinha(limpa));
    return PROCESSO_TITULO_REGEX.test(limpa);
  };

  const blocos: string[][] = [];
  let atual: string[] | null = null;
  for (const linha of linhas) {
    const limpa = normalizarLinha(linha);
    if (isHeader(limpa)) {
      if (atual) blocos.push(atual);
      atual = [limpa];
    } else if (atual) {
      atual.push(linha);
    }
  }
  if (atual) blocos.push(atual);

  let pauta = 0, distribuicao = 0, cejusc = 0, outros = 0;
  const pautaList: string[] = [];
  const distribuicaoList: string[] = [];
  const cejuscList: string[] = [];
  for (const bloco of blocos) {
    const header = colarCnjNaLinha(bloco[0] || "");
    const m = header.match(/(\d{20}|\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/);
    const corpoCompleto = bloco.join("\n");
    const cnjFormatado = m ? formatarCNJ(m[1]) : null;
    // Varre o bloco INTEIRO buscando marcadores de tipo.
    // Regras alinhadas ao botão "Docs TST" da tela Análise DJEN
    // (handleGerarDocsTST). Ordem de prioridade — primeira que casar vence:
    //  1. CEJUSC        → "CEJUSC" presente E "plataforma zoom" no corpo
    //  2. DISTRIBUIÇÕES → "Lista de Distribuição" no corpo
    //  3. PAUTA         → "Pauta de Julgamento" no corpo (e não é CEJUSC)
    //  4. OUTROS        → default
    const temCejusc = /\bCEJUSC\b/i.test(corpoCompleto);
    if (temCejusc && /plataforma\s+zoom/i.test(corpoCompleto)) {
      cejusc++;
      if (cnjFormatado) cejuscList.push(cnjFormatado);
    } else if (/Lista\s+de\s+Distribui[cç][aã]o/i.test(corpoCompleto)) {
      distribuicao++;
      if (cnjFormatado) distribuicaoList.push(cnjFormatado);
    } else if (!temCejusc && /Pauta\s+de\s+Julgamento/i.test(corpoCompleto)) {
      pauta++;
      if (cnjFormatado) pautaList.push(cnjFormatado);
    } else {
      outros++;
    }
  }

  const ordenarPorCNJ = (a: string, b: string) => {
    const na = a.replace(/\D/g, "");
    const nb = b.replace(/\D/g, "");
    return na.localeCompare(nb);
  };

  // Repetidos = total de ocorrências EXTRAS (2ª, 3ª…) de cada CNJ
  // dentro das listas exibidas (CEJUSC + Pauta + Distribuição).
  const todasExibidas = [...cejuscList, ...pautaList, ...distribuicaoList];
  const contagemExibidas = new Map<string, number>();
  for (const c of todasExibidas) contagemExibidas.set(c, (contagemExibidas.get(c) || 0) + 1);
  let repetidos = 0;
  for (const n of contagemExibidas.values()) if (n > 1) repetidos += n - 1;

  return {
    pauta, distribuicao, cejusc, outros, repetidos,
    total: blocos.length,
    pautaList: pautaList.sort(ordenarPorCNJ),
    distribuicaoList: distribuicaoList.sort(ordenarPorCNJ),
    cejuscList: cejuscList.sort(ordenarPorCNJ),
  };
}

// Extrai o texto plano de um DOCX preservando quebras de parágrafo,
// para podermos analisar os títulos linha-a-linha.
async function extrairTextoDocx(arrayBuffer: ArrayBuffer): Promise<string> {
  const zip = await JSZip.loadAsync(arrayBuffer.slice(0));
  const xml = await zip.file("word/document.xml")?.async("string");
  if (!xml) return "";
  const parsed = new DOMParser().parseFromString(xml, "application/xml");
  const paragrafos = Array.from(parsed.getElementsByTagNameNS(WORD_NS, "p"));
  return paragrafos
    .map((p) => descendentesPorNome(p, "t").map((t) => t.textContent || "").join(""))
    .join("\n");
}

function formatarCNJ(numero: string): string {
  const digits = numero.replace(/\D/g, "");
  if (digits.length === 20) {
    return `${digits.slice(0, 7)}-${digits.slice(7, 9)}.${digits.slice(9, 13)}.${digits.slice(13, 14)}.${digits.slice(14, 16)}.${digits.slice(16, 20)}`;
  }
  return numero;
}

// Títulos de publicação (cabeçalhos em NEGRITO no DOCX). Aceitamos os dois formatos:
//   "COMUNICAÇÃO PJE #<CNJ>"  e  "Processo <CNJ>"
// No DOC: só conta se o parágrafo inteiro do título estiver em negrito.
// No PDF/texto plano: conta linhas curtas que sejam SÓ o título (sem corpo de decisão).
const CNJ_PATTERN = "(\\d{7}-\\d{2}\\.\\d{4}\\.\\d\\.\\d{2}\\.\\d{4}|\\d{20})";
const COMUNICACAO_PJE_TITULO_REGEX = new RegExp(`^\\s*COMUNICA[CÇ][AÃ]O\\s+PJE\\s*#?\\s*${CNJ_PATTERN}\\s*$`, "i");
const PROCESSO_TITULO_REGEX = new RegExp(`^\\s*Processo\\s*(?:n[ºo°.]?\\s*)?[:#-]?\\s*${CNJ_PATTERN}\\s*$`, "i");
const COMUNICACAO_PJE_INLINE_REGEX = new RegExp(`COMUNICA[CÇ][AÃ]O\\s+PJE\\s*#?\\s*${CNJ_PATTERN}`, "gi");
const PROCESSO_DJ_TITULO_REGEX = new RegExp(`^\\s*(?:N[ºo°.]\\s*)?Processo\\s*(?:n[ºo°.]?\\s*)?[:#-]?\\s*${CNJ_PATTERN}\\s*$`, "i");

// pdfjs costuma quebrar o CNJ ("0730933 - 03.2024...") ou inserir espaços no meio
// dos dígitos ("001 6"). Cola tudo de novo antes do regex.
function colarCnjNaLinha(linha: string): string {
  let anterior;
  let atual = linha;
  do {
    anterior = atual;
    atual = atual.replace(/(\d)\s+(\d)/g, "$1$2").replace(/\s*([.\-])\s*/g, "$1");
  } while (atual !== anterior);
  return atual;
}

function normalizarLinha(texto: string): string {
  return texto.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

const WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

function nomeLocal(node: Element): string {
  return node.localName || node.nodeName.split(":").pop() || "";
}

function filhosPorNome(el: Element, nome: string): Element[] {
  return Array.from(el.children).filter((child) => nomeLocal(child) === nome);
}

function descendentesPorNome(el: Element, nome: string): Element[] {
  return Array.from(el.getElementsByTagNameNS(WORD_NS, nome));
}

function atributoWord(el: Element, nome: string): string | null {
  return el.getAttributeNS(WORD_NS, nome) ?? el.getAttribute(`w:${nome}`) ?? el.getAttribute(nome);
}

function valorBoldAtivo(el: Element): boolean {
  const val = atributoWord(el, "val");
  return val === null || !["0", "false", "off"].includes(val.toLowerCase());
}

function propriedadesTemNegrito(rPr?: Element): boolean {
  if (!rPr) return false;
  const bold = filhosPorNome(rPr, "b").find(valorBoldAtivo);
  const boldCs = filhosPorNome(rPr, "bCs").find(valorBoldAtivo);
  return Boolean(bold || boldCs);
}

function textoRun(run: Element): string {
  return descendentesPorNome(run, "t").map((t) => t.textContent || "").join("");
}

function textoNegritoExplicito(paragrafo: Element): string {
  return descendentesPorNome(paragrafo, "r")
    .filter((run) => propriedadesTemNegrito(filhosPorNome(run, "rPr")[0]))
    .map(textoRun)
    .join("");
}

function extrairProcessosDocxTitulosNegritoXml(xml: string): string[] {
  const matches: string[] = [];
  const parsed = new DOMParser().parseFromString(xml, "application/xml");
  const paragrafos = Array.from(parsed.getElementsByTagNameNS(WORD_NS, "p"));

  for (const paragrafo of paragrafos) {
    const texto = normalizarLinha(descendentesPorNome(paragrafo, "t").map((t) => t.textContent || "").join(""));
    if (!texto) continue;

    const comunicacao = texto.match(COMUNICACAO_PJE_TITULO_REGEX);
    const processo = texto.match(PROCESSO_TITULO_REGEX);
    if (!comunicacao && !processo) continue;

    // Conta só se o próprio texto do título (Processo/COMUNICAÇÃO + número)
    // estiver em runs explicitamente negritados. Não usa negrito herdado do
    // parágrafo, porque isso estava deixando linhas do corpo entrarem como título.
    const negrito = normalizarLinha(textoNegritoExplicito(paragrafo));
    if (negrito === texto) matches.push(formatarCNJ((comunicacao ?? processo)![1]));
  }

  // Não deduplica: contagem reflete blocos reais no documento.
  return matches;
}

async function extrairProcessosDocxTitulosNegrito(arrayBuffer: ArrayBuffer): Promise<string[]> {
  const zip = await JSZip.loadAsync(arrayBuffer.slice(0));
  const documentXml = await zip.file("word/document.xml")?.async("string");
  if (!documentXml) throw new Error("Arquivo DOCX sem word/document.xml");
  return extrairProcessosDocxTitulosNegritoXml(documentXml);
}

function extrairProcessos(texto: string, options: { permitirComunicacaoInline?: boolean } = {}): string[] {
  const comunicacoes: string[] = [];
  const processos: string[] = [];
  const linhas = texto.replace(/\u00a0/g, " ").split(/\r?\n+/);

  for (const linha of linhas) {
    const limpa = normalizarLinha(linha);
    const comunicacao = limpa.match(COMUNICACAO_PJE_TITULO_REGEX);
    if (comunicacao) {
      comunicacoes.push(formatarCNJ(comunicacao[1]));
      continue;
    }
    const processo = limpa.match(PROCESSO_TITULO_REGEX);
    if (processo) processos.push(formatarCNJ(processo[1]));
  }

  // Prioriza títulos "COMUNICAÇÃO PJE #..." (1 por bloco no PDF Resumo).
  // Se não houver nenhum, cai para linhas "Processo NNN" (formato antigo).
  if (comunicacoes.length > 0) return comunicacoes;
  if (processos.length > 0) return processos;

  // Fallback inline: PDFs sem quebra de linha real entre títulos.
  if (options.permitirComunicacaoInline) {
    const inline: string[] = [];
    COMUNICACAO_PJE_INLINE_REGEX.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = COMUNICACAO_PJE_INLINE_REGEX.exec(texto)) !== null) inline.push(formatarCNJ(m[1]));
    COMUNICACAO_PJE_INLINE_REGEX.lastIndex = 0;
    return inline;
  }

  return [];
}

function extrairProcessosTitulosPdfDiario(texto: string): string[] {
  const matches: string[] = [];
  const linhas = texto.replace(/\u00a0/g, " ").split(/\r?\n+/);
  for (const linha of linhas) {
    const limpa = colarCnjNaLinha(normalizarLinha(linha));
    const m = limpa.match(PROCESSO_DJ_TITULO_REGEX);
    if (m) matches.push(formatarCNJ(m[1]));
  }
  return matches;
}

async function extrairTextoPdf(arrayBuffer: ArrayBuffer): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    // Reconstruir linhas usando a posição Y dos itens
    const lines = new Map<number, string[]>();
    for (const item of content.items as any[]) {
      const y = Math.round(item.transform?.[5] ?? 0);
      if (!lines.has(y)) lines.set(y, []);
      lines.get(y)!.push(item.str);
    }
    const sorted = [...lines.entries()].sort((a, b) => b[0] - a[0]);
    text += sorted.map(([, parts]) => parts.join(" ")).join("\n") + "\n";
  }
  return text;
}

function compararListas(processosDoc: string[], processosPdf: string[]): ComparisonResult {
  const normalize = (p: string) => p.replace(/\D/g, "");
  const setDoc = new Set(processosDoc.map(normalize));
  const setPdf = new Set(processosPdf.map(normalize));
  const docMap = new Map<string, string>();
  processosDoc.forEach(p => docMap.set(normalize(p), p));
  const pdfMap = new Map<string, string>();
  processosPdf.forEach(p => pdfMap.set(normalize(p), p));

  const comuns: string[] = [];
  const somente_doc: string[] = [];
  const somente_pdf: string[] = [];

  for (const [norm, orig] of docMap) {
    if (setPdf.has(norm)) comuns.push(orig);
    else somente_doc.push(orig);
  }
  for (const [norm, orig] of pdfMap) {
    if (!setDoc.has(norm)) somente_pdf.push(orig);
  }

  return { processos_doc: processosDoc, processos_pdf: processosPdf, comuns, somente_doc, somente_pdf };
}

function exportarPdf(
  result: ComparisonResult,
  docFileName: string,
  pdfFileName: string,
  analise: Record<string, AnaliseProcesso> = {},
  opts: {
    leftLabel?: string;
    sourceLabel?: string;
    tiposEsq?: TipoCounts | null;
    tiposDir?: TipoCounts | null;
  } = {},
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const mL = 14;
  const mR = 14;
  const contentW = pageWidth - mL - mR;
  let y = 0;

  const leftLabel = opts.leftLabel || "DOC";
  const sourceLabel = opts.sourceLabel || "Fonte";
  const tiposEsq = opts.tiposEsq || null;
  const tiposDir = opts.tiposDir || null;

  const checkPage = (needed: number) => {
    if (y + needed > pageHeight - 15) { doc.addPage(); y = 20; }
  };

  // ----- Header colorido -----
  const drawHeader = () => {
    doc.setFillColor(30, 58, 95); // azul-marinho
    doc.rect(0, 0, pageWidth, 26, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Relatório • Comparar DJEN", pageWidth / 2, 12, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const dataStr = `${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR")}`;
    doc.text(dataStr, pageWidth / 2, 19, { align: "center" });
    doc.setTextColor(0, 0, 0);
    y = 32;
  };
  drawHeader();

  // ----- Box com nomes dos arquivos -----
  doc.setFillColor(245, 247, 250);
  doc.setDrawColor(220);
  doc.roundedRect(mL, y, contentW, 14, 2, 2, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(`${leftLabel}:`, mL + 3, y + 5.5);
  doc.text(`${sourceLabel}:`, mL + 3, y + 11);
  doc.setFont("helvetica", "normal");
  doc.text(doc.splitTextToSize(docFileName, contentW - 30)[0] || "—", mL + 24, y + 5.5);
  doc.text(doc.splitTextToSize(pdfFileName, contentW - 30)[0] || "—", mL + 24, y + 11);
  y += 20;

  // ----- Cards de totalizadores (5 colunas) -----
  type CardSpec = { label: string; value: number; fill: [number, number, number]; border: [number, number, number]; text: [number, number, number] };
  const cards: CardSpec[] = [
    { label: `Processos no ${leftLabel}`, value: result.processos_doc.length, fill: [239, 246, 255], border: [191, 219, 254], text: [37, 99, 235] },
    { label: `Processos no ${sourceLabel}`, value: result.processos_pdf.length, fill: [254, 242, 242], border: [254, 202, 202], text: [220, 38, 38] },
    { label: "Em Comum", value: result.comuns.length, fill: [240, 253, 244], border: [187, 247, 208], text: [22, 163, 74] },
    { label: `Somente no ${leftLabel}`, value: result.somente_doc.length, fill: [255, 251, 235], border: [253, 230, 138], text: [217, 119, 6] },
    { label: `Somente no ${sourceLabel}`, value: result.somente_pdf.length, fill: [255, 247, 237], border: [254, 215, 170], text: [234, 88, 12] },
  ];
  const cardGap = 3;
  const cardW = (contentW - cardGap * (cards.length - 1)) / cards.length;
  const cardH = 28;
  cards.forEach((c, i) => {
    const x = mL + i * (cardW + cardGap);
    doc.setFillColor(...c.fill);
    doc.setDrawColor(...c.border);
    doc.setLineWidth(0.5);
    doc.roundedRect(x, y, cardW, cardH, 2, 2, "FD");
    doc.setTextColor(...c.text);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(String(c.value), x + cardW / 2, y + 11, { align: "center" });
    doc.setTextColor(80, 80, 80);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    const lab = doc.splitTextToSize(c.label, cardW - 4).slice(0, 2);
    lab.forEach((line: string, idx: number) => {
      doc.text(line, x + cardW / 2, y + 18 + idx * 3.2, { align: "center" });
    });
  });
  doc.setTextColor(0, 0, 0);
  y += cardH + 8;

  // ----- Classificação por título -----
  if (tiposEsq || tiposDir) {
    checkPage(40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 58, 95);
    doc.text("Classificação por título", mL, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(110);
    doc.text("Contagem baseada exclusivamente no título/cabeçalho de cada publicação (não analisa o corpo).", mL, y);
    y += 5;
    doc.setTextColor(0, 0, 0);

    const headers = ["Documento", "CEJUSC-TST", "Pauta de Julgamento", "Lista de Distribuição", "Outros", "Repetidos", "Total"];
    const colWs = [38, 22, 30, 32, 20, 22, contentW - (38 + 22 + 30 + 32 + 20 + 22)];
    const rowH = 8;
    const headerH = 12;
    // Header row
    doc.setFillColor(30, 58, 95);
    doc.rect(mL, y, contentW, headerH, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    let cx = mL;
    headers.forEach((h, i) => {
      const align = i === 0 ? "left" : "right";
      const xText = i === 0 ? cx + 2 : cx + colWs[i] - 2;
      const lines = doc.splitTextToSize(h, colWs[i] - 3).slice(0, 2);
      const startY = y + (lines.length === 1 ? 7.5 : 5);
      lines.forEach((ln: string, idx: number) => {
        doc.text(ln, xText, startY + idx * 3.2, { align: align as any });
      });
      cx += colWs[i];
    });
    y += headerH;
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");

    const renderTipoRow = (label: string, t: TipoCounts, alt: boolean) => {
      if (alt) {
        doc.setFillColor(248, 250, 252);
        doc.rect(mL, y, contentW, rowH, "F");
      }
      const vals = [label, String(t.cejusc), String(t.pauta), String(t.distribuicao), String(t.outros), String(t.repetidos), String(t.total)];
      let xc = mL;
      vals.forEach((v, i) => {
        const align = i === 0 ? "left" : "right";
        const xText = i === 0 ? xc + 2 : xc + colWs[i] - 2;
        if (i === vals.length - 1) doc.setFont("helvetica", "bold");
        else doc.setFont("helvetica", "normal");
        doc.text(v, xText, y + 5.5, { align: align as any });
        xc += colWs[i];
      });
      doc.setDrawColor(220);
      doc.line(mL, y + rowH, mL + contentW, y + rowH);
      y += rowH;
    };
    if (tiposEsq) renderTipoRow(leftLabel, tiposEsq, false);
    if (tiposDir) renderTipoRow(sourceLabel, tiposDir, true);
    y += 8;

    // ----- Listas de CNJs por tipo (Pauta, Distribuição, CEJUSC) -----
    const renderListaTipo = (
      titulo: string,
      items: string[],
      color: [number, number, number],
      sameRemaining?: Map<string, number> | null,
      anyRemaining?: Map<string, number> | null,
      selfCounts?: Map<string, number> | null,
      selfSeen?: Map<string, number> | null,
    ) => {
      if (!items || items.length === 0) return;
      checkPage(14);
      // Header pill (cor do tipo)
      doc.setFillColor(color[0], color[1], color[2]);
      doc.roundedRect(mL, y, contentW, 6.5, 1.2, 1.2, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text(`${titulo}  (${items.length})`, mL + 3, y + 4.5);
      y += 9;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.8);
      const cols = 3;
      const gap = 2.5;
      const colW = (contentW - gap * (cols - 1)) / cols;
      const rowH = 5.2;
      const rows = Math.ceil(items.length / cols);
      for (let r = 0; r < rows; r++) {
        checkPage(rowH + 1);
        for (let c = 0; c < cols; c++) {
          const idx = r * cols + c;
          if (idx >= items.length) continue;
          const item = items[idx];
          let estado: "ok" | "outro" | "ausente" = "ok";
          if (sameRemaining && anyRemaining) {
            const nSame = sameRemaining.get(item) || 0;
            if (nSame > 0) {
              estado = "ok";
              sameRemaining.set(item, nSame - 1);
              anyRemaining.set(item, (anyRemaining.get(item) || 0) - 1);
            } else {
              const nAny = anyRemaining.get(item) || 0;
              if (nAny > 0) {
                estado = "outro";
                anyRemaining.set(item, nAny - 1);
              } else {
                estado = "ausente";
              }
            }
          }
          // Cores do badge (espelhando a tela)
          let bg: [number, number, number];
          let border: [number, number, number];
          let fg: [number, number, number];
          if (estado === "ausente") {
            bg = [254, 242, 242]; border = [252, 165, 165]; fg = [185, 28, 28];
          } else if (estado === "outro") {
            bg = [255, 251, 235]; border = [253, 224, 71]; fg = [180, 83, 9];
          } else {
            // tom claro do tipo + texto escuro do tipo
            bg = [
              Math.round(color[0] + (255 - color[0]) * 0.88),
              Math.round(color[1] + (255 - color[1]) * 0.88),
              Math.round(color[2] + (255 - color[2]) * 0.88),
            ];
            border = [
              Math.round(color[0] + (255 - color[0]) * 0.55),
              Math.round(color[1] + (255 - color[1]) * 0.55),
              Math.round(color[2] + (255 - color[2]) * 0.55),
            ];
            fg = [
              Math.round(color[0] * 0.75),
              Math.round(color[1] * 0.75),
              Math.round(color[2] * 0.75),
            ];
          }
          const x = mL + c * (colW + gap);
          doc.setFillColor(bg[0], bg[1], bg[2]);
          doc.setDrawColor(border[0], border[1], border[2]);
          doc.setLineWidth(0.2);
          doc.roundedRect(x, y, colW, rowH, 1, 1, "FD");
          const totalSelf = selfCounts?.get(item) || 0;
          const isRepetido = totalSelf > 1;
          if (isRepetido) {
            doc.setTextColor(0, 0, 0);
          } else {
            doc.setTextColor(fg[0], fg[1], fg[2]);
          }
          doc.setFont("helvetica", isRepetido || estado !== "ok" ? "bold" : "normal");
          doc.text(item, x + colW / 2, y + 3.6, { align: "center" });
        }
        y += rowH + 1.2;
      }
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "normal");
      doc.setDrawColor(0, 0, 0);
      y += 3;
    };

    const renderBlocoTipos = (titulo: string, t: TipoCounts, dir?: TipoCounts | null) => {
      const hasAny = t.pautaList.length + t.distribuicaoList.length + t.cejuscList.length > 0;
      if (!hasAny) return;
      checkPage(14);
      // Faixa de título do bloco
      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.2);
      doc.roundedRect(mL, y, contentW, 7.5, 1.2, 1.2, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(titulo, mL + 3, y + 5);
      y += 10;
      doc.setTextColor(0, 0, 0);
      doc.setDrawColor(0, 0, 0);
      const toCounts = (arr: string[]) => {
        const m = new Map<string, number>();
        for (const x of arr) m.set(x, (m.get(x) || 0) + 1);
        return m;
      };
      const cejuscRem = dir ? toCounts(dir.cejuscList) : null;
      const pautaRem = dir ? toCounts(dir.pautaList) : null;
      const distRem = dir ? toCounts(dir.distribuicaoList) : null;
      const anyRem = dir
        ? toCounts([...dir.cejuscList, ...dir.pautaList, ...dir.distribuicaoList])
        : null;
      const selfCounts = toCounts([...t.cejuscList, ...t.pautaList, ...t.distribuicaoList]);
      const selfSeen = new Map<string, number>();
      // Cores alinhadas com a tela: purple-600, indigo-600, sky-600
      renderListaTipo("CEJUSC-TST", t.cejuscList, [147, 51, 234], cejuscRem, anyRem, selfCounts, selfSeen);
      renderListaTipo("Pauta de Julgamento", t.pautaList, [79, 70, 229], pautaRem, anyRem, selfCounts, selfSeen);
      renderListaTipo("Lista de Distribuição", t.distribuicaoList, [2, 132, 199], distRem, anyRem, selfCounts, selfSeen);
      y += 4;
    };

    if (tiposEsq) renderBlocoTipos(leftLabel, tiposEsq, tiposDir);
    if (tiposDir) renderBlocoTipos(sourceLabel, tiposDir, tiposEsq);
  }

  // ----- Lista helper colorida (sempre 3 colunas) -----
  const renderSecao = (
    titulo: string,
    items: string[],
    color: [number, number, number],
    showMotivos: boolean,
  ) => {
    checkPage(20);
    // Faixa colorida com título
    doc.setFillColor(...color);
    doc.rect(mL, y, contentW, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`${titulo} (${items.length})`, mL + 3, y + 5.5);
    doc.setTextColor(0, 0, 0);
    y += 11;

    if (items.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(140);
      doc.text("Nenhum processo.", mL, y);
      doc.setTextColor(0, 0, 0);
      y += 8;
      return;
    }

    const cols = 3;
    const gap = 3;
    const colW = (contentW - gap * (cols - 1)) / cols;

    if (showMotivos) {
      // 3 colunas com motivos abaixo de cada item
      const cellTextW = colW - 2;
      // Pré-calcula células (CNJ + motivos quebrados) com altura
      const cells = items.map((p) => {
        const motivos = analise[p]?.motivos || [];
        const lines: string[] = [];
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        motivos.forEach((m) => {
          const wrapped: string[] = doc.splitTextToSize(`• ${m}`, cellTextW);
          wrapped.forEach((l: string) => lines.push(l));
        });
        const height = 4 + lines.length * 3 + 1.5;
        return { p, lines, height };
      });

      let colIdx = 0;
      let colY = [y, y, y];
      const colStartY = y;
      let maxColY = y;

      const newPage = () => {
        doc.addPage();
        y = 20;
        colY = [y, y, y];
        maxColY = y;
        colIdx = 0;
      };

      cells.forEach((cell) => {
        // Se a célula não cabe na coluna atual da página
        if (colY[colIdx] + cell.height > pageHeight - 15) {
          colIdx++;
          if (colIdx >= cols) {
            newPage();
          }
        }
        const x = mL + colIdx * (colW + gap);
        let cy = colY[colIdx];
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(30, 58, 95);
        doc.text(cell.p, x, cy);
        cy += 4;
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        cell.lines.forEach((l) => {
          doc.text(l, x + 2, cy);
          cy += 3;
        });
        cy += 1.5;
        colY[colIdx] = cy;
        if (cy > maxColY) maxColY = cy;
      });
      y = maxColY;
    } else {
      // Lista simples em 3 colunas — badges verdes (espelhando a tela)
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      const rowH = 5.2;
      const rows = Math.ceil(items.length / cols);
      for (let r = 0; r < rows; r++) {
        checkPage(rowH + 1);
        for (let c = 0; c < cols; c++) {
          const idx = r * cols + c;
          if (idx >= items.length) continue;
          const x = mL + c * (colW + gap);
          doc.setFillColor(240, 253, 244);   // green-50
          doc.setDrawColor(187, 247, 208);   // green-200
          doc.setLineWidth(0.2);
          doc.roundedRect(x, y, colW, rowH, 1, 1, "FD");
          doc.setTextColor(22, 101, 52);      // green-800
          doc.text(items[idx], x + colW / 2, y + 3.6, { align: "center" });
        }
        y += rowH + 1.2;
      }
      doc.setTextColor(0, 0, 0);
      doc.setDrawColor(0, 0, 0);
    }
    y += 6;
  };

  renderSecao(`Somente no ${leftLabel}`, result.somente_doc, [217, 119, 6], true);
  renderSecao(`Somente no ${sourceLabel}`, result.somente_pdf, [234, 88, 12], true);
  renderSecao("Em Comum", result.comuns, [22, 163, 74], false);

  // ----- Rodapé -----
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(`Juris Control – Comparar DJEN – Página ${i}/${total}`, pageWidth / 2, pageHeight - 6, { align: "center" });
  }

  doc.save(`comparacao_djen_${new Date().toISOString().slice(0, 10)}.pdf`);
}

type CompareMode = "pdf" | "djen" | "pdf-diario" | "excel-projuris" | "excel-astrea";

function extrairProcessosExcelProjuris(arrayBuffer: ArrayBuffer): string[] {
  const wb = XLSX.read(arrayBuffer, { type: "array" });
  const encontrados: string[] = [];
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
    if (!rows.length) continue;
    const sample = rows[0];
    const colProcesso = Object.keys(sample).find((k) => k.trim().toLowerCase() === "processo");
    if (!colProcesso) continue;
    for (const row of rows) {
      const valor = String(row[colProcesso] ?? "").trim();
      if (!valor) continue;
      const digits = valor.replace(/\D/g, "");
      if (digits.length === 20) encontrados.push(formatarCNJ(digits));
    }
  }
  return [...new Set(encontrados)];
}

function extrairProcessosExcelAstrea(arrayBuffer: ArrayBuffer): string[] {
  const wb = XLSX.read(arrayBuffer, { type: "array" });
  const encontrados: string[] = [];
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
    if (!rows.length) continue;
    const sample = rows[0];
    const colProcesso = Object.keys(sample).find((k) => {
      const lower = k.trim().toLowerCase();
      return lower === "número do processo" || lower === "numero do processo" || lower === "nº do processo" || lower === "n° do processo";
    });
    if (!colProcesso) continue;
    for (const row of rows) {
      const valor = String(row[colProcesso] ?? "").trim();
      if (!valor) continue;
      const digits = valor.replace(/\D/g, "");
      if (digits.length === 20) encontrados.push(formatarCNJ(digits));
    }
  }
  return [...new Set(encontrados)];
}

export default function CompararDjSantander() {
  const [mode, setMode] = useState<CompareMode>("pdf");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [docProcessos, setDocProcessos] = useState<string[]>([]);
  const [pdfProcessos, setPdfProcessos] = useState<string[]>([]);
  const [result, setResult] = useState<ComparisonResult | null>(null);

  // Texto bruto dos documentos carregados (para classificar por título)
  const [docTexto, setDocTexto] = useState<string>("");
  const [pdfTexto, setPdfTexto] = useState<string>("");
  const [pdfDiarioTexto, setPdfDiarioTexto] = useState<string>("");
  const [tiposEsq, setTiposEsq] = useState<TipoCounts | null>(null);
  const [tiposDir, setTiposDir] = useState<TipoCounts | null>(null);

  // DJEN mode state
  const [coordenacoes, setCoordenacoes] = useState<Coordenacao[]>([]);
  const [selectedCoordenacao, setSelectedCoordenacao] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedDateFim, setSelectedDateFim] = useState<Date | undefined>(undefined);
  const [selectedPubInicio, setSelectedPubInicio] = useState<Date | undefined>(undefined);
  const [selectedPubFim, setSelectedPubFim] = useState<Date | undefined>(undefined);
  const [djenProcessos, setDjenProcessos] = useState<string[]>([]);
  const [djenTexto, setDjenTexto] = useState<string>("");
  const [loadingDjen, setLoadingDjen] = useState(false);
  const [djenLoaded, setDjenLoaded] = useState(false);
  const [djenTotalPubs, setDjenTotalPubs] = useState<number>(0);

  // PDF Diário mode state
  const [pdfDiarioFiles, setPdfDiarioFiles] = useState<File[]>([]);
  const [pdfDiarioProcessos, setPdfDiarioProcessos] = useState<string[]>([]);
  const [loadingPdfDiario, setLoadingPdfDiario] = useState(false);

  // Excel Projuris mode state
  const [excelProjurisFile, setExcelProjurisFile] = useState<File | null>(null);
  const [excelProjurisProcessos, setExcelProjurisProcessos] = useState<string[]>([]);
  const [loadingExcelProjuris, setLoadingExcelProjuris] = useState(false);

  // Excel Astrea mode state
  const [excelAstreaFile, setExcelAstreaFile] = useState<File | null>(null);
  const [excelAstreaProcessos, setExcelAstreaProcessos] = useState<string[]>([]);
  const [loadingExcelAstrea, setLoadingExcelAstrea] = useState(false);

  // Análise de motivos (porque um processo do "Somente no <leftLabel>" não foi capturado)
  const [monitoramentosConfig, setMonitoramentosConfig] = useState<MonitoramentoConfig[]>([]);
  const [analise, setAnalise] = useState<Record<string, AnaliseProcesso>>({});
  const [analisando, setAnalisando] = useState(false);

  // Load coordenações
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("coordenacoes").select("id, nome").order("nome");
      if (data) setCoordenacoes(data);
    };
    load();
  }, []);

  // Carrega config de monitoramentos sempre que a coordenação muda
  // (necessário para o botão "Analisar Motivos" funcionar em qualquer modo)
  useEffect(() => {
    if (!selectedCoordenacao) {
      setMonitoramentosConfig([]);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("monitoramentos_djen")
        .select("id, tipo, oab, uf, termo_busca, termos_or, exclusoes, tribunais, buscar_parte, ativo")
        .eq("coordenacao_id", selectedCoordenacao);
      setMonitoramentosConfig(
        (data || [])
          .filter((m: any) => m.ativo !== false)
          .map((m: any) => ({
            id: m.id,
            tipo: m.tipo,
            oab: m.oab,
            uf: m.uf,
            termo_busca: m.termo_busca,
            termos_or: m.termos_or,
            exclusoes: m.exclusoes,
            tribunais: m.tribunais,
            buscar_parte: m.buscar_parte,
          }))
      );
    })();
  }, [selectedCoordenacao]);

  // Handlers unificados para filtros comuns (fora das abas)
  const onChangeCoordenacao = (v: string) => {
    setSelectedCoordenacao(v);
    setDjenLoaded(false);
    setDjenProcessos([]);
    setResult(null);
  };
  const onChangeDate = (d: Date | undefined) => {
    setSelectedDate(d);
    setDjenLoaded(false);
    setDjenProcessos([]);
    setResult(null);
  };
  const onChangeDateFim = (d: Date | undefined) => {
    setSelectedDateFim(d);
    setDjenLoaded(false);
    setDjenProcessos([]);
    setResult(null);
  };
  const onChangePubInicio = (d: Date | undefined) => {
    setSelectedPubInicio(d);
    setDjenLoaded(false);
    setDjenProcessos([]);
    setResult(null);
  };
  const onChangePubFim = (d: Date | undefined) => {
    setSelectedPubFim(d);
    setDjenLoaded(false);
    setDjenProcessos([]);
    setResult(null);
  };

  const handleDocUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocFile(file);
    setResult(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const processos = await extrairProcessosDocxTitulosNegrito(arrayBuffer);
      setDocProcessos(processos);
      try {
        const texto = await extrairTextoDocx(arrayBuffer.slice(0));
        setDocTexto(texto);
      } catch (e) {
        console.warn("Falha ao extrair texto do DOCX:", e);
        setDocTexto("");
      }
      toast.success(`DOC carregado: ${processos.length} processos encontrados`);
    } catch (err) {
      console.error("Erro ao ler DOC:", err);
      toast.error("Erro ao ler arquivo DOC/DOCX");
    }
  }, []);

  const handlePdfUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfFile(file);
    setResult(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const text = await extrairTextoPdf(arrayBuffer);
      const processos = extrairProcessos(text, { permitirComunicacaoInline: true });
      setPdfProcessos(processos);
      setPdfTexto(text);
      toast.success(`PDF carregado: ${processos.length} processos encontrados`);
    } catch (err) {
      console.error("Erro ao ler PDF:", err);
      toast.error("Erro ao ler arquivo PDF");
    }
  }, []);

  const handlePdfDiarioUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setPdfDiarioFiles(files);
    setPdfDiarioProcessos([]);
    setResult(null);
    setLoadingPdfDiario(true);
    try {
      const all: string[] = [];
      const textosConcat: string[] = [];
      for (const file of files) {
        const ab = await file.arrayBuffer();
        const text = await extrairTextoPdf(ab);
        all.push(...extrairProcessosTitulosPdfDiario(text));
        textosConcat.push(text);
      }
      setPdfDiarioProcessos(all);
      setPdfDiarioTexto(textosConcat.join("\n"));
      toast.success(`${files.length} PDF(s) processado(s): ${all.length} processos identificados nos títulos`);
    } catch (err) {
      console.error("Erro ao ler PDFs do diário:", err);
      toast.error("Erro ao ler arquivo(s) PDF do diário");
    } finally {
      setLoadingPdfDiario(false);
    }
  }, []);

  const handleExcelProjurisUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelProjurisFile(file);
    setExcelProjurisProcessos([]);
    setResult(null);
    setLoadingExcelProjuris(true);
    try {
      const ab = await file.arrayBuffer();
      const processos = extrairProcessosExcelProjuris(ab);
      setExcelProjurisProcessos(processos);
      toast.success(`Planilha carregada: ${processos.length} processos encontrados na coluna "Processo"`);
    } catch (err) {
      console.error("Erro ao ler XLSX Projuris:", err);
      toast.error("Erro ao ler a planilha do Projuris");
    } finally {
      setLoadingExcelProjuris(false);
    }
  }, []);

  const handleExcelAstreaUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelAstreaFile(file);
    setExcelAstreaProcessos([]);
    setResult(null);
    setLoadingExcelAstrea(true);
    try {
      const ab = await file.arrayBuffer();
      const processos = extrairProcessosExcelAstrea(ab);
      setExcelAstreaProcessos(processos);
      toast.success(`Planilha carregada: ${processos.length} processos encontrados na coluna "Número do processo"`);
    } catch (err) {
      console.error("Erro ao ler XLSX Astrea:", err);
      toast.error("Erro ao ler a planilha do Astrea");
    } finally {
      setLoadingExcelAstrea(false);
    }
  }, []);

  const handleBuscarDjen = async () => {
    if (!selectedCoordenacao || (!selectedDate && !selectedPubInicio)) {
      toast.error("Selecione a coordenação e ao menos uma data (disponibilização ou publicação)");
      return;
    }
    setLoadingDjen(true);
    setDjenLoaded(false);
    setDjenProcessos([]);
    setDjenTexto("");
    setResult(null);
    try {
      // Format date range for query - data_disponibilizacao is stored as timestamptz
      const inicioStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null;
      const fimStr = selectedDate ? format(selectedDateFim ?? selectedDate, "yyyy-MM-dd") : null;
      const startOfDay = inicioStr ? `${inicioStr}T00:00:00.000Z` : null;
      const endOfDay = fimStr ? `${fimStr}T23:59:59.999Z` : null;
      const pubInicioStr = selectedPubInicio ? format(selectedPubInicio, "yyyy-MM-dd") : null;
      const pubFimStr = selectedPubFim ? format(selectedPubFim, "yyyy-MM-dd") : (pubInicioStr ?? null);
      const pubStart = pubInicioStr ? `${pubInicioStr}T00:00:00.000Z` : null;
      const pubEnd = pubFimStr ? `${pubFimStr}T23:59:59.999Z` : null;

      // Get monitoramento IDs for the selected coordenação
      const { data: monitoramentos } = await supabase
        .from("monitoramentos_djen")
        .select("id, tipo, oab, uf, termo_busca, termos_or, exclusoes, tribunais, buscar_parte, ativo")
        .eq("coordenacao_id", selectedCoordenacao);

      if (!monitoramentos || monitoramentos.length === 0) {
        toast.error("Nenhum monitoramento encontrado para esta coordenação");
        setLoadingDjen(false);
        return;
      }

      const monIds = monitoramentos.map(m => m.id);
      setMonitoramentosConfig(
        monitoramentos
          .filter((m: any) => m.ativo !== false)
          .map((m: any) => ({
            id: m.id,
            tipo: m.tipo,
            oab: m.oab,
            uf: m.uf,
            termo_busca: m.termo_busca,
            termos_or: m.termos_or,
            exclusoes: m.exclusoes,
            tribunais: m.tribunais,
            buscar_parte: m.buscar_parte,
          }))
      );

      // Fetch all publications for those monitoramentos on the selected date
      // Use pagination to get all results.
      // Importante: aplica os MESMOS filtros e dedup da tela Análise DJEN
      // (status IN encontrada/duplicada, exclui fonte 'dejt-pdf', dedup por
      // (coordenacao, id_djen | legacy)) para que o total bata com o card
      // "Total no Período" da Análise DJEN.
      type PubRow = {
        id: string;
        processo_numero: string | null;
        orgao: string | null;
        tipo_comunicacao: string | null;
        conteudo: string | null;
        fonte: string | null;
        status: string | null;
        id_djen: string | null;
        dedup_processo_digits: string | null;
        dedup_data_ref: string | null;
        dedup_head_norm: string | null;
        coordenacao_id: string | null;
        monitoramento_id: string | null;
      };
      const rawPubs: PubRow[] = [];
      const pageSize = 1000;
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        let q = supabase
          .from("publicacoes_djen")
          .select(
            "id, processo_numero, orgao, tipo_comunicacao, conteudo, fonte, status, id_djen, dedup_processo_digits, dedup_data_ref, dedup_head_norm, coordenacao_id, monitoramento_id"
          )
          .in("monitoramento_id", monIds)
          .in("status", ["encontrada", "duplicada"])
          .neq("fonte", "dejt-pdf");
        if (startOfDay) q = q.gte("data_disponibilizacao", startOfDay);
        if (endOfDay) q = q.lte("data_disponibilizacao", endOfDay);
        if (pubStart) q = q.gte("data_publicacao", pubStart);
        if (pubEnd) q = q.lte("data_publicacao", pubEnd);
        const { data: publicacoes, error } = await q.range(offset, offset + pageSize - 1);

        if (error) {
          console.error("Erro ao buscar publicações:", error);
          toast.error("Erro ao buscar publicações do DJEN");
          break;
        }

        if (publicacoes && publicacoes.length > 0) {
          for (const p of publicacoes as any[]) {
            rawPubs.push({
              id: String(p.id),
              processo_numero: p.processo_numero ?? null,
              orgao: p.orgao ?? null,
              tipo_comunicacao: p.tipo_comunicacao ?? null,
              conteudo: p.conteudo ?? null,
              fonte: p.fonte ?? null,
              status: p.status ?? null,
              id_djen: p.id_djen ?? null,
              dedup_processo_digits: p.dedup_processo_digits ?? null,
              dedup_data_ref: p.dedup_data_ref ?? null,
              dedup_head_norm: p.dedup_head_norm ?? null,
              coordenacao_id: p.coordenacao_id ?? null,
              monitoramento_id: p.monitoramento_id ?? null,
            });
          }
        }

        if (!publicacoes || publicacoes.length < pageSize) {
          hasMore = false;
        } else {
          offset += pageSize;
        }
      }

      // Dedup espelhando a RPC `get_djen_publicacoes_unificadas`:
      //   dedup_coord = coordenacao_id (publicação) || coordenacao do monitoramento
      //   dedup_uid   = id_djen (trim) || 'legacy|<processo_digits>|<data_ref>|<head_norm>'
      const monCoordById = new Map<string, string | null>(
        monitoramentos.map((m: any) => [m.id, m.coordenacao_id ?? null])
      );
      const dedupMap = new Map<string, PubRow>();
      for (const p of rawPubs) {
        const dedupCoord =
          p.coordenacao_id ||
          (p.monitoramento_id ? monCoordById.get(p.monitoramento_id) ?? null : null) ||
          selectedCoordenacao;
        const idDjenTrim = (p.id_djen || "").trim();
        const dedupUid = idDjenTrim
          ? idDjenTrim
          : `legacy|${p.dedup_processo_digits ?? ""}|${p.dedup_data_ref ?? ""}|${p.dedup_head_norm ?? ""}`;
        const key = `${dedupCoord}::${dedupUid}`;
        if (!dedupMap.has(key)) dedupMap.set(key, p);
      }
      const allPubs = Array.from(dedupMap.values());

      // Uma entrada por publicação deduplicada — bate com o "Total no Período"
      // da tela Análise DJEN.
      const todos = allPubs
        .map((p) => p.processo_numero)
        .filter((n): n is string => !!n)
        .map(formatarCNJ);
      setDjenProcessos(todos);
      setDjenTotalPubs(allPubs.length);
      // Monta um texto sintético no mesmo formato do PDF Resumo
      // ("COMUNICAÇÃO PJE #<CNJ>" como cabeçalho + corpo) para que
      // classificarTiposPorTitulo possa contar Pauta/Distribuição/CEJUSC/Outros.
      const stripHtml = (s: string | null) => (s || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ");
      const textoSintetico = allPubs
        .map((p) => {
          const cnj = formatarCNJ(p.processo_numero || "");
          const header = `COMUNICAÇÃO PJE #${cnj}`;
          const corpo = [p.orgao || "", p.tipo_comunicacao || "", stripHtml(p.conteudo)]
            .filter(Boolean)
            .join("\n");
          return `${header}\n${corpo}`;
        })
        .join("\n");
      setDjenTexto(textoSintetico);
      setDjenLoaded(true);
      toast.success(`${allPubs.length} publicações encontradas no DJEN`);
    } catch (err) {
      console.error("Erro ao buscar DJEN:", err);
      toast.error("Erro ao buscar publicações do DJEN");
    } finally {
      setLoadingDjen(false);
    }
  };

  const handleComparar = () => {
    const calc = (txt: string): TipoCounts | null =>
      txt ? classificarTiposPorTitulo(txt) : null;
    let esq: TipoCounts | null = null;
    let dir: TipoCounts | null = null;
    if (mode === "pdf") {
      if (docProcessos.length === 0 || pdfProcessos.length === 0) {
        toast.error("Carregue ambos os arquivos antes de comparar");
        return;
      }
      const res = compararListas(docProcessos, pdfProcessos);
      setResult(res);
      esq = calc(docTexto);
      dir = calc(pdfTexto);
    } else if (mode === "djen") {
      if (docProcessos.length === 0 || djenProcessos.length === 0) {
        toast.error("Carregue o DOC e busque as publicações antes de comparar");
        return;
      }
      const res = compararListas(docProcessos, djenProcessos);
      setResult(res);
      esq = calc(docTexto);
      dir = calc(djenTexto);
    } else if (mode === "pdf-diario") {
      if (pdfDiarioProcessos.length === 0 || djenProcessos.length === 0) {
        toast.error("Carregue o(s) PDF(s) do diário e busque as publicações antes de comparar");
        return;
      }
      const res = compararListas(pdfDiarioProcessos, djenProcessos);
      setResult(res);
      esq = calc(pdfDiarioTexto);
      dir = calc(djenTexto);
    } else if (mode === "excel-projuris") {
      if (excelProjurisProcessos.length === 0 || djenProcessos.length === 0) {
        toast.error("Carregue a planilha do Projuris e busque as publicações antes de comparar");
        return;
      }
      const res = compararListas(excelProjurisProcessos, djenProcessos);
      setResult(res);
      dir = calc(djenTexto);
    } else {
      if (excelAstreaProcessos.length === 0 || djenProcessos.length === 0) {
        toast.error("Carregue a planilha do Astrea e busque as publicações antes de comparar");
        return;
      }
      const res = compararListas(excelAstreaProcessos, djenProcessos);
      setResult(res);
      dir = calc(djenTexto);
    }
    setTiposEsq(esq);
    setTiposDir(dir);
    toast.success("Comparação concluída!");
  };

  const canCompare =
    mode === "pdf" ? docProcessos.length > 0 && pdfProcessos.length > 0
    : mode === "djen" ? docProcessos.length > 0 && djenProcessos.length > 0
    : mode === "pdf-diario" ? pdfDiarioProcessos.length > 0 && djenProcessos.length > 0
    : mode === "excel-projuris" ? excelProjurisProcessos.length > 0 && djenProcessos.length > 0
    : excelAstreaProcessos.length > 0 && djenProcessos.length > 0;

  const leftLabel =
    mode === "pdf-diario" ? "PDF Equipe DR. Thomás"
    : mode === "excel-projuris" ? "Excel Projuris"
    : mode === "excel-astrea" ? "Excel Astrea"
    : "DOC Advogado";
  const sourceLabel = mode === "pdf" ? "PDF" : "DJEN";
  const leftFileName =
    mode === "pdf-diario"
      ? (pdfDiarioFiles.length > 0 ? `${pdfDiarioFiles.length} PDF(s) Equipe DR. Thomás` : "PDF Equipe DR. Thomás")
      : mode === "excel-projuris"
      ? (excelProjurisFile?.name || "Excel Projuris")
      : mode === "excel-astrea"
      ? (excelAstreaFile?.name || "Excel Astrea")
      : (docFile?.name || "DOC");
  const sourceFileName = mode === "pdf"
    ? (pdfFile?.name || "PDF")
    : `DJEN - ${coordenacoes.find(c => c.id === selectedCoordenacao)?.nome || ""} - ${selectedDate ? format(selectedDate, "dd/MM/yyyy") : ""}${selectedDateFim && selectedDateFim.getTime() !== selectedDate?.getTime() ? ` a ${format(selectedDateFim, "dd/MM/yyyy")}` : ""}`;



  const analisarMotivosSomenteDoc = async () => {
    if (!result) return;
    if (result.somente_doc.length === 0 && result.somente_pdf.length === 0) return;
    if (!selectedCoordenacao || (!selectedDate && !selectedPubInicio)) {
      toast.error("Selecione coordenação e ao menos uma data (disponibilização ou publicação)");
      return;
    }
    setAnalisando(true);
    const dispInicio = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null;
    const dispFim = selectedDate ? format(selectedDateFim ?? selectedDate, "yyyy-MM-dd") : null;
    const pubInicio = selectedPubInicio ? format(selectedPubInicio, "yyyy-MM-dd") : null;
    const pubFim = selectedPubFim ? format(selectedPubFim, "yyyy-MM-dd") : (selectedPubInicio ? format(selectedPubInicio, "yyyy-MM-dd") : null);
    // Compat: alguns trechos abaixo referenciam `inicio`/`fim` para mensagens
    const inicio = dispInicio ?? pubInicio!;
    const fim = dispFim ?? pubFim!;
    const monIds = monitoramentosConfig.map(m => m.id);

    // Mapa id -> rótulo do termo (para exibir no detalhe)
    const monLabel = new Map<string, string>();
    monitoramentosConfig.forEach(m => {
      const tipoUp = (m.tipo || "TERMO").toString().toUpperCase();
      if (m.tipo === "advogado") {
        const oabUf = [m.oab, m.uf].filter(Boolean).join("/");
        const nome = m.termo_busca && m.termo_busca !== m.oab ? m.termo_busca : "";
        monLabel.set(m.id, ["ADVOGADO", oabUf, nome].filter(Boolean).join(" + "));
      } else {
        monLabel.set(m.id, m.termo_busca ? `${tipoUp} + ${m.termo_busca}` : tipoUp);
      }
    });
    const descreverCaptura = (rows: any[]): string => {
      const pares = new Map<string, Set<string>>(); // termo -> tribunais
      rows.forEach((r: any) => {
        const termo = monLabel.get(r.monitoramento_id) || "monitoramento";
        const trib = String(r.tribunal || r.orgao || "DJEN").toUpperCase();
        if (!pares.has(termo)) pares.set(termo, new Set());
        pares.get(termo)!.add(trib);
      });
      return [...pares.entries()]
        .map(([t, tribs]) => `"${t}" em ${[...tribs].join(", ")}`)
        .join("; ");
    };

    const inicial: Record<string, AnaliseProcesso> = {};
    result.somente_doc.forEach(p => { inicial[p] = { loading: true, motivos: [] }; });
    result.somente_pdf.forEach(p => { inicial[p] = { loading: true, motivos: [] }; });
    setAnalise(inicial);

    const tribunaisMon = new Set<string>();
    monitoramentosConfig.forEach(m => (m.tribunais || []).forEach(t => tribunaisMon.add(t.toUpperCase())));
    const oabsMon = new Set<string>();
    monitoramentosConfig.forEach(m => {
      if (m.tipo === "advogado" && m.oab) oabsMon.add(m.oab.replace(/\D/g, ""));
      (m.termos_or || []).forEach(t => {
        const digits = (t.match(/\d{3,8}/) || [])[0];
        if (digits) oabsMon.add(digits);
      });
    });
    const exclusoesMon: string[] = [];
    monitoramentosConfig.forEach(m => (m.exclusoes || []).forEach(e => e && exclusoesMon.push(e.toUpperCase())));

    const analisarUm = async (processo: string): Promise<string[]> => {
      const motivos: string[] = [];
      const digits = processo.replace(/\D/g, "");
      try {
        let q = supabase
          .from("publicacoes_djen_descartadas")
          .select("motivo_descarte, tribunal")
          .in("monitoramento_id", monIds)
          .eq("dedup_processo_digits", digits);
        if (dispInicio) q = q.gte("data_disponibilizacao", `${dispInicio}T00:00:00.000Z`).lte("data_disponibilizacao", `${dispFim}T23:59:59.999Z`);
        if (pubInicio) q = q.gte("data_publicacao", `${pubInicio}T00:00:00.000Z`).lte("data_publicacao", `${pubFim}T23:59:59.999Z`);
        const { data: descartadas } = await q;
        if (descartadas && descartadas.length > 0) {
          const unicos = [...new Set(descartadas.map(d => d.motivo_descarte).filter(Boolean))];
          unicos.forEach(m => motivos.push(`Descartado: ${m}`));
          return motivos;
        }
      } catch (e) {
        console.warn("erro descartadas", e);
      }

      // Verifica se a publicação foi capturada na base do DJEN
      // (por esta ou por outras coordenações)
      try {
        let q = supabase
          .from("publicacoes_djen")
          .select("coordenacao_id, monitoramento_id, tribunal, orgao, tipo_comunicacao, coordenacoes:coordenacao_id(nome)")
          .eq("dedup_processo_digits", digits);
        if (dispInicio) q = q.gte("data_disponibilizacao", `${dispInicio}T00:00:00.000Z`).lte("data_disponibilizacao", `${dispFim}T23:59:59.999Z`);
        if (pubInicio) q = q.gte("data_publicacao", `${pubInicio}T00:00:00.000Z`).lte("data_publicacao", `${pubFim}T23:59:59.999Z`);
        const { data: capturadas } = await q;
        if (capturadas && capturadas.length > 0) {
          const naSelecionada = capturadas.filter((c: any) => monIds.includes(c.monitoramento_id));
          if (naSelecionada.length > 0) {
            motivos.push(`Capturado pela coordenação selecionada via ${descreverCaptura(naSelecionada)}. Verifique se está marcado como lido/arquivado, ou se a base do PDF normalizou o número de forma diferente.`);
            return motivos;
          }
          const outras = [...new Set(capturadas.map((c: any) => c.coordenacoes?.nome).filter(Boolean))];
          if (outras.length > 0) {
            const tribs = [...new Set(capturadas.map((c: any) => String(c.tribunal || "").toUpperCase()).filter(Boolean))].join(", ");
            motivos.push(`Encontrado no DJEN (${tribs || "tribunal não identificado"}), mas capturado por outra(s) coordenação(ões): ${outras.join(", ")}. Os termos da coordenação selecionada não casaram com esta publicação.`);
            return motivos;
          }
        }
      } catch (e) {
        console.warn("erro publicacoes_djen", e);
      }

      try {
        const { data, error } = await supabase.functions.invoke("buscar-pje", {
          body: {
            tipo: "processo",
            numeroProcesso: digits,
            dataInicio: inicio,
            dataFim: fim,
            tamanhoPagina: 50,
          },
        });
        if (error) {
          motivos.push(`Não localizado em nossa base DJEN. Erro ao consultar PJE Comunica ao vivo: ${error.message}`);
          return motivos;
        }
        const items: any[] = data?.items || data?.publicacoes || data?.comunicacoes || [];
        if (!items.length) {
          const fonte = (data as any)?.fonte ? ` (fonte: ${(data as any).fonte})` : "";
          motivos.push(`Não localizado em nossa base DJEN nem na consulta ao vivo${fonte}. Confirme manualmente no portal do PJE Comunica.`);
          return motivos;
        }
        for (const pub of items) {
          const tribunal = String(pub.siglaTribunal || pub.tribunal || "").toUpperCase();
          const advs: any[] = pub.destinatarioadvogados || pub.destinatarios_advogados || [];
          const oabsPub = new Set<string>();
          advs.forEach((a: any) => {
            const oab = a?.advogado?.numero_oab || a?.numero_oab || a?.oab || "";
            const d = String(oab).replace(/\D/g, "");
            if (d) oabsPub.add(d);
          });
          const conteudo = String(pub.texto || pub.conteudo || "").toUpperCase();

          const exclusao = exclusoesMon.find(e => conteudo.includes(e));
          if (exclusao) {
            motivos.push(`Pub. ${tribunal}: contém termo de exclusão "${exclusao}"`);
            continue;
          }
          if (tribunal && tribunaisMon.size > 0 && !tribunaisMon.has(tribunal)) {
            motivos.push(`Pub. ${tribunal}: tribunal fora do escopo monitorado`);
            continue;
          }
          const oabMatch = [...oabsPub].some(o => oabsMon.has(o));
          if (!oabMatch && oabsMon.size > 0) {
            const lista = oabsPub.size > 0 ? [...oabsPub].join(", ") : "nenhum";
            motivos.push(`Pub. ${tribunal}: destinatários (OAB ${lista}) não correspondem aos OABs monitorados`);
            continue;
          }
          motivos.push(`Pub. ${tribunal}: encontrada na PJE mas não casou com termos (verificar tipo/parte)`);
        }
        return [...new Set(motivos)];
      } catch (e: any) {
        motivos.push(`Erro: ${e?.message || "falha ao consultar"}`);
        return motivos;
      }
    };

    // Para a coluna "Somente no <fonte>": exibir em qual termo+tribunal cada processo
    // foi capturado pela coordenação selecionada (a coluna da direita).
    const analisarCapturado = async (processo: string): Promise<string[]> => {
      const digits = processo.replace(/\D/g, "");
      try {
        let q = supabase
          .from("publicacoes_djen")
          .select("monitoramento_id, tribunal, orgao")
          .in("monitoramento_id", monIds)
          .eq("dedup_processo_digits", digits);
        if (dispInicio) q = q.gte("data_disponibilizacao", `${dispInicio}T00:00:00.000Z`).lte("data_disponibilizacao", `${dispFim}T23:59:59.999Z`);
        if (pubInicio) q = q.gte("data_publicacao", `${pubInicio}T00:00:00.000Z`).lte("data_publicacao", `${pubFim}T23:59:59.999Z`);
        const { data: capturadas } = await q;
        if (capturadas && capturadas.length > 0) {
          return [`Capturado via ${descreverCaptura(capturadas)}`];
        }
        return ["Não localizado na base DJEN da coordenação selecionada para o período."];
      } catch (e: any) {
        return [`Erro ao consultar base: ${e?.message || "falha"}`];
      }
    };

    const tarefas: Array<{ processo: string; tipo: "doc" | "pdf" }> = [
      ...result.somente_doc.map(p => ({ processo: p, tipo: "doc" as const })),
      ...result.somente_pdf.map(p => ({ processo: p, tipo: "pdf" as const })),
    ];
    const workers = Array.from({ length: 3 }, async () => {
      while (tarefas.length > 0) {
        const t = tarefas.shift();
        if (!t) break;
        const motivos = t.tipo === "doc" ? await analisarUm(t.processo) : await analisarCapturado(t.processo);
        setAnalise(prev => ({ ...prev, [t.processo]: { loading: false, motivos } }));
      }
    });
    await Promise.all(workers);
    setAnalisando(false);
    toast.success("Análise de motivos concluída");
  };

  return (
    <MainLayout title="Comparar DJEN" subtitle="Compare o documento do advogado, PDF da Equipe DR. Thomás ou planilha do Projuris com as publicações DJEN">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Left card: Fonte de Comparação (tabs) */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Fonte de Comparação</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={mode} onValueChange={(v) => { setMode(v as CompareMode); setResult(null); }}>
              <TabsList className="w-full mb-4">
                <TabsTrigger value="pdf" className="flex-1 gap-2">
                  <FileText className="w-4 h-4" />
                  PDF Resumo
                </TabsTrigger>
                <TabsTrigger value="djen" className="flex-1 gap-2">
                  <Database className="w-4 h-4" />
                  Publicações DJEN
                </TabsTrigger>
                <TabsTrigger value="pdf-diario" className="flex-1 gap-2">
                  <FileText className="w-4 h-4" />
                  PDF Equipe DR. Thomás
                </TabsTrigger>
                <TabsTrigger value="excel-projuris" className="flex-1 gap-2">
                  <Database className="w-4 h-4" />
                  Excel Projuris
                </TabsTrigger>
                <TabsTrigger value="excel-astrea" className="flex-1 gap-2">
                  <Database className="w-4 h-4" />
                  Excel Astrea
                </TabsTrigger>
              </TabsList>

              {/* Filtros comuns — Coordenação + Período */}
              <div className="mb-4 p-3 bg-muted/30 rounded-lg border space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Coordenação</label>
                    <Select value={selectedCoordenacao} onValueChange={(v) => onChangeCoordenacao(v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {coordenacoes.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Disponibilização (início)</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {selectedDate ? format(selectedDate, "dd/MM/yyyy") : "Selecione..."}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={selectedDate}
                          onSelect={(d) => onChangeDate(d)}
                          locale={ptBR}
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Disponibilização (fim)</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !selectedDateFim && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {selectedDateFim ? format(selectedDateFim, "dd/MM/yyyy") : "Selecione..."}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={selectedDateFim}
                          onSelect={(d) => onChangeDateFim(d)}
                          locale={ptBR}
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div />
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Publicação (início)</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !selectedPubInicio && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {selectedPubInicio ? format(selectedPubInicio, "dd/MM/yyyy") : "Opcional"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={selectedPubInicio}
                          onSelect={(d) => onChangePubInicio(d)}
                          locale={ptBR}
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Publicação (fim)</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !selectedPubFim && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {selectedPubFim ? format(selectedPubFim, "dd/MM/yyyy") : "Opcional"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={selectedPubFim}
                          onSelect={(d) => onChangePubFim(d)}
                          locale={ptBR}
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>

              <TabsContent value="pdf">
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    A coordenação e o período serão usados para a análise dos motivos (PJE Comunica). A comparação em si usa o PDF.
                  </p>
                  <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors border-muted-foreground/25">
                  <div className="flex flex-col items-center justify-center py-4">
                    {pdfFile ? (
                      <>
                        <FileCheck className="w-7 h-7 mb-2 text-green-500" />
                        <p className="text-sm font-medium">{pdfFile.name}</p>
                        <p className="text-xs text-muted-foreground">{pdfProcessos.length} processos encontrados</p>
                      </>
                    ) : (
                      <>
                        <Upload className="w-7 h-7 mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Clique para selecionar o PDF</p>
                      </>
                    )}
                  </div>
                  <input type="file" className="hidden" accept=".pdf" onChange={handlePdfUpload} />
                  </label>
                </div>
              </TabsContent>

              <TabsContent value="djen">
                <div className="space-y-3">
                  <Button
                    onClick={handleBuscarDjen}
                    disabled={!selectedCoordenacao || (!selectedDate && !selectedPubInicio) || loadingDjen}
                    className="w-full gap-2"
                  >
                    {loadingDjen ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                    {loadingDjen ? "Buscando..." : "Buscar Publicações"}
                  </Button>
                  {djenLoaded && (
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span className="text-muted-foreground">{djenProcessos.length} publicações encontradas</span>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="pdf-diario">
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Compara os processos extraídos dos títulos do PDF da Equipe DR. Thomás com as publicações DJEN da base.
                  </p>
                  <Button
                    onClick={handleBuscarDjen}
                    disabled={!selectedCoordenacao || (!selectedDate && !selectedPubInicio) || loadingDjen}
                    className="w-full gap-2"
                  >
                    {loadingDjen ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                    {loadingDjen ? "Buscando..." : "Buscar Publicações"}
                  </Button>
                  {djenLoaded && (
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span className="text-muted-foreground">{djenProcessos.length} publicações encontradas</span>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="excel-projuris">
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Compara os processos da coluna <strong>"Processo"</strong> da planilha do Projuris com as publicações DJEN da base.
                  </p>
                  <Button
                    onClick={handleBuscarDjen}
                    disabled={!selectedCoordenacao || (!selectedDate && !selectedPubInicio) || loadingDjen}
                    className="w-full gap-2"
                  >
                    {loadingDjen ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                    {loadingDjen ? "Buscando..." : "Buscar Publicações"}
                  </Button>
                  {djenLoaded && (
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span className="text-muted-foreground">{djenProcessos.length} publicações encontradas</span>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="excel-astrea">
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Compara os processos da coluna <strong>"Número do processo"</strong> da planilha do Astrea com as publicações DJEN da base.
                  </p>
                  <Button
                    onClick={handleBuscarDjen}
                    disabled={!selectedCoordenacao || (!selectedDate && !selectedPubInicio) || loadingDjen}
                    className="w-full gap-2"
                  >
                    {loadingDjen ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                    {loadingDjen ? "Buscando..." : "Buscar Publicações"}
                  </Button>
                  {djenLoaded && (
                    <div className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span className="text-muted-foreground">{djenProcessos.length} publicações encontradas</span>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Right card: DOC Advogado / PDF Equipe DR. Thomás / Excel Projuris (depende do modo) */}
        <Card>
        {mode === "pdf" || mode === "djen" ? (
          <>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-500" />
              Documento do Advogado (DOC/DOCX)
            </CardTitle>
            <CardDescription>Arquivo da Coordenação Santander</CardDescription>
          </CardHeader>
          <CardContent>
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors border-muted-foreground/25">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                {docFile ? (
                  <>
                    <FileCheck className="w-8 h-8 mb-2 text-green-500" />
                    <p className="text-sm font-medium">{docFile.name}</p>
                    <p className="text-xs text-muted-foreground">{docProcessos.length} processos encontrados</p>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Clique para selecionar o arquivo DOC</p>
                  </>
                )}
              </div>
              <input type="file" className="hidden" accept=".doc,.docx" onChange={handleDocUpload} />
            </label>
          </CardContent>
          </>
        ) : mode === "pdf-diario" ? (
          <>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-500" />
              PDF Equipe DR. Thomás
            </CardTitle>
            <CardDescription>Selecione um ou mais PDFs da Equipe DR. Thomás. Apenas os títulos com "Processo:" são considerados.</CardDescription>
          </CardHeader>
          <CardContent>
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors border-muted-foreground/25">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                {loadingPdfDiario ? (
                  <>
                    <Loader2 className="w-8 h-8 mb-2 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Lendo PDF(s)...</p>
                  </>
                ) : pdfDiarioFiles.length > 0 ? (
                  <>
                    <FileCheck className="w-8 h-8 mb-2 text-green-500" />
                    <p className="text-sm font-medium">{pdfDiarioFiles.length} arquivo(s) selecionado(s)</p>
                    <p className="text-xs text-muted-foreground">{pdfDiarioProcessos.length} processos identificados nos títulos</p>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Clique para selecionar PDF(s) da Equipe DR. Thomás</p>
                  </>
                )}
              </div>
              <input type="file" className="hidden" accept=".pdf" multiple onChange={handlePdfDiarioUpload} />
            </label>
          </CardContent>
          </>
        ) : mode === "excel-projuris" ? (
          <>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-500" />
              Planilha Projuris (XLSX)
            </CardTitle>
            <CardDescription>Planilha exportada do Projuris. Os números de processo são lidos da coluna <strong>"Processo"</strong>.</CardDescription>
          </CardHeader>
          <CardContent>
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors border-muted-foreground/25">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                {loadingExcelProjuris ? (
                  <>
                    <Loader2 className="w-8 h-8 mb-2 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Lendo planilha...</p>
                  </>
                ) : excelProjurisFile ? (
                  <>
                    <FileCheck className="w-8 h-8 mb-2 text-green-500" />
                    <p className="text-sm font-medium">{excelProjurisFile.name}</p>
                    <p className="text-xs text-muted-foreground">{excelProjurisProcessos.length} processos encontrados</p>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Clique para selecionar a planilha .xlsx</p>
                  </>
                )}
              </div>
              <input type="file" className="hidden" accept=".xlsx,.xls" onChange={handleExcelProjurisUpload} />
            </label>
          </CardContent>
          </>
        ) : (
          <>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-500" />
              Planilha Astrea (XLSX)
            </CardTitle>
            <CardDescription>Planilha exportada do Astrea. Os números de processo são lidos da coluna <strong>"Número do processo"</strong>.</CardDescription>
          </CardHeader>
          <CardContent>
            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors border-muted-foreground/25">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                {loadingExcelAstrea ? (
                  <>
                    <Loader2 className="w-8 h-8 mb-2 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Lendo planilha...</p>
                  </>
                ) : excelAstreaFile ? (
                  <>
                    <FileCheck className="w-8 h-8 mb-2 text-green-500" />
                    <p className="text-sm font-medium">{excelAstreaFile.name}</p>
                    <p className="text-xs text-muted-foreground">{excelAstreaProcessos.length} processos encontrados</p>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Clique para selecionar a planilha .xlsx</p>
                  </>
                )}
              </div>
              <input type="file" className="hidden" accept=".xlsx,.xls" onChange={handleExcelAstreaUpload} />
            </label>
          </CardContent>
          </>
        )}
        </Card>
      </div>

      {/* Buttons */}
      <div className="flex justify-center gap-3 mb-6">
        <Button
          size="lg"
          onClick={handleComparar}
          disabled={!canCompare}
          className="gap-2"
        >
          <ArrowRightLeft className="w-5 h-5" />
          Comparar Documentos
        </Button>
        {result && (
          <Button
            size="lg"
            variant="outline"
          onClick={() => exportarPdf(result, leftFileName, sourceFileName, analise, { leftLabel, sourceLabel, tiposEsq, tiposDir })}
            className="gap-2"
          >
            <Download className="w-5 h-5" />
            Exportar PDF
          </Button>
        )}
        {result && (result.somente_doc.length > 0 || result.somente_pdf.length > 0) && (
          <Button
            size="lg"
            variant="outline"
            onClick={analisarMotivosSomenteDoc}
            disabled={analisando || monitoramentosConfig.length === 0}
            className="gap-2"
          >
            {analisando ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
            {analisando ? "Analisando motivos..." : "Analisar Motivos (PJE Comunica)"}
          </Button>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-blue-600">{result.processos_doc.length}</p>
                <p className="text-xs text-muted-foreground">Processos no {leftLabel}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-red-600">{result.processos_pdf.length}</p>
                <p className="text-xs text-muted-foreground">Processos no {sourceLabel}</p>
              </CardContent>
            </Card>
            <Card className="border-green-200 bg-green-50 dark:bg-green-950/20">
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-green-600">{result.comuns.length}</p>
                <p className="text-xs text-muted-foreground">Em Comum</p>
              </CardContent>
            </Card>
            <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-amber-600">{result.somente_doc.length}</p>
                <p className="text-xs text-muted-foreground">Somente no {leftLabel}</p>
              </CardContent>
            </Card>
            <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold text-orange-600">{result.somente_pdf.length}</p>
                <p className="text-xs text-muted-foreground">Somente no {sourceLabel}</p>
              </CardContent>
            </Card>
          </div>

          {(tiposEsq || tiposDir) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Classificação por título</CardTitle>
                <CardDescription>
                  Contagem baseada exclusivamente no título/cabeçalho de cada publicação (não analisa o corpo).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2 font-medium">Documento</th>
                        <th className="text-right py-2 px-2 font-medium">CEJUSC-TST</th>
                        <th className="text-right py-2 px-2 font-medium">Pauta de Julgamento</th>
                        <th className="text-right py-2 px-2 font-medium">Lista de Distribuição</th>
                        <th className="text-right py-2 px-2 font-medium text-muted-foreground">Outros</th>
                        <th className="text-right py-2 px-2 font-medium">Repetidos</th>
                        <th className="text-right py-2 px-2 font-medium">Total (blocos)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tiposEsq && (
                        <tr className="border-b">
                          <td className="py-2 px-2">{leftLabel}</td>
                          <td className="py-2 px-2 text-right font-mono">{tiposEsq.cejusc}</td>
                          <td className="py-2 px-2 text-right font-mono">{tiposEsq.pauta}</td>
                          <td className="py-2 px-2 text-right font-mono">{tiposEsq.distribuicao}</td>
                          <td className="py-2 px-2 text-right font-mono text-muted-foreground">{tiposEsq.outros}</td>
                          <td className="py-2 px-2 text-right font-mono">{tiposEsq.repetidos}</td>
                          <td className="py-2 px-2 text-right font-mono font-semibold">{tiposEsq.total}</td>
                        </tr>
                      )}
                      {tiposDir && (
                        <tr>
                          <td className="py-2 px-2">{sourceLabel}</td>
                          <td className="py-2 px-2 text-right font-mono">{tiposDir.cejusc}</td>
                          <td className="py-2 px-2 text-right font-mono">{tiposDir.pauta}</td>
                          <td className="py-2 px-2 text-right font-mono">{tiposDir.distribuicao}</td>
                          <td className="py-2 px-2 text-right font-mono text-muted-foreground">{tiposDir.outros}</td>
                          <td className="py-2 px-2 text-right font-mono">{tiposDir.repetidos}</td>
                          <td className="py-2 px-2 text-right font-mono font-semibold">{tiposDir.total}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {(tiposEsq || tiposDir) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {([
                 { titulo: leftLabel, t: tiposEsq, isLeft: true },
                 { titulo: sourceLabel, t: tiposDir, isLeft: false },
               ] as { titulo: string; t: TipoCounts | null; isLeft: boolean }[])
                 .filter((x) => x.t)
                 .map(({ titulo, t, isLeft }) => {
                   const outro = isLeft ? tiposDir : tiposEsq;
                   const toCounts = (arr: string[]) => {
                     const m = new Map<string, number>();
                     for (const x of arr) m.set(x, (m.get(x) || 0) + 1);
                     return m;
                   };
                   const anyRemaining = toCounts([
                     ...(outro?.cejuscList || []),
                     ...(outro?.pautaList || []),
                     ...(outro?.distribuicaoList || []),
                   ]);
                   const sameRemainingByKey: Record<string, Map<string, number>> = {
                     cejuscList: toCounts(outro?.cejuscList || []),
                     pautaList: toCounts(outro?.pautaList || []),
                     distribuicaoList: toCounts(outro?.distribuicaoList || []),
                   };
                    const selfCounts = toCounts([
                      ...(t?.cejuscList || []),
                      ...(t?.pautaList || []),
                      ...(t?.distribuicaoList || []),
                    ]);
                    const vistosSelf = new Map<string, number>();
                   return (
                  <Card key={titulo}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm">Processos classificados — {titulo}</CardTitle>
                      <CardDescription className="text-xs">
                        Listagem por tipo (CEJUSC, Pauta, Distribuição)
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {([
                          { rotulo: "CEJUSC-TST", lista: t!.cejuscList, cmpKey: "cejuscList" as const, cls: "bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400 border-purple-200" },
                          { rotulo: "Pauta de Julgamento", lista: t!.pautaList, cmpKey: "pautaList" as const, cls: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400 border-indigo-200" },
                          { rotulo: "Lista de Distribuição", lista: t!.distribuicaoList, cmpKey: "distribuicaoList" as const, cls: "bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400 border-sky-200" },
                        ]).map(({ rotulo, lista, cmpKey, cls }) => {
                           const sameRemaining = sameRemainingByKey[cmpKey];
                         return (
                        <div key={rotulo}>
                          <div className="text-xs font-semibold mb-1.5 text-foreground">
                            {rotulo} ({lista.length})
                          </div>
                          {lista.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic">Nenhum processo</p>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                               {lista.map((p, i) => {
                                  let estado: "ok" | "outro" | "ausente" = "ok";
                                  if (outro) {
                                     const nSame = sameRemaining.get(p) || 0;
                                     if (nSame > 0) {
                                       estado = "ok";
                                       sameRemaining.set(p, nSame - 1);
                                       anyRemaining.set(p, (anyRemaining.get(p) || 0) - 1);
                                     } else {
                                       const nAny = anyRemaining.get(p) || 0;
                                       if (nAny > 0) {
                                         estado = "outro";
                                         anyRemaining.set(p, nAny - 1);
                                       } else {
                                         estado = "ausente";
                                       }
                                     }
                                  }
                                  const classe =
                                    estado === "ausente"
                                      ? "text-xs font-mono bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400 border-red-300 font-semibold"
                                      : estado === "outro"
                                      ? "text-xs font-mono bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300 font-semibold"
                                      : `text-xs font-mono ${cls}`;
                                  const totalSelf = selfCounts.get(p) || 0;
                                  const jaVisto = vistosSelf.get(p) || 0;
                                  vistosSelf.set(p, jaVisto + 1);
                                  // Marca TODAS as ocorrências de CNJs repetidos em preto
                                  const isRepetido = totalSelf > 1;
                                  const classeFinal = isRepetido
                                    ? `${classe} !text-black dark:!text-white font-bold`
                                    : classe;
                                  const titulo =
                                    estado === "ausente"
                                      ? (isLeft ? "Não encontrado no PDF (DJEN)" : "Não encontrado no Doc do Advogado")
                                      : estado === "outro"
                                      ? (isLeft
                                          ? "Existe no DJEN, mas em bloco diferente (classificação divergente)"
                                          : "Existe no Doc do Advogado, mas em bloco diferente (classificação divergente)")
                                      : (isRepetido ? `Processo repetido (${totalSelf}x)` : undefined);
                                  return (
                                    <Badge key={`${p}-${i}`} variant="outline" className={classeFinal} title={isRepetido && estado === "ok" ? `Processo repetido (${totalSelf}x)` : titulo}>
                                      {p}
                                    </Badge>
                                  );
                               })}
                            </div>
                          )}
                        </div>
                         );
                       })}
                    </CardContent>
                  </Card>
                   );
                 })}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-8 gap-6">
            <Card className="lg:col-span-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  Processos em Comum ({result.comuns.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {result.comuns.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Nenhum processo em comum</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {result.comuns.map((p, i) => (
                      <div key={i} className="py-1">
                        <Badge variant="outline" className="text-xs font-mono bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400 border-green-200 whitespace-nowrap">
                          {p}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Somente no {leftLabel} ({result.somente_doc.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {result.somente_doc.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Nenhum processo exclusivo</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {result.somente_doc.map((p, i) => (
                      <div key={i} className="py-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs font-mono bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-amber-200 whitespace-nowrap">
                            {p}
                          </Badge>
                          {analise[p]?.loading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                        </div>
                        {analise[p] && !analise[p].loading && analise[p].motivos.length > 0 && (
                          <ul className="mt-1 ml-1 space-y-0.5">
                            {analise[p].motivos.map((m, j) => (
                              <li key={j} className="text-[11px] text-muted-foreground leading-snug">
                                • {m}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-orange-500" />
                  Somente no {sourceLabel} ({result.somente_pdf.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {result.somente_pdf.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic">Nenhum processo exclusivo</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {result.somente_pdf.map((p, i) => (
                      <div key={i} className="py-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs font-mono bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400 border-orange-200 whitespace-nowrap">
                            {p}
                          </Badge>
                          {analise[p]?.loading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                        </div>
                        {analise[p] && !analise[p].loading && analise[p].motivos.length > 0 && (
                          <ul className="mt-1 ml-1 space-y-0.5">
                            {analise[p].motivos.map((m, j) => (
                              <li key={j} className="text-[11px] text-muted-foreground leading-snug">
                                • {m}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
