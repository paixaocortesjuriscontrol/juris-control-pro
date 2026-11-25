import { expect, test } from "bun:test";
import { rolarListaComMouse } from "../src/lib/rolagemListas";

function eventoRolagem(bloqueadoPeloPainel: boolean) {
  let propagacaoInterrompida = false;
  const event = {
    currentTarget: { scrollTop: 40 },
    deltaY: 120,
    nativeEvent: { defaultPrevented: bloqueadoPeloPainel },
    stopPropagation: () => { propagacaoInterrompida = true; },
  };
  return {
    event: event as any,
    propagacaoInterrompida: () => propagacaoInterrompida,
  };
}

test("rola manualmente uma lista cuja rolagem foi bloqueada pelo painel", () => {
  const { event, propagacaoInterrompida } = eventoRolagem(true);
  rolarListaComMouse(event);
  expect(event.currentTarget.scrollTop).toBe(160);
  expect(propagacaoInterrompida()).toBe(true);
});

test("não duplica a rolagem quando o navegador pode rolar a lista", () => {
  const { event, propagacaoInterrompida } = eventoRolagem(false);
  rolarListaComMouse(event);
  expect(event.currentTarget.scrollTop).toBe(40);
  expect(propagacaoInterrompida()).toBe(true);
});
