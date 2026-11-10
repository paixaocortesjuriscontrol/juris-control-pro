import { test } from "node:test";
import { strict as assert } from "node:assert";
import { filtrarNaPresidencia } from "./relatorioDistribuicaoDjenAuto";
const l = (processo: string) => ({ processo, dossie: null, equipe: null, data_distribuicao_real: "2026-10-01", centralizador: null, importado_djen_em: null, ja_existia_antes_djen: null });
test("usa a data do despacho e só despachos para Presidência - Admissibilidade", () => {
  const pubs = [
    { processo_numero: "0000919-18.2025.5.05.0561", data_publicacao: "2026-10-01", conteudo: "Processo 0000919-18.2025.5.05.0561 distribuído para Presidência - Admissibilidade - Gabinete da Presidência na data 28/09/2026" },
    { processo_numero: "0000002-00.2020.5.01.0001", data_publicacao: "2026-10-05", conteudo: "Processo distribuído para Presidência - Admissibilidade - Gabinete da Presidência na data 03/10/2026" },
    { processo_numero: "0000001-00.2020.5.01.0001", data_publicacao: "2026-10-20", conteudo: "distribuído para 3ª Turma na data 19/10/2026" },
  ];
  const linhas = [l("0000919-18.2025.5.05.0561"), l("0000002-00.2020.5.01.0001"), l("0000001-00.2020.5.01.0001")];
  const r = filtrarNaPresidencia(linhas, pubs, "2026-10-01", "2026-10-31");
  assert.deepEqual(r.map((x) => [x.processo, x.data_distribuicao_real]), [["0000002-00.2020.5.01.0001", "2026-10-03"]]);
  const set = filtrarNaPresidencia(linhas, pubs, "2026-09-01", "2026-09-30");
  assert.deepEqual(set.map((x) => x.data_distribuicao_real), ["2026-09-28"]);
});
