import { resolverPartesEmail, escaparHtml } from "./partesEmail.ts";

function igual(atual: unknown, esperado: unknown) {
  if (atual !== esperado) throw new Error(`Esperado ${esperado}, recebido ${atual}`);
}

Deno.test("preserva os nomes cadastrados de ambos os polos", () => {
  const partes = resolverPartesEmail({ polo_ativo: "Maria Silva", polo_passivo: "GOL Linhas Aéreas S.A." }, []);
  igual(partes.ativo, "Maria Silva");
  igual(partes.passivo, "GOL Linhas Aéreas S.A.");
  igual(partes.resumo, "Maria Silva x GOL Linhas Aéreas S.A.");
});

Deno.test("usa campos alternativos e completa somente o polo vazio, sem advogados ou terceiros", () => {
  const partes = resolverPartesEmail({ reclamante: "Maria Silva" }, [
    { nome: "Outra autora", lado_efetivo: "ACTIVE", is_advogado: false },
    { nome: "GOL Linhas Aéreas S.A.", lado_efetivo: "PASSIVE", is_advogado: false },
    { nome: "GOL Linhas Aéreas S.A.", lado_efetivo: "PASSIVE", is_advogado: false },
    { nome: "Advogado Silva", lado_efetivo: "PASSIVE", is_advogado: true },
    { nome: "Terceiro Silva", lado_efetivo: null, is_advogado: false },
  ]);
  igual(partes.ativo, "Maria Silva");
  igual(partes.passivo, "GOL Linhas Aéreas S.A.");
});

Deno.test("nomes ausentes não são inventados e caracteres especiais são escapados", () => {
  igual(resolverPartesEmail({}, []).resumo, "");
  igual(escaparHtml("Silva & Filhos <Ltda>"), "Silva &amp; Filhos &lt;Ltda&gt;");
  igual(resolverPartesEmail({ reclamante: "Maria\r\nSilva", reclamados: ["Empresa A", "Empresa B"] }, []).resumo,
    "Maria Silva x Empresa A; Empresa B");
});