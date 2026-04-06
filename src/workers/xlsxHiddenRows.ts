/**
 * Utility to extract hidden row indices from xlsx files by parsing the raw XML.
 * SheetJS community edition does NOT populate ws["!rows"] with hidden metadata,
 * so we must read it directly from the zip.
 */
import JSZip from "jszip";

interface SheetHiddenRows {
  [sheetName: string]: Set<number>;
}

/**
 * Given the raw ArrayBuffer of an xlsx file and the ordered sheet names (from SheetJS),
 * returns a map of sheetName -> Set of 0-based hidden row indices.
 */
export async function extractHiddenRows(
  data: ArrayBuffer,
  sheetNames: string[]
): Promise<SheetHiddenRows> {
  const result: SheetHiddenRows = {};
  for (const name of sheetNames) result[name] = new Set();

  try {
    const zip = await JSZip.loadAsync(data);

    // Read workbook.xml and its rels to map sheet names -> xml files
    const wbXmlFile = zip.file("xl/workbook.xml");
    const relsFile = zip.file("xl/_rels/workbook.xml.rels");
    if (!wbXmlFile || !relsFile) return result;

    const [wbXml, relsXml] = await Promise.all([
      wbXmlFile.async("string"),
      relsFile.async("string"),
    ]);

    // Extract sheet name -> rId mapping
    const sheetRegex = /<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g;
    const nameToRid: Record<string, string> = {};
    let m: RegExpExecArray | null;
    while ((m = sheetRegex.exec(wbXml)) !== null) {
      nameToRid[m[1]] = m[2];
    }

    // Extract rId -> target file mapping
    const relRegex = /<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g;
    const ridToFile: Record<string, string> = {};
    while ((m = relRegex.exec(relsXml)) !== null) {
      ridToFile[m[1]] = m[2];
    }

    // For each sheet, parse hidden rows from the XML
    const promises = sheetNames.map(async (name) => {
      const rId = nameToRid[name];
      if (!rId) return;
      const target = ridToFile[rId];
      if (!target) return;

      const filePath = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
      const sheetFile = zip.file(filePath);
      if (!sheetFile) return;

      const xml = await sheetFile.async("string");
      // Match <row ... hidden="1" ...> and extract the r="N" attribute (1-based row number)
      const rowRegex = /<row\b[^>]*?\bhidden="1"[^>]*?\br="(\d+)"[^>]*?\/?>/g;
      const rowRegex2 = /<row\b[^>]*?\br="(\d+)"[^>]*?\bhidden="1"[^>]*?\/?>/g;

      const hiddenSet = result[name];
      let rm: RegExpExecArray | null;
      while ((rm = rowRegex.exec(xml)) !== null) {
        hiddenSet.add(parseInt(rm[1]) - 1); // convert to 0-based
      }
      while ((rm = rowRegex2.exec(xml)) !== null) {
        hiddenSet.add(parseInt(rm[1]) - 1);
      }
    });

    await Promise.all(promises);
  } catch {
    // If XML parsing fails, return empty sets (no rows filtered)
  }

  return result;
}
