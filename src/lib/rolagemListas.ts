import type { WheelEvent } from "react";

/**
 * Garante a rolagem de listas abertas em portal dentro de Dialog/Sheet.
 * O bloqueio de rolagem do painel já impediu o evento nativo; fora dele,
 * deixamos o navegador fazer a rolagem para não movimentar a lista duas vezes.
 */
export function rolarListaComMouse(event: WheelEvent<HTMLElement>) {
  event.stopPropagation();
  if (event.nativeEvent.defaultPrevented) {
    event.currentTarget.scrollTop += event.deltaY;
  }
}
