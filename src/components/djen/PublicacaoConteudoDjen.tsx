import { ExternalLink, Printer, Copy, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
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
   * Valida se um texto parece ser um nome de pessoa/empresa válido.
   * Rejeita textos que são claramente trechos de texto jurídico ou descrições.
   */
  const isNomeValido = (nome: string): boolean => {
    if (!nome || nome.length < 3) return false;
    // Rejeita se contiver palavras que indicam texto de sentença
    const palavrasInvalidas = [
      'intimação', 'despacho', 'sentença', 'manifestar', 'embargos',
      'declaração', 'opostos', 'reclamante', 'petição', 'prazo',
      'ciência', 'decisão', 'djen', 'diário', 'justiça', 'eletrônico',
      'nacional', 'para', 'sobre', 'pelo', 'pela'
    ];
    const nomeNorm = nome.toLowerCase();
    if (palavrasInvalidas.some(p => nomeNorm.includes(p))) return false;
    // Rejeita se tiver mais de 60 chars (muito longo para nome)
    if (nome.length > 60) return false;
    // Rejeita se não começar com letra maiúscula
    if (!/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(nome)) return false;
    return true;
  };

  /**
   * Valida se um nome de advogado é válido (não é termo de monitoramento).
   */
  const isAdvogadoValido = (nome: string): boolean => {
    if (!isNomeValido(nome)) return false;
    const nomeNorm = nome.toUpperCase();
    // Rejeita se for claramente um termo de monitoramento
    if (nomeNorm.includes('DJEN') || nomeNorm.includes('TJDFT') || 
        nomeNorm.includes('TRF') || nomeNorm.includes('STJ') ||
        nomeNorm.includes('TRT') || nomeNorm.includes('TST')) {
      return false;
    }
    // Advogado deve ter pelo menos um espaço (nome + sobrenome)
    if (!nome.includes(' ')) return false;
    return true;
  };

  // Extrair partes e advogados APENAS do texto da publicação
  const extractPartes = (texto: string | null): { partes: string[], advogados: string[] } => {
    const partes: string[] = [];
    const advogados: string[] = [];
    const advSet = new Set<string>();
    const partesSet = new Set<string>();
    
    // Usar poloAtivo/poloPassivo apenas se forem válidos
    if (poloAtivo && isNomeValido(poloAtivo)) {
      partes.push(poloAtivo);
      partesSet.add(poloAtivo.toUpperCase());
    }
    if (poloPassivo && isNomeValido(poloPassivo)) {
      partes.push(poloPassivo);
      partesSet.add(poloPassivo.toUpperCase());
    }
    
    if (texto) {
      const plainText = texto.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      
      // Extrair partes do texto apenas se não vieram preenchidas
      if (partes.length === 0) {
        // Padrão mais estrito: LABEL: NOME até próximo label ou número de processo
        const labelPatterns = [
          /EXEQUENTE[:\s]+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]+?)(?=\s+(?:EXECUTADO|ADV|ADVOGADO|INTIMAÇÃO|OAB|\d{7}|$))/i,
          /EXECUTADO[:\s]+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]+?)(?=\s+(?:E OUTROS|INTIMAÇÃO|ADV|ADVOGADO|OAB|\d{7}|$))/i,
          /AUTOR[:\s]+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]+?)(?=\s+(?:R[ÉE]U|ADV|ADVOGADO|INTIMAÇÃO|OAB|\d{7}|$))/i,
          /R[ÉE]U[:\s]+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]+?)(?=\s+(?:ADV|ADVOGADO|INTIMAÇÃO|OAB|\d{7}|$))/i,
          /REQUERENTE[:\s]+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]+?)(?=\s+(?:REQUERIDO|ADV|ADVOGADO|INTIMAÇÃO|OAB|\d{7}|$))/i,
          /REQUERIDO[:\s]+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]+?)(?=\s+(?:ADV|ADVOGADO|INTIMAÇÃO|OAB|\d{7}|$))/i,
          /RECLAMANTE[:\s]+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]+?)(?=\s+(?:RECLAMADO|ADV|ADVOGADO|INTIMAÇÃO|OAB|\d{7}|$))/i,
          /RECLAMADO[:\s]+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]+?)(?=\s+(?:ADV|ADVOGADO|INTIMAÇÃO|OAB|\d{7}|$))/i,
        ];
        
        for (const pattern of labelPatterns) {
          const match = plainText.match(pattern);
          if (match) {
            const nome = match[1].trim().replace(/\s+E\s+OUTROS.*$/i, '');
            if (isNomeValido(nome) && !partesSet.has(nome.toUpperCase())) {
              partes.push(nome);
              partesSet.add(nome.toUpperCase());
            }
          }
        }
      }
      
      // Extrair advogados - apenas formatos bem definidos
      // Formato: "NOME (OAB NUMERO/UF)" ou "NOME (OAB UF NUMERO)"
      const advFormat1 = plainText.matchAll(/([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]{3,40}?)\s*\(OAB[:\s]*(\d{3,6})\s*\/\s*([A-Z]{2})\)/gi);
      for (const match of advFormat1) {
        const nome = match[1].trim();
        const numero = match[2];
        const uf = match[3].toUpperCase();
        const key = `${numero}-${uf}`;
        if (!advSet.has(key) && isAdvogadoValido(nome)) {
          advSet.add(key);
          advogados.push(`${nome} - OAB ${uf}-${numero}`);
        }
      }
      
      // Formato: "ADV: NOME (OAB NUMERO/UF)"
      const advFormat2 = plainText.matchAll(/ADV(?:OGADO)?[:\s]+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]{3,40}?)\s*\(OAB[:\s]*(\d{3,6})\s*\/\s*([A-Z]{2})\)/gi);
      for (const match of advFormat2) {
        const nome = match[1].trim();
        const numero = match[2];
        const uf = match[3].toUpperCase();
        const key = `${numero}-${uf}`;
        if (!advSet.has(key) && isAdvogadoValido(nome)) {
          advSet.add(key);
          advogados.push(`${nome} - OAB ${uf}-${numero}`);
        }
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
          Processo {processoNumero || "-"}
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
