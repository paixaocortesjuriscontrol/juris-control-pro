/**
 * Linha resumida com as partes da publicação, exibida imediatamente abaixo do
 * número do processo na Análise DJEN (Browser e Servidor).
 *
 * Usa polo_ativo/polo_passivo quando disponíveis e, na ausência deles, tenta
 * derivar os nomes a partir de partes_json (estrutura devolvida pelo DJEN).
 */
interface PartesResumoLinhaProps {
  poloAtivo?: string | null;
  poloPassivo?: string | null;
  partesJson?: any;
  className?: string;
}

const ATIVO_RE = /(reclamante|autor|requerente|exequente|impetrante|agravante|recorrente|embargante)/i;
const PASSIVO_RE = /(reclamad|réu|reu|requerid|executad|impetrad|agravad|recorrid|embargad)/i;
const INICIO_TEXTO_RE = /\b(?:SENTENÇA|DECISÃO|DESPACHO|ACÓRDÃO|EMENTA|RELATÓRIO|INTIMAÇÃO|CERTIDÃO|EDITAL|CLASSE\s+PROCESSUAL|INTEIRO\s+TEOR)\b/i;
/** Sinais de que o campo veio "cru" do DJEN, misturando advogados, terceiros e polos. */
const CONTAMINADO_RE = /(advogad|terceiro\(s\)|interessad|relator|situa[çc][ãa]o|do\s+polo\s+(?:ativo|passivo)|minist[ée]rio\s+p[úu]blico)/i;

/** Impede que o inteiro teor, ocasionalmente gravado junto ao polo, apareça na linha de partes. */
function limparPolo(bruto: string | null | undefined): string {
  const valor = String(bruto || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (!valor) return "";

  const inicioTexto = valor.search(INICIO_TEXTO_RE);
  const limpo = inicioTexto > 0 ? valor.slice(0, inicioTexto).trim() : valor;

  // Campo misturado (advogados/terceiros/relator) não é confiável: partes_json
  // é a fonte correta para separar ativo e passivo.
  if (CONTAMINADO_RE.test(limpo)) return "";

  // Um nome de parte não deve ocupar um parágrafo. Nesses casos, partes_json
  // é uma fonte mais segura; sem ela, é preferível ocultar a linha contaminada.
  if (limpo.length > 220 || /\b(?:art\.|processo\s+caso|nos\s+termos|decidiu|condena[çc][ãa]o)\b/i.test(limpo)) {
    return "";
  }
  return limpo.replace(/[|;,\-–—:\s]+$/, "").trim();
}


/**
 * Alguns motores gravam as partes como texto, no formato
 * "[Polo Ativo] NOME DA PARTE" ou "[Parte] NOME POLOA" (ou POLOP).
 */
function parseParteString(bruto: string): { nome: string; polo: string; advogado: boolean } {
  let txt = bruto.trim();
  let polo = "";
  let advogado = false;
  const prefixo = txt.match(/^\[([^\]]*)\]\s*/);
  if (prefixo) {
    const tag = prefixo[1];
    if (/advogad/i.test(tag)) advogado = true;
    if (/passiv/i.test(tag)) polo = "P";
    else if (/ativ/i.test(tag)) polo = "A";
    else if (/terceiro|interessad/i.test(tag)) polo = "X";
    txt = txt.slice(prefixo[0].length).trim();
  }
  const m = txt.match(/\s*POLO\s*([AP])\s*$/i);
  if (m) {
    polo = m[1].toUpperCase();
    txt = txt.slice(0, m.index).trim();
  }
  return { nome: txt.trim(), polo, advogado };
}

/** Marcadores que indicam o fim do nome da parte e o início de outro conteúdo. */
const FIM_NOME_RE = /\b(?:REPRESENTANTES?|ADVOGAD[OA]S?|PROCURADOR(?:ES|A|AS)?|TERCEIRO|INTERESSAD[OA]S?|POLO\s+(?:ATIVO|PASSIVO)|PARTES?\s+NOME|ID\s+COMUNICA)\b/i;
/** Fragmentos de texto jurídico que nunca são nome de parte. */
const NAO_NOME_RE = /\b(?:art\.|artigo|lei\s+n|s[úu]mula|inciso|par[áa]grafo|cpc|cdc|clt|§)\b/i;

