import { test } from "node:test";
import { strict as assert } from "node:assert";
import { criarEnriquecedorProjuris } from "./projurisProcessosRelacionados";

test("resolve justiça, órgão, tribunal, cidade, UF e vara pelos códigos", () => {
  const enrich = criarEnriquecedorProjuris({
    processojustica: [{ cdprocessojustica: "8", nmprocessojustica: "Justiça Estadual" }],
    processoorgao: [{ cdprocessoorgao: "10", nmorgao: "1ª Vara", cdprocessoorgaopai: "20", cdcidade: "3" }, { cdprocessoorgao: "20", nmorgao: "Tribunal de Justiça", abvorgao: "TJSP" }],
    cidade: [{ cdcidade: "3", nmcidade: "São Paulo", cdestado: "4" }], estado: [{ cdestado: "4", nmsigla: "SP" }],
    processovaranumero: [{ cdprocessovaranumero: "1", nmprocessovaranumero: "1ª" }], processovaratipo: [{ cdprocessovaratipo: "2", nmprocessovaratipo: "Vara Cível" }],
  });
  assert.deepEqual(enrich({ cdprocessojustica: "8", cdprocessoorgaojudicial: "10", cdprocessovaranumero: "1", cdprocessovaratipo: "2" }), { justica: "Justiça Estadual", orgao_julgador: "1ª Vara", tribunal: "TJSP", comarca: "São Paulo", uf: "SP", vara: "1ª Vara Cível" });
});
test("sem tabela de tipos, não inventa o polo das partes e preserva nomes nas observações", () => {
  const out = criarEnriquecedorProjuris({ pessoa: [{ cdpessoa: "1", nmpessoa: "Parte A" }], processoparticipacaotipo: [{ cdprocesso: "7", cdpessoa: "1", cdparticipacaotipo: "42", flativo: "S" }] })({ cdprocesso: "7" });
  assert.equal(out.polo_ativo, undefined); assert.equal(out.polo_passivo, undefined);
  assert.match(String(out.observacoes_processo), /tipo Projuris 42.*Parte A/);
});
test("resolve partes por papel conhecido e mantém responsáveis de origem como texto", () => {
  const out = criarEnriquecedorProjuris({ pessoa: [{ cdpessoa: "1", nmpessoa: "Parte A" }, { cdpessoa: "2", nmpessoa: "Responsável B" }], participacaotipo: [{ cdparticipacaotipo: "42", nmparticipacaotipo: "Autor" }], processoparticipacaotipo: [{ cdprocesso: "7", cdpessoa: "1", cdparticipacaotipo: "42" }], usuario: [{ cdusuario: "9", cdpessoa: "2" }], reprocessousuario: [{ cdprocesso: "7", cdusuario: "9" }] })({ cdprocesso: "7" });
  assert.equal(out.polo_ativo, "Parte A"); assert.equal(out.responsaveis_projuris, "Responsável B");
});
test("não transforma placeholder booleano de lista dinâmica em valor selecionado", () => {
  const out = criarEnriquecedorProjuris({ campodinamico: [{ cdcampodinamico: "1", nmcampo: "Sistema Judicial" }], campodinamicodado: [{ cdregistrovinculo: "7", cdmodulo: "3", cdcampodinamico: "1", flcampotipo: "LISTA_SELECAO_UNICA", devalorboolean: "N" }] })({ cdprocesso: "7" });
  assert.equal(out.sistema, undefined);
});