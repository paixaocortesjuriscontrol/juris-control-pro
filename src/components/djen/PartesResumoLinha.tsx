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

/** Impede que o inteiro teor, ocasionalmente gravado junto ao polo, apareça na linha de partes. */
function limparPolo(bruto: string | null | undefined): string {
  const valor = String(bruto || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (!valor) return "";

  const inicioTexto = valor.search(INICIO_TEXTO_RE);
  const limpo = inicioTexto > 0 ? valor.slice(0, inicioTexto).trim() : valor;

  // Um nome de parte não deve ocupar um parágrafo. Nesses casos, partes_json
  // é uma fonte mais segura; sem ela, é preferível ocultar a linha contaminada.
  if (limpo.length > 220 || /\b(?:art\.|processo\s+caso|nos\s+termos|decidiu|condena[çc][ãa]o)\b/i.test(limpo)) {
    return "";
  }
  return limpo.replace(/[|;,\-–—:\s]+$/, "").trim();
}

/**
 * Alguns motores gravam as partes como texto, no formato
 * "[Parte] NOME DA PARTE POLOA" (ou POLOP). Extrai nome + polo desse formato.
 */
function parseParteString(bruto: string): { nome: string; polo: string } {
  let txt = bruto.trim();
  txt = txt.replace(/^\[[^\]]*\]\s*/, ""); // remove prefixo "[Parte]" / "[Advogado]"
  let polo = "";
  const m = txt.match(/\s*POLO\s*([AP])\s*$/i);
  if (m) {
    polo = m[1].toUpperCase();
    txt = txt.slice(0, m.index).trim();
  }
  return { nome: txt.trim(), polo };
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
    if (typeof p === "string") {
      const parsed = parseParteString(p);
      nome = parsed.nome;
      polo = parsed.polo;
    } else {
      nome = String(p.nome ?? p.name ?? p.parte ?? "").trim();
      polo = String(p.polo ?? p.tipo ?? p.tipo_parte ?? p.papel ?? "").trim();
    }
    nome = limparPolo(nome);
    if (!nome) continue;
    const poloUp = polo.toUpperCase();
    if (poloUp === "P" || poloUp === "POLOP" || PASSIVO_RE.test(polo)) passivo.push(nome);
    else if (poloUp === "A" || poloUp === "POLOA" || ATIVO_RE.test(polo)) ativo.push(nome);
    else ativo.push(nome);
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
