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
}

/**
 * Componente que exibe o conteúdo de uma publicação DJEN no formato oficial do portal.
 * Layout em duas colunas: metadados à esquerda, conteúdo à direita.
 */
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
}: PublicacaoConteudoDjenProps) {
  
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    try {
      return format(parseISO(dateString), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  // Extrair órgão/vara do conteúdo (geralmente está no início)
  const extractOrgao = (texto: string | null): string => {
    if (!texto) return "-";
    // Tenta encontrar padrões como "1ª Vara Cível de Brasília" ou "4VARCIVBSB"
    const plainText = texto.replace(/<[^>]*>/g, ' ').trim();
    
    // Procura por vara/câmara no início do texto
    const varaMatch = plainText.match(/(\d+[ªº]?\s*(?:Vara|Câmara|Turma)[^,.\n]+)/i);
    if (varaMatch) return varaMatch[1].trim();
    
    // Procura por padrão do tribunal (ex: 1VARCIVBSB)
    const siglaTribunal = fonte || tribunal || "-";
    return siglaTribunal;
  };

  /**
   * Heurísticas LEVES para evitar “sujeira” (ex.: descrição do termo/trechos do texto)
   * sem bloquear palavras jurídicas reais do conteúdo.
   *
   * Regra de ouro: partes/advogados exibidos aqui devem vir do CONTEÚDO da publicação
   * (ou dos campos estruturados poloAtivo/poloPassivo), nunca do termo de monitoramento.
   */
  const pareceNomeParte = (value: string): boolean => {
    const v = String(value || "").replace(/\s+/g, " ").trim();
    if (!v) return false;

    // Ex.: "para se manifestar..." (não é nome)
    if (!/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9]/.test(v)) return false;

    const upper = v.toUpperCase();

    // Evita injeção do termo de monitoramento
    if (upper.startsWith("DJEN") || upper.includes("DJEN DO")) return false;

    // Partes não devem carregar OAB
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

    // Evita injeção do termo de monitoramento
    if (upper.startsWith("DJEN") || upper.includes("DJEN DO")) return false;

    if (v.length > 90) return false;

    // Advogado deve ter pelo menos nome + sobrenome
    const tokens = v.split(" ").filter((t) => /[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/i.test(t));
    const meaningful = tokens.filter((t) => t.length >= 2);

    return meaningful.length >= 2;
  };

  // Extrair partes e advogados APENAS do texto da publicação
  const extractPartes = (texto: string | null): { partes: string[]; advogados: string[] } => {
    const partes: string[] = [];
    const advogados: string[] = [];

    const advSet = new Set<string>();
    const partesSet = new Set<string>();

    // Usar poloAtivo/poloPassivo apenas se vierem limpos
    if (poloAtivo && pareceNomeParte(poloAtivo)) {
      const v = poloAtivo.trim();
      partes.push(v);
      partesSet.add(v.toUpperCase());
    }
    if (poloPassivo && pareceNomeParte(poloPassivo)) {
      const v = poloPassivo.trim();
      partes.push(v);
      partesSet.add(v.toUpperCase());
    }

    if (texto) {
      const plainText = texto.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

      // Extrair partes do texto apenas se não vieram preenchidas
      if (partes.length === 0) {
        // LABEL: NOME até próximo label ou número de processo
        const labelPatterns: RegExp[] = [
          /EXEQUENTE[:\s]+([^\n]+?)(?=\s+(?:EXECUTADO|ADV|ADVOGADO|INTIMAÇÃO|OAB|\d{7}|$))/i,
          /EXECUTADO[:\s]+([^\n]+?)(?=\s+(?:E OUTROS|INTIMAÇÃO|ADV|ADVOGADO|OAB|\d{7}|$))/i,
          /AUTOR[:\s]+([^\n]+?)(?=\s+(?:R[ÉE]U|ADV|ADVOGADO|INTIMAÇÃO|OAB|\d{7}|$))/i,
          /R[ÉE]U[:\s]+([^\n]+?)(?=\s+(?:ADV|ADVOGADO|INTIMAÇÃO|OAB|\d{7}|$))/i,
          /REQUERENTE[:\s]+([^\n]+?)(?=\s+(?:REQUERIDO|ADV|ADVOGADO|INTIMAÇÃO|OAB|\d{7}|$))/i,
          /REQUERIDO[:\s]+([^\n]+?)(?=\s+(?:ADV|ADVOGADO|INTIMAÇÃO|OAB|\d{7}|$))/i,
          /RECLAMANTE[:\s]+([^\n]+?)(?=\s+(?:RECLAMADO|ADV|ADVOGADO|INTIMAÇÃO|OAB|\d{7}|$))/i,
          /RECLAMADO[:\s]+([^\n]+?)(?=\s+(?:ADV|ADVOGADO|INTIMAÇÃO|OAB|\d{7}|$))/i,
        ];

        for (const pattern of labelPatterns) {
          const match = plainText.match(pattern);
          if (!match?.[1]) continue;

          const candidato = match[1].trim().replace(/\s+E\s+OUTROS.*$/i, "");
          if (!pareceNomeParte(candidato)) continue;

          const key = candidato.toUpperCase();
          if (partesSet.has(key)) continue;

          partes.push(candidato);
          partesSet.add(key);
        }
      }

      // Extrair advogados - múltiplos formatos (sempre do conteúdo)
      // Formato 1: "NOME (OAB 12345/DF)" ou "NOME (OAB 12345/DF-A)"
      const advFormat1 = plainText.matchAll(
        /([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç\s]+?)\s*\(OAB[:\s]*(\d{1,10})\s*\/?\s*([A-Z]{2})(?:-[A-Z])?\)/g
      );
      for (const match of advFormat1) {
        const nome = (match[1] || "").trim();
        const numero = (match[2] || "").trim();
        const uf = (match[3] || "").toUpperCase();
        const key = `${numero}-${uf}`;
        if (!numero || !uf) continue;
        if (advSet.has(key)) continue;
        if (!pareceNomeAdvogado(nome)) continue;

        advSet.add(key);
        advogados.push(`${nome} - OAB ${uf}-${numero}`);
      }

      // Formato 2: "ADV: NOME (OAB 12345/DF)"
      const advFormat2 = plainText.matchAll(
        /ADV(?:OGADO)?[:\s]+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç\s]+?)\s*\(OAB[:\s]*(\d{1,10})\s*\/?\s*([A-Z]{2})(?:-[A-Z])?\)/gi
      );
      for (const match of advFormat2) {
        const nome = (match[1] || "").trim();
        const numero = (match[2] || "").trim();
        const uf = (match[3] || "").toUpperCase();
        const key = `${numero}-${uf}`;
        if (!numero || !uf) continue;
        if (advSet.has(key)) continue;
        if (!pareceNomeAdvogado(nome)) continue;

        advSet.add(key);
        advogados.push(`${nome} - OAB ${uf}-${numero}`);
      }

      // Formato 3: "NOME - OAB DF-12345" ou "NOME OAB DF 12345"
      const advFormat3 = plainText.matchAll(
        /([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇa-záéíóúâêôãõç\s]+?)\s*-?\s*OAB[:\s]*([A-Z]{2})[:\s-]*(\d{1,10})/gi
      );
      for (const match of advFormat3) {
        const nome = (match[1] || "").trim();
        const uf = (match[2] || "").toUpperCase();
        const numero = (match[3] || "").trim();
        const key = `${numero}-${uf}`;
        if (!numero || !uf) continue;
        if (advSet.has(key)) continue;
        if (!pareceNomeAdvogado(nome)) continue;

        advSet.add(key);
        advogados.push(`${nome} - OAB ${uf}-${numero}`);
      }
    }

    return { partes, advogados };
  };

  const orgao = extractOrgao(conteudo);
  const { partes, advogados } = extractPartes(conteudo);

  const handleCopy = (withFormatting: boolean) => {
    const text = withFormatting 
      ? conteudo || ""
      : (conteudo?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || "");
    
    navigator.clipboard.writeText(text);
    toast.success(withFormatting ? "Copiado com formatação" : "Copiado sem formatação");
  };

  const handlePrint = () => {
    // Abrir janela de impressão com o conteúdo formatado
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Publicação ${processoNumero || ''}</title>
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
          <h1>Processo ${processoNumero || '-'}</h1>
          <div class="meta">
            <p><strong>Órgão:</strong> ${orgao}</p>
            <p><strong>Data de disponibilização:</strong> ${formatDate(dataDisponibilizacao)}</p>
            <p><strong>Tipo de comunicação:</strong> Intimação</p>
            <p><strong>Meio:</strong> Diário de Justiça Eletrônico Nacional</p>
          </div>
          ${partes.length > 0 ? `
          <div class="partes">
            <strong>Parte(s):</strong>
            <ul>${partes.map(p => `<li>${p}</li>`).join('')}</ul>
          </div>
          ` : ''}
          ${advogados.length > 0 ? `
          <div class="partes">
            <strong>Advogado(s):</strong>
            <ul>${advogados.map(a => `<li>${a}</li>`).join('')}</ul>
          </div>
          ` : ''}
          <div class="conteudo">
            ${conteudo || ''}
          </div>
        </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header com número do processo e ações */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-3 border-b border-primary/20">
        <h3 className="text-base md:text-lg font-semibold text-primary">
          Processo {formatProcessoNumero(processoNumero)}
        </h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="text-xs h-8"
          >
            <Printer className="w-3.5 h-3.5 mr-1.5" />
            Imprimir
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleCopy(true)}
            className="text-xs h-8"
          >
            <Copy className="w-3.5 h-3.5 mr-1.5" />
            Copiar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleCopy(false)}
            className="text-xs h-8"
          >
            <FileText className="w-3.5 h-3.5 mr-1.5" />
            <span className="hidden sm:inline">Copiar sem formatação</span>
            <span className="sm:hidden">Texto</span>
          </Button>
        </div>
      </div>

      {/* Layout em duas colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Coluna esquerda - Metadados */}
        <div className="lg:col-span-1 space-y-3 text-sm">
          <div>
            <span className="font-semibold text-muted-foreground">Órgão: </span>
            <span>{orgao}</span>
          </div>
          
          <div>
            <span className="font-semibold text-muted-foreground">Data de disponibilização: </span>
            <span>{formatDate(dataDisponibilizacao)}</span>
          </div>
          
          <div>
            <span className="font-semibold text-muted-foreground">Tipo de comunicação: </span>
            <span>Intimação</span>
          </div>
          
          <div>
            <span className="font-semibold text-muted-foreground">Meio: </span>
            <span>Diário de Justiça Eletrônico Nacional</span>
          </div>
          
          <div>
            <span className="font-semibold text-muted-foreground">Inteiro teor: </span>
            <a 
              href={`https://comunicaapi.pje.jus.br/v1/comunicacoes/${processoNumero || ''}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              Clique aqui
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Partes */}
          {partes.length > 0 && (
            <div className="pt-2">
              <p className="font-semibold text-muted-foreground mb-1.5">Parte(s)</p>
              <ul className="space-y-1">
                {partes.map((parte, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-destructive mt-0.5">👤</span>
                    <span className="break-words">{parte}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Advogados */}
          {advogados.length > 0 && (
            <div className="pt-2">
              <p className="font-semibold text-muted-foreground mb-1.5">Advogado(s)</p>
              <ul className="space-y-1">
                {advogados.map((adv, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-primary mt-0.5">⚖️</span>
                    <span className="break-words">{adv}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Coluna direita - Conteúdo */}
        <div className="lg:col-span-2">
          <div className={cn(
            "p-3 md:p-4 bg-muted/30 rounded-lg border text-sm",
            conteudoDisplayClasses
          )}>
            {formatConteudoParaExibicao(conteudo)}
          </div>
        </div>
      </div>
    </div>
  );
}
