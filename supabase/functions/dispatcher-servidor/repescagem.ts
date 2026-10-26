// Cálculo do dia alvo da repescagem: último dia anterior a hoje com busca normal,
// desde que ainda não tenha sido repescado.
export function ymdBrt(d: Date): string {
  return new Date(d.getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10);
}

type Exec = { agendado_para: string; payload?: Record<string, any> | null };

export function diaAlvoRepescagem(hojeYmd: string, execs: Exec[]): string | null {
  const repescados = new Set(
    execs.filter((e) => e.payload?.repescagem === true && e.payload?.dataInicio).map((e) => String(e.payload!.dataInicio)),
  );
  const normais = execs
    .filter((e) => e.payload?.repescagem !== true && !e.payload?.dataInicio)
    .map((e) => ymdBrt(new Date(e.agendado_para)))
    .filter((d) => d < hojeYmd)
    .sort()
    .reverse();
  const alvo = normais[0];
  if (!alvo || repescados.has(alvo)) return null;
  return alvo;
}
