export type JuditAttachmentLike = {
  step_id?: string | number | null;
  attachment_id?: string | number | null;
  attachment_name?: string | null;
  name?: string | null;
  title?: string | null;
  attachment_date?: string | null;
  date?: string | null;
  extension?: string | null;
  ext?: string | null;
  texto_indexado?: boolean | null;
  documento_id?: string | null;
  storage_path?: string | null;
  [key: string]: any;
};

const normalizeAttachmentName = (value: unknown) =>
  String(value ?? "")
    .trim()
    .replace(/\s*\(C[ÓO]PIA\)\s*/gi, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/gi, "")
    .toUpperCase();

export const getJuditAttachmentDedupKey = (att: JuditAttachmentLike) => {
  // Preferimos step_id quando existir: é o identificador real do documento na
  // Judit. Se a API retornar o mesmo step_id para várias entradas (cópias em
  // instâncias diferentes), elas representam o mesmo arquivo e devem colapsar.
  const stepId = String(att.step_id ?? "").trim();
  if (stepId) return `sid::${stepId}`;
  const name = normalizeAttachmentName(att.attachment_name ?? att.name ?? att.title);
  const date = String(att.attachment_date ?? att.date ?? "").trim();
  const extension = String(att.extension ?? att.ext ?? "").trim().toLowerCase();
  return [name, date, extension].join("::");
};

const attachmentScore = (att: JuditAttachmentLike) =>
  (att.storage_path ? 8 : 0) +
  (att.documento_id ? 4 : 0) +
  (att.texto_indexado ? 2 : 0) +
  (att.step_id || att.attachment_id ? 1 : 0);

export function dedupeJuditAttachments<T extends JuditAttachmentLike>(attachments: T[]): T[] {
  const byKey = new Map<string, T>();
  for (const att of attachments) {
    const key = getJuditAttachmentDedupKey(att);
    if (!key.replace(/:/g, "")) continue;
    const current = byKey.get(key);
    if (!current || attachmentScore(att) > attachmentScore(current)) {
      byKey.set(key, att);
    }
  }
  return Array.from(byKey.values());
}