/** Limpeza leve para nomes já estruturados (remove OAB e sujeira de pontuação). */
function limparNomeJson(bruto: string): string {
  let nome = String(bruto || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\([A-Z]{2}\d{3,}[^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Corta tudo a partir de marcadores (representantes, advogados, polo, etc.)
  const corte = nome.search(FIM_NOME_RE);
  if (corte > 0) nome = nome.slice(0, corte);

  return nome
    // OAB/registro colado no fim: "NOME - DF79299"
    .replace(/\s*[-–—]\s*[A-Z]{2}\s*\d{3,}\s*$/i, "")
    .replace(/\s*[-–—]\s*OAB[^,;]*$/i, "")
    // sufixos POLOA / POLOP
    .replace(/\s+POLO\s*[AP]\s*$/i, "")
    .replace(/[|;,\-–—:\s]+$/, "")
    .trim();
}

/** Um nome de parte precisa parecer um nome, não um trecho de texto legal. */
function ehNomeDeParteValido(nome: string): boolean {
  if (!nome || nome.length < 5 || nome.length > 160) return false;
  if (NAO_NOME_RE.test(nome)) return false;
  const palavras = nome.split(/\s+/).filter((p) => /[A-Za-zÀ-ÿ]{2,}/.test(p));
  if (palavras.length < 2) return false;
  // Muitos dígitos indicam identificadores/valores, não nome
  const digitos = (nome.match(/\d/g) || []).length;
  return digitos <= 2;
}

function nomesDoJson(partesJson: any): { ativo: string; passivo: string } {
  let lista: any = partesJson;
  if (typeof lista === "string") {
    try {
      lista = JSON.parse(lista);
    } catch {
      lista = [partesJson];
    }
  }
  if (!Array.isArray(lista)) return { ativo: "", passivo: "" };
  const ativo: string[] = [];
  const passivo: string[] = [];
  for (const p of lista) {
    if (!p) continue;
    let nome = "";
    let polo = "";
    let advogado = false;
    if (typeof p === "string") {
      const parsed = parseParteString(p);
      nome = parsed.nome;
      polo = parsed.polo;
      advogado = parsed.advogado;
    } else {
      nome = String(p.nome ?? p.name ?? p.parte ?? "").trim();
      polo = String(p.polo ?? p.tipo ?? p.tipo_parte ?? p.papel ?? "").trim();
      advogado = !!(p.is_advogado || p.advogado) || /advogad/i.test(String(p.tipo ?? p.papel ?? ""));
    }
    nome = limparNomeJson(nome);
    if (!nome || advogado || !ehNomeDeParteValido(nome)) continue;
    const poloUp = polo.toUpperCase();
    if (poloUp === "P" || poloUp === "POLOP" || /passiv/i.test(polo) || PASSIVO_RE.test(polo)) passivo.push(nome);
    else if (poloUp === "A" || poloUp === "POLOA" || /ativ/i.test(polo) || ATIVO_RE.test(polo)) ativo.push(nome);
    // Terceiros, interessados e polos desconhecidos não entram na linha.
  }
  const uniq = (a: string[]) => Array.from(new Set(a)).join("; ");
  return { ativo: uniq(ativo), passivo: uniq(passivo) };
}



export function PartesResumoLinha({
  poloAtivo,
  poloPassivo,
  partesJson,
  className = "",
}: PartesResumoLinhaProps) {
  const doJson = nomesDoJson(partesJson);
  const ativo = limparPolo(poloAtivo) || doJson.ativo;
  const passivo = limparPolo(poloPassivo) || doJson.passivo;

  if (!ativo && !passivo) return null;

  return (
    <p className={`text-[10px] md:text-xs text-muted-foreground mb-1 break-words ${className}`}>
      {ativo && (
        <span>
          <strong>Ativo:</strong> {ativo}
        </span>
      )}
      {ativo && passivo && <br className="md:hidden" />}
      {ativo && passivo && <span className="hidden md:inline"> | </span>}
      {passivo && (
        <span>
          <strong>Passivo:</strong> {passivo}
        </span>
      )}
    </p>
  );
}

export default PartesResumoLinha;
