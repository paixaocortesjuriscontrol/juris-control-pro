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

function nomesDoJson(partesJson: any): { ativo: string; passivo: string } {
  if (!Array.isArray(partesJson)) return { ativo: "", passivo: "" };
  const ativo: string[] = [];
  const passivo: string[] = [];
  for (const p of partesJson) {
    if (!p) continue;
    const nome = String(p.nome ?? p.name ?? p.parte ?? "").trim();
    if (!nome) continue;
    const polo = String(p.polo ?? p.tipo ?? p.tipo_parte ?? p.papel ?? "").trim();
    if (PASSIVO_RE.test(polo)) passivo.push(nome);
    else if (ATIVO_RE.test(polo)) ativo.push(nome);
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
