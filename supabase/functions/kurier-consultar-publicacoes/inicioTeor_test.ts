import { inicioTeorKurier } from "../_kurier-shared/inicioTeor.ts";

function igual(atual: unknown, esperado: unknown) {
  if (atual !== esperado) throw new Error(`Esperado ${esperado}, recebido ${atual}`);
}

Deno.test("Kurier preserva ato de ordem anterior à menção de sentença", () => {
  const texto = "PODER JUDICIÁRIO JUSTIÇA DO TRABALHO ATO DE ORDEM 1. Incluam-se os autos na pauta de audiências de instrução. 2. Serão apreciadas na audiência ou sentença, momento em que serão adotadas as providências cabíveis. 3. Intimem-se as partes.";
  igual(inicioTeorKurier(texto), null);
});

Deno.test("Kurier não usa títulos citados dentro de frases como início", () => {
  igual(inicioTeorKurier("Intime-se a parte para cumprir a SENTENÇA publicada."), null);
  igual(inicioTeorKurier("Intime-se após decisão e sentença, momento oportuno."), null);
});

Deno.test("Kurier reconhece título após cabeçalho compacto de partes", () => {
  const texto = "AGRAVANTE EMPRESA LTDA ADVOGADO JOÃO SILVA - DF12345 D E C I S Ã O Conheço do recurso.";
  const index = inicioTeorKurier(texto);
  igual(index, texto.indexOf("D E C I S Ã O"));
});

Deno.test("Kurier reconhece título no início sem cortar texto seguinte", () => {
  igual(inicioTeorKurier("SENTENÇA Julgo procedente o pedido."), 0);
});