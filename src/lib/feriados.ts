import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Domingo de Páscoa (algoritmo de Meeus/Butcher). */
export function pascoa(ano: number): Date {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia, 12);
}

/** Feriados nacionais (fixos + Carnaval, Sexta-feira Santa e Corpus Christi). */
export function feriadosNacionais(ano: number): { data: string; nome: string }[] {
  const p = pascoa(ano);
  const rel = (n: number) => { const d = new Date(p); d.setDate(d.getDate() + n); return iso(d); };
  const f = (m: number, d: number) => iso(new Date(ano, m - 1, d, 12));
  return [
    { data: f(1, 1), nome: "Confraternização Universal" },
    { data: rel(-48), nome: "Carnaval (segunda)" },
    { data: rel(-47), nome: "Carnaval (terça)" },
    { data: rel(-2), nome: "Sexta-feira Santa" },
    { data: f(4, 21), nome: "Tiradentes" },
    { data: f(5, 1), nome: "Dia do Trabalho" },
    { data: rel(60), nome: "Corpus Christi" },
    { data: f(9, 7), nome: "Independência do Brasil" },
    { data: f(10, 12), nome: "Nossa Senhora Aparecida" },
    { data: f(11, 2), nome: "Finados" },
    { data: f(11, 15), nome: "Proclamação da República" },
    { data: f(11, 20), nome: "Dia da Consciência Negra" },
    { data: f(12, 25), nome: "Natal" },
  ];
}

type Cfg = { nacionais: boolean; proprios: Set<string> };
const cache = new Map<string, Cfg>();

/** Carrega (e guarda) a configuração de feriados da coordenação. */
export async function precarregarFeriados(coordenacaoId?: string | null, forcar = false): Promise<void> {
  if (!coordenacaoId || (!forcar && cache.has(coordenacaoId))) return;
  const [{ data: c }, { data: lista }] = await Promise.all([
    sb.from("coordenacoes").select("usar_feriados_nacionais").eq("id", coordenacaoId).maybeSingle(),
    sb.from("feriados_coordenacao").select("data").eq("coordenacao_id", coordenacaoId),
  ]);
  cache.set(coordenacaoId, {
    nacionais: !!c?.usar_feriados_nacionais,
    proprios: new Set((lista || []).map((r: any) => String(r.data).slice(0, 10))),
  });
}

export function definirFeriadosCache(coordenacaoId: string, nacionais: boolean, proprios: string[]) {
  cache.set(coordenacaoId, { nacionais, proprios: new Set(proprios) });
}

/** Feriado da coordenação? Só considera quando a coordenação ligou a opção ou cadastrou datas próprias. */
export function ehFeriado(d: Date, coordenacaoId?: string | null, cfg?: Cfg): boolean {
  const c = cfg ?? (coordenacaoId ? cache.get(coordenacaoId) : undefined);
  if (!c) return false;
  const k = iso(d);
  if (c.proprios.has(k)) return true;
  return c.nacionais && feriadosNacionais(d.getFullYear()).some((f) => f.data === k);
}

/** Soma N dias úteis pulando sábado, domingo e feriados da coordenação. */
export function somarDiasUteis(base: Date, n: number, coordenacaoId?: string | null, extraNaoUtil?: (d: Date) => boolean): Date {
  const d = new Date(base);
  let restantes = n;
  while (restantes > 0) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue;
    if (ehFeriado(d, coordenacaoId)) continue;
    if (extraNaoUtil?.(d)) continue;
    restantes--;
  }
  return d;
}
