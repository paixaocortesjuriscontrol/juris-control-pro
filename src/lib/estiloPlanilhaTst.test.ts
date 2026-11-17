import { test } from "node:test";
import { strict as assert } from "node:assert";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { padronizarXlsxTst } from "./estiloPlanilhaTst";

test("usa Calibri, centraliza no meio e quebra texto em todos os estilos", async () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Processo", "Dossiê"], ["1", "2"]]), "A");
    const blob = await padronizarXlsxTst(XLSX.write(wb, { type: "array", bookType: "xlsx" }));
    const styles = await (await JSZip.loadAsync(await blob.arrayBuffer())).file("xl/styles.xml")!.async("string");
    const nomes = [...styles.matchAll(/<name val="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(nomes.length > 0);
    assert.ok(nomes.every((n) => n === "Calibri"));
    const xfs = styles.match(/<cellXfs[\s\S]*?<\/cellXfs>/)![0].match(/<xf\b[\s\S]*?<\/xf>/g)!;
    assert.ok(xfs.length > 0);
    for (const xf of xfs) assert.ok(xf.includes('<alignment horizontal="center" vertical="center" wrapText="1"/>'));
});
