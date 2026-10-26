// Regras de destinatários dos alertas de vencimento por coordenação.
// Recebem: pessoas ligadas ao item (responsáveis, envolvidos, criador) e,
// da lista da configuração, apenas coordenadores. Cada canal respeita a
// preferência individual (config_notificacoes_usuario).

export function ehCoordenador(cargo: string | null | undefined): boolean {
  const c = String(cargo ?? "").toLowerCase();
  return c === "coordenador" || c === "coordenador_geral" || c === "admin";
}

export function idsDestinatarios(
  idsDoItem: Iterable<string>,
  idsConfig: string[] | null | undefined,
  cargoPorUsuario: Map<string, string | null>,
): Set<string> {
  const out = new Set<string>(idsDoItem);
  for (const id of idsConfig ?? []) if (ehCoordenador(cargoPorUsuario.get(id))) out.add(id);
  return out;
}

/** cfg undefined = sem preferência salva (padrão ligado); null = coordenação desativada. */
export function canalAlertaPermitido(
  cfg: Record<string, any> | null | undefined,
  canal: "email" | "whatsapp",
): boolean {
  if (cfg === null || cfg?.ativo === false) return false;
  return cfg?.[`canal_${canal}`] !== false;
}
