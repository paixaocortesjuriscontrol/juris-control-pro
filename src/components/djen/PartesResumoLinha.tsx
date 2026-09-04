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
  const ativo = (poloAtivo || "").trim() || doJson.ativo;
  const passivo = (poloPassivo || "").trim() || doJson.passivo;

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
