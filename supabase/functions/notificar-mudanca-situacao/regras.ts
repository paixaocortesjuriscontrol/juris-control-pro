export function eventoPermitido(cfg: Record<string, any> | null | undefined, tipo: string, criacao = false): boolean {
  if (cfg === null || cfg?.ativo === false) return false;
  const campo = tipo === "participante_incluido" || criacao ? "evento_tarefa_nova"
    : ["comentario", "mencao", "cobranca"].includes(tipo) ? "evento_comentario"
    : "evento_mudanca_situacao";
  return cfg?.[campo] !== false;
}

export function canalPermitido(cfg: Record<string, any> | null | undefined, canal: "in_app" | "email" | "whatsapp", tipo: string, criacao = false): boolean {
  return eventoPermitido(cfg, tipo, criacao) && cfg?.[`canal_${canal}`] !== false;
}
/** Quem fez a alteração só recebe se tiver ligado "receber alterações feitas por mim" (padrão desligado). */
export function recebeComoAutor(cfg: Record<string, any> | null | undefined, uid: string, atorId: string | null): boolean {
  if (!atorId || uid !== atorId) return true;
  return cfg?.receber_proprias_alteracoes === true;
}
