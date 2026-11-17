/** Mantém só os campos que diferem do registro gravado ("" e null contam como vazio). */
export function somenteCamposAlterados(payload: Record<string, any>, original: Record<string, any> | null | undefined) {
  if (!original) return payload;
  const norm = (v: any) => (v === "" || v === undefined || v === null ? null : typeof v === "object" && v !== null ? JSON.stringify(v) : String(v));
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (!(k in original)) { out[k] = v; continue; }
    let a = norm(v), b = norm(original[k]);
    // horas "14:00" x "14:00:00"
    if (a && b && /^\d{2}:\d{2}(:\d{2})?$/.test(a) && /^\d{2}:\d{2}(:\d{2})?$/.test(b)) { a = a.slice(0, 5); b = b.slice(0, 5); }
    // datas "2026-11-17" x "2026-11-17T..."
    if (a && b && /^\d{4}-\d{2}-\d{2}/.test(a) && /^\d{4}-\d{2}-\d{2}/.test(b) && (a.length === 10 || b.length === 10)) { a = a.slice(0, 10); b = b.slice(0, 10); }
    if (a !== b) out[k] = v;
  }
  return out;
}
