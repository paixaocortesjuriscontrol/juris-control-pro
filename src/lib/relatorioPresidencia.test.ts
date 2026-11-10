import { test } from "node:test";
import { strict as assert } from "node:assert";
import { filtrarNaPresidencia } from "./relatorioDistribuicaoDjenAuto";
const l = (processo: string) => ({ processo, dossie: null, equipe: null, data_distribuicao_real: null, centralizador: null, importado_djen_em: null, ja_existia_antes_djen: null });
test("mantém só quem ainda está na Presidência - Admissibilidade", () => {
  const pubs = [
    { processo_numero: "0011745-52.2013.5.03.0053", data_publicacao: "2026-10-27", conteudo: "distribuído para Presidência - Admissibilidade - Gabinete" },
    { processo_numero: "0000001-00.2020.5.01.0001", data_publicacao: "2026-10-01", conteudo: "distribuído para Presidência - Admissibilidade" },
    { processo_numero: "0000001-00.2020.5.01.0001", data_publicacao: "2026-10-20", conteudo: "distribuído para 3ª Turma" },
  ];
  const r = filtrarNaPresidencia([l("0011745-52.2013.5.03.0053"), l("0000001-00.2020.5.01.0001")], pubs);
  assert.deepEqual(r.map((x) => x.processo), ["0011745-52.2013.5.03.0053"]);
});
