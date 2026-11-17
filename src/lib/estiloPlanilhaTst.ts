import JSZip from "jszip";

const MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const ALINHAMENTO = '<alignment horizontal="center" vertical="center" wrapText="1"/>';

/** Fonte Calibri em todas as fontes do arquivo (preserva tamanho, cor e negrito). */
export function aplicarCalibri(stylesXml: string): string {
  return stylesXml.replace(/<font(\s[^>]*)?\/>|<font(\s[^>]*)?>([\s\S]*?)<\/font>/g, (_m, a1, a2, corpo) => {
    const attrs = a1 ?? a2 ?? "";
    let inner = (corpo ?? "").replace(/<name\b[^>]*\/>/g, "").replace(/<family\b[^>]*\/>/g, "").replace(/<scheme\b[^>]*\/>/g, "");
    inner = `${inner}<name val="Calibri"/><family val="2"/>`;
    return `<font${attrs}>${inner}</font>`;
  });
}

/** Centraliza no meio e quebra texto em todos os estilos de célula. */
export function aplicarAlinhamento(stylesXml: string): string {
  return stylesXml.replace(/<cellXfs\b[^>]*>[\s\S]*?<\/cellXfs>/, (bloco) =>
    bloco.replace(/<xf\b([^>]*?)(\/>|>([\s\S]*?)<\/xf>)/g, (_m, attrs: string, _fim, corpo) => {
      const a = attrs.replace(/\sapplyAlignment="[^"]*"/, "") + ' applyAlignment="1"';
      const inner = (corpo ?? "").replace(/<alignment\b[^>]*\/>|<alignment\b[^>]*>[\s\S]*?<\/alignment>/g, "");
      return `<xf${a}>${ALINHAMENTO}${inner}</xf>`;
    }),
  );
}

export function padronizarStylesXml(stylesXml: string): string {
  return aplicarAlinhamento(aplicarCalibri(stylesXml));
}

/** Aplica o padrão da Distribuição TST (Calibri, centralizado no meio, quebra de texto) a um .xlsx pronto. */
export async function padronizarXlsxTst(arquivo: Blob | ArrayBuffer | Uint8Array): Promise<Blob> {
  const original = arquivo instanceof Blob ? arquivo : new Blob([arquivo as BlobPart], { type: MIME });
  try {
    const zip = await JSZip.loadAsync(await original.arrayBuffer());
    const styles = zip.file("xl/styles.xml");
    if (!styles) return original;
    zip.file("xl/styles.xml", padronizarStylesXml(await styles.async("string")));
    return await zip.generateAsync({ type: "blob", mimeType: MIME });
  } catch {
    return original;
  }
}

export async function baixarXlsxTst(arquivo: Blob | ArrayBuffer | Uint8Array, nome: string) {
  const blob = await padronizarXlsxTst(arquivo);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
