/** Marcadores do Projuris viram etiquetas. Módulo 3 = processo, 4 = tarefa. */
export interface VinculoMarcador {
  marcador: string; // nome
  entidade: "processo" | "tarefa";
  chave: string; // cdregistrovinculo
}

/** Só marcadores ativos; CAPTURA fica de fora porque é controlada pelo Acompanhamento Especial. */
export function montarVinculosMarcadores(
  marcadores: Record<string, string>[],
  vinculos: Record<string, string>[],
): { nomes: string[]; vinculos: VinculoMarcador[]; ignorados: number } {
  const ativos = new Map(
    marcadores
      .filter((m) => m.flativo === "S" && (m.nmmarcador || "").trim().toUpperCase() !== "CAPTURA")
      .map((m) => [m.cdmarcador, (m.nmmarcador || "").trim()]),
  );
  const saida: VinculoMarcador[] = [];
  const vistos = new Set<string>();
  let ignorados = 0;
  for (const v of vinculos) {
    const nome = ativos.get(v.cdmarcador);
    const entidade = v.cdmodulo === "3" ? "processo" : v.cdmodulo === "4" ? "tarefa" : null;
    if (!nome || !entidade || !v.cdregistrovinculo) { ignorados++; continue; }
    const id = `${nome}|${entidade}|${v.cdregistrovinculo}`;
    if (vistos.has(id)) continue;
    vistos.add(id);
    saida.push({ marcador: nome, entidade, chave: v.cdregistrovinculo });
  }
  return { nomes: [...new Set(saida.map((s) => s.marcador))], vinculos: saida, ignorados };
}
