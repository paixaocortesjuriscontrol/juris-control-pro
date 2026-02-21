import { ExternalLink, Printer, Copy, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn, formatProcessoNumero } from "@/lib/utils";
import { formatConteudoParaExibicao, conteudoDisplayClasses } from "@/utils/formatConteudo";

interface PublicacaoConteudoDjenProps {
  processoNumero: string | null;
  tribunal: string | null;
  fonte: string | null;
  dataDisponibilizacao: string | null;
  dataPublicacao: string | null;
  conteudo: string | null;
  poloAtivo: string | null;
  poloPassivo: string | null;
  monitoramentoOab: string | null;
  monitoramentoUf: string | null;
  monitoramentoTermo: string | null;
  monitoramentoDescricao: string | null;
  className?: string;
  maxHeight?: string;
  // Campos estruturados da API (prioritários sobre regex)
  orgaoEstruturado?: string | null;
  tipoComunicacaoEstruturado?: string | null;
  meioEstruturado?: string | null;
  advogadosJson?: string[] | null;
}

// ============================================================================
// HELPERS
// ============================================================================

const formatDate = (dateString: string | null) => {
  if (!dateString) return "-";
  try {
    return format(parseISO(dateString), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return dateString;
  }
};

const expandMeio = (m: string | null): string => {
  if (!m) return "Diário de Justiça Eletrônico Nacional";
  if (m === "D") return "Diário de Justiça Eletrônico Nacional";
  return m;
};

/** Limpa polo_passivo que vem contaminado com texto da intimação */
const cleanPolo = (polo: string | null): string | null => {
  if (!polo) return null;
  // Corta no primeiro keyword jurídico que indica início de texto de intimação
  const cutMatch = polo.match(/\b(INTIMAÇÃO|INTIMAÇÃO|DESPACHO|SENTENÇA|DECISÃO|ACÓRDÃO|Fica\s+V\.\s*Sa|AIRR|RR-|ROT-|ARR-|PROCESSO)\b/i);
  if (cutMatch && cutMatch.index && cutMatch.index > 3) {
    return polo.substring(0, cutMatch.index).trim();
  }
  // Se o polo é muito longo, provavelmente está contaminado
  if (polo.length > 120) {
    const firstPeriod = polo.indexOf('.');
    if (firstPeriod > 5 && firstPeriod < 100) {
      // Pode ser "S.A." — check for that
      if (!/S\.A\.$/.test(polo.substring(0, firstPeriod + 1))) {
        return polo.substring(0, firstPeriod + 1).trim();
      }
    }
    return polo.substring(0, 100).trim();
  }
  return polo.trim();
};

// ============================================================================
// REGEX FALLBACK: extração de metadados do conteúdo (publicações antigas)
// ============================================================================

const extractMetadataFromContent = (texto: string | null): {
  orgaoExtraido: string | null;
  tipoComunicacao: string | null;
  meio: string | null;
} => {
  if (!texto) return { orgaoExtraido: null, tipoComunicacao: null, meio: null };
  const plain = texto.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

  const orgaoMatch = plain.match(
    /Órgão\s*:\s*(.+?)(?=\s*(?:Data\s+de|Tipo\s+de|Meio\s*:|Processo\s*:|$))/i
  );
  const tipoMatch = plain.match(
    /Tipo\s+de\s+comunica[çc][ãa]o\s*:\s*(.+?)(?=\s*(?:Meio\s*:|Processo\s*:|Data|$))/i
  );
  const meioMatch = plain.match(
    /Meio\s*:\s*(.+?)(?=\s*(?:Processo\s*:|Data|Tipo|Advogado|$))/i
  );

  return {
    orgaoExtraido: orgaoMatch?.[1]?.trim() || null,
    tipoComunicacao: tipoMatch?.[1]?.trim() || null,
    meio: meioMatch?.[1]?.trim() || null,
  };
};

const pareceNomeParte = (value: string): boolean => {
  const v = String(value || "").replace(/\s+/g, " ").trim();
  if (!v) return false;
  if (!/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9]/.test(v)) return false;
  const upper = v.toUpperCase();
  if (upper.startsWith("DJEN") || upper.includes("DJEN DO")) return false;
  if (upper.includes("OAB")) return false;
  if (v.length > 140) return false;
  const tokens = v.split(" ").filter((t) => /[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/i.test(t));
  const meaningful = tokens.filter((t) => t.length >= 2);
  const hasMinWords = meaningful.length >= 2;
  const hasSuffix = /\b(LTDA|S\.?A\.?|S\/A|EIRELI|ME|EPP)\b/i.test(v);
  return hasMinWords || hasSuffix;
};

const pareceNomeAdvogado = (value: string): boolean => {
  const v = String(value || "").replace(/\s+/g, " ").trim();
  if (!v) return false;
  if (!/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(v)) return false;
  const upper = v.toUpperCase();
  if (upper.startsWith("DJEN") || upper.includes("DJEN DO")) return false;
  if (v.length > 90) return false;
  const tokens = v.split(" ").filter((t) => /[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/i.test(t));
  const meaningful = tokens.filter((t) => t.length >= 2);
  return meaningful.length >= 2;
};

/**
 * Extrai partes e advogados do conteúdo da publicação e dos campos estruturados.
 * Estratégia: 
 *   1. Partes: polo_ativo/passivo, bloco "Advogados:" no header (que na verdade contém partes),
 *      advogados_json sem OAB, e padrões rotulados (AGRAVANTE, RECLAMANTE, etc.)
 *   2. Advogados: advogados_json com OAB, padrões OAB no texto, e padrões "Dr./Dra." no texto
 */
const extractPartesAndAdvogados = (
  texto: string | null,
  poloAtivo: string | null,
  poloPassivo: string | null,
  advogadosJson: string[] | null,
): { partes: string[]; advogados: string[] } => {
  const partes: string[] = [];
  const advogados: string[] = [];
  const advSet = new Set<string>();
  const partesSet = new Set<string>();

  const addParte = (nome: string) => {
    const clean = nome.trim();
    if (!clean || !pareceNomeParte(clean)) return;
    const key = clean.toUpperCase();
    if (partesSet.has(key)) return;
    partes.push(clean);
    partesSet.add(key);
  };

  const addAdvogado = (entry: string, dedup_key?: string) => {
    const key = dedup_key || entry.toUpperCase();
    if (advSet.has(key)) return;
    advSet.add(key);
    advogados.push(entry);
  };

  // ── 1. Partes dos polos ───────────────────────────────────────────────
  addParte(cleanPolo(poloAtivo) || '');
  addParte(cleanPolo(poloPassivo) || '');

  // ── 2. Partes do bloco "Advogados:" no header do conteúdo ─────────────
  // O DJEN coloca nomes de partes sob o rótulo "Advogados:" no cabeçalho
  if (texto) {
    const headerMatch = texto.match(/Advogados?\s*:\s*\n([\s\S]*?)(?=\n\s*\n|\nPODER\b|\nINTIMAÇÃO\b|\nDESPACHO\b|\nSENTENÇA\b|\nDECISÃO\b|\nACÓRDÃO\b|\nEDITAL\b|\nCERTIDÃO\b|$)/i);
    if (headerMatch?.[1]) {
      const linhas = headerMatch[1].split('\n').map(l => l.trim()).filter(Boolean);
      for (const linha of linhas) {
        if (/OAB/i.test(linha)) {
          // É um advogado real com OAB
          addAdvogado(linha);
        } else {
          addParte(linha);
        }
      }
    }
  }

  // ── 3. Partes do advogados_json (itens sem OAB são partes) ────────────
  if (advogadosJson && Array.isArray(advogadosJson)) {
    for (const item of advogadosJson) {
      const s = String(item || '').trim();
      if (!s) continue;
      if (/OAB/i.test(s)) {
        addAdvogado(s);
      } else {
        addParte(s);
      }
    }
  }

  // ── 4. Partes de padrões rotulados no texto ───────────────────────────
  if (texto && partes.length === 0) {
    const plainText = texto.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    const labelPatterns: RegExp[] = [
      /AGRAVANTE[:\s]+([^\n]+?)(?=\s+(?:AGRAVADO|ADV|ADVOGADO|INTIMAÇÃO|OAB|\d{7}|$))/i,
      /AGRAVADO[:\s]+([^\n]+?)(?=\s+(?:ADV|ADVOGADO|INTIMAÇÃO|OAB|\d{7}|$))/i,
      /RECLAMANTE[:\s]+([^\n]+?)(?=\s+(?:RECLAMADO|ADV|ADVOGADO|INTIMAÇÃO|OAB|\d{7}|$))/i,
      /RECLAMADO[:\s]+([^\n]+?)(?=\s+(?:ADV|ADVOGADO|INTIMAÇÃO|OAB|\d{7}|$))/i,
      /EXEQUENTE[:\s]+([^\n]+?)(?=\s+(?:EXECUTADO|ADV|ADVOGADO|INTIMAÇÃO|OAB|\d{7}|$))/i,
      /EXECUTADO[:\s]+([^\n]+?)(?=\s+(?:E OUTROS|INTIMAÇÃO|ADV|ADVOGADO|OAB|\d{7}|$))/i,
      /AUTOR[:\s]+([^\n]+?)(?=\s+(?:R[ÉE]U|ADV|ADVOGADO|INTIMAÇÃO|OAB|\d{7}|$))/i,
      /R[ÉE]U[:\s]+([^\n]+?)(?=\s+(?:ADV|ADVOGADO|INTIMAÇÃO|OAB|\d{7}|$))/i,
      /REQUERENTE[:\s]+([^\n]+?)(?=\s+(?:REQUERIDO|ADV|ADVOGADO|INTIMAÇÃO|OAB|\d{7}|$))/i,
      /REQUERIDO[:\s]+([^\n]+?)(?=\s+(?:ADV|ADVOGADO|INTIMAÇÃO|OAB|\d{7}|$))/i,
      /IMPETRANTE[:\s]+([^\n]+?)(?=\s+(?:IMPETRADO|ADV|ADVOGADO|INTIMAÇÃO|OAB|\d{7}|$))/i,
      /IMPETRADO[:\s]+([^\n]+?)(?=\s+(?:ADV|ADVOGADO|INTIMAÇÃO|OAB|\d{7}|$))/i,
      /EMBARGANTE[:\s]+([^\n]+?)(?=\s+(?:EMBARGADO|ADV|ADVOGADO|INTIMAÇÃO|OAB|\d{7}|$))/i,
      /EMBARGADO[:\s]+([^\n]+?)(?=\s+(?:ADV|ADVOGADO|INTIMAÇÃO|OAB|\d{7}|$))/i,
      /APELANTE[:\s]+([^\n]+?)(?=\s+(?:APELADO|ADV|ADVOGADO|INTIMAÇÃO|OAB|\d{7}|$))/i,
      /APELADO[:\s]+([^\n]+?)(?=\s+(?:ADV|ADVOGADO|INTIMAÇÃO|OAB|\d{7}|$))/i,
    ];
    for (const pattern of labelPatterns) {
      const match = plainText.match(pattern);
      if (!match?.[1]) continue;
      const candidato = match[1].trim().replace(/\s+E\s+OUTROS.*$/i, "");
      addParte(candidato);
    }
  }

  // ── 5. Advogados via regex OAB no texto ───────────────────────────────
  if (texto) {
    const plainText = texto.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

    // Formato: NOME (OAB 12345/SP) ou NOME (OAB: 12345/SP)
    for (const match of plainText.matchAll(
      /([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç\s]+?)\s*\(OAB[:\s]*(\d{1,10})\s*\/?\s*([A-Z]{2})(?:-[A-Z])?\)/g
    )) {
      const nome = (match[1] || "").trim();
      const numero = (match[2] || "").trim();
      const uf = (match[3] || "").toUpperCase();
      if (numero && uf && pareceNomeAdvogado(nome)) {
        addAdvogado(`${nome} - OAB ${uf}-${numero}`, `${numero}-${uf}`);
      }
    }

    // Formato: NOME - OAB UF-12345 ou NOME OAB: UF-12345
    for (const match of plainText.matchAll(
      /([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç\s]+?)\s*-?\s*OAB[:\s]*([A-Z]{2})[:\s-]*(\d{1,10})/gi
    )) {
      const nome = (match[1] || "").trim();
      const uf = (match[2] || "").toUpperCase();
      const numero = (match[3] || "").trim();
      if (numero && uf && pareceNomeAdvogado(nome)) {
        addAdvogado(`${nome} - OAB ${uf}-${numero}`, `${numero}-${uf}`);
      }
    }
  }

  return { partes, advogados };
};

/**
 * Remove cabeçalhos de metadados repetidos do início do conteúdo
 * (Órgão:, Data de disponibilização:, Tipo de comunicação:, Meio:, Processo:, Advogados:)
 * para evitar duplicação com a sidebar de metadados.
 */
const stripMetadataFromContent = (texto: string | null): string | null => {
  if (!texto) return texto;
  let plain = texto;
  // Remove linhas de cabeçalho comuns no início
  const headerPattern = /^(\s*(Órgão\s*:|Data\s+de\s+(disponibilização|publicação)\s*:|Tipo\s+de\s+comunica[çc][ãa]o\s*:|Meio\s*:|Processo\s*:|Advogados?\s*:)[^\n]*\n?)+/im;
  plain = plain.replace(headerPattern, '');
  // Remove bloco "Advogados:" com nomes em sequência (sem OAB)
  plain = plain.replace(/Advogados?\s*:\s*\n(?:[A-ZÁÉÍÓÚÂÊÔÃÕÇ][^\n]*\n?){1,10}/i, '');
  return plain.trim() || texto;
};

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export function PublicacaoConteudoDjen({
  processoNumero,
  tribunal,
  fonte,
  dataDisponibilizacao,
  dataPublicacao,
  conteudo,
  poloAtivo,
  poloPassivo,
  monitoramentoOab,
  monitoramentoUf,
  monitoramentoTermo,
  monitoramentoDescricao,
  className,
  maxHeight,
  orgaoEstruturado,
  tipoComunicacaoEstruturado,
  meioEstruturado,
  advogadosJson,
}: PublicacaoConteudoDjenProps) {
  // Usar dados estruturados com fallback para regex
  const contentMeta = extractMetadataFromContent(conteudo);

  const orgao = orgaoEstruturado || contentMeta.orgaoExtraido || fonte || tribunal || "-";
  const tipoComunicacao = tipoComunicacaoEstruturado || contentMeta.tipoComunicacao || "Intimação";
  const meioPublicacao = expandMeio(meioEstruturado || contentMeta.meio);

  // Extrai partes e advogados de todas as fontes disponíveis
  const { partes: partesFinais, advogados } = extractPartesAndAdvogados(
    conteudo, poloAtivo, poloPassivo, advogadosJson
  );

  // Conteúdo limpo (sem cabeçalhos de metadados duplicados)
  const conteudoLimpo = stripMetadataFromContent(conteudo);

  const handleCopy = (withFormatting: boolean) => {
    const text = withFormatting
      ? conteudo || ""
      : conteudo?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || "";
    navigator.clipboard.writeText(text);
    toast.success(withFormatting ? "Copiado com formatação" : "Copiado sem formatação");
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Publicação ${processoNumero || ""}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; font-size: 12pt; }
            h1 { font-size: 14pt; color: #1e40af; margin-bottom: 20px; }
            .meta { margin-bottom: 20px; line-height: 1.8; }
            .meta strong { color: #374151; }
            .conteudo { border-top: 1px solid #e5e7eb; padding-top: 20px; line-height: 1.6; }
            .partes { margin: 15px 0; }
            .partes li { list-style: none; padding: 5px 0; }
          </style>
        </head>
        <body>
          <h1>Processo ${processoNumero || "-"}</h1>
          <div class="meta">
            <p><strong>Órgão:</strong> ${orgao}</p>
            <p><strong>Data de disponibilização:</strong> ${formatDate(dataDisponibilizacao)}</p>
            <p><strong>Tipo de comunicação:</strong> ${tipoComunicacao}</p>
            <p><strong>Meio:</strong> ${meioPublicacao}</p>
          </div>
          ${partesFinais.length > 0 ? `<div class="partes"><strong>Parte(s):</strong><ul>${partesFinais.map((p) => `<li>${p}</li>`).join("")}</ul></div>` : ""}
          ${advogados.length > 0 ? `<div class="partes"><strong>Advogado(s):</strong><ul>${advogados.map((a) => `<li>${a}</li>`).join("")}</ul></div>` : ""}
          <div class="conteudo">${conteudo || ""}</div>
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header com número do processo e ações */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-3 border-b border-primary/20">
        <h3 className="text-base md:text-lg font-semibold text-primary">
          Processo {formatProcessoNumero(processoNumero)}
        </h3>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} className="text-xs h-8">
            <Printer className="w-3.5 h-3.5 mr-1.5" />
            Imprimir
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleCopy(true)} className="text-xs h-8">
            <Copy className="w-3.5 h-3.5 mr-1.5" />
            Copiar
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleCopy(false)} className="text-xs h-8">
            <FileText className="w-3.5 h-3.5 mr-1.5" />
            <span className="hidden sm:inline">Copiar sem formatação</span>
            <span className="sm:hidden">Texto</span>
          </Button>
        </div>
      </div>

      {/* Layout split: sidebar fixa + conteúdo com scroll */}
      <div
        className="flex flex-col lg:flex-row overflow-hidden"
        style={maxHeight ? { maxHeight } : undefined}
      >
        {/* Coluna esquerda - Metadados (sticky) */}
        <aside className="lg:w-[280px] xl:w-[320px] shrink-0 lg:overflow-y-auto lg:border-r border-border bg-muted/30 p-3 md:p-4 space-y-3 text-sm rounded-t-lg lg:rounded-l-lg lg:rounded-tr-none">
          <div>
            <span className="font-semibold text-muted-foreground">Órgão: </span>
            <span className="font-medium">{orgao}</span>
          </div>

          <div>
            <span className="font-semibold text-muted-foreground">Data de disponibilização: </span>
            <span>{formatDate(dataDisponibilizacao)}</span>
          </div>

          <div>
            <span className="font-semibold text-muted-foreground">Tipo de comunicação: </span>
            <span>{tipoComunicacao}</span>
          </div>

          <div>
            <span className="font-semibold text-muted-foreground">Meio: </span>
            <span>{meioPublicacao}</span>
          </div>

          <div>
            <span className="font-semibold text-muted-foreground">Inteiro teor: </span>
            <a
              href={`https://comunicaapi.pje.jus.br/v1/comunicacoes/${processoNumero || ""}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              Clique aqui
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Partes */}
          {partesFinais.length > 0 && (
            <div className="pt-2 border-t border-border">
              <p className="font-semibold text-muted-foreground mb-1.5">Parte(s)</p>
              <ul className="space-y-1">
                {partesFinais.map((parte, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-destructive mt-0.5 shrink-0">👤</span>
                    <span className="break-words">{parte}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Advogados */}
          {advogados.length > 0 && (
            <div className="pt-2 border-t border-border">
              <p className="font-semibold text-muted-foreground mb-1.5">Advogado(s)</p>
              <ul className="space-y-1">
                {advogados.map((adv, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-primary mt-0.5 shrink-0">⚖️</span>
                    <span className="break-words">{adv}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        {/* Coluna direita - Conteúdo (scroll independente) */}
        <main className="flex-1 lg:overflow-y-auto p-3 md:p-4">
          <div
            className={cn(
              "p-3 md:p-4 bg-muted/10 rounded-lg border text-sm",
              conteudoDisplayClasses
            )}
          >
            {formatConteudoParaExibicao(conteudoLimpo, true)}
          </div>
        </main>
      </div>
    </div>
  );
}
