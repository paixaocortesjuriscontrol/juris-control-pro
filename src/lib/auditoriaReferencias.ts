import { supabase } from "@/integrations/supabase/client";
import { formatValor } from "./auditoriaCampos";

export type CampoAuditoria = { campo?: string; de?: any; para?: any; anterior?: any; novo?: any };

export type ReferenciasAuditoria = {
  usuarios: Record<string, string>;
  processos: Record<string, string>;
  coordenacoes: Record<string, string>;
  clientes: Record<string, string>;
  modelos: Record<string, string>;
  todos: Record<string, string>;
};

export const REFERENCIAS_AUDITORIA_VAZIAS: ReferenciasAuditoria = {
  usuarios: {}, processos: {}, coordenacoes: {}, clientes: {}, modelos: {}, todos: {},
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CAMPOS_USUARIO = new Set([
  "responsavel_id", "advogado_id", "usuario_id", "autor_id", "alterado_por", "criado_por",
  "concluido_por", "responsaveis", "envolvidos", "responsaveis_ids", "envolvidos_ids", "advogados_ids",
]);

type IdsReferencias = {
  usuarios: Set<string>;
  processos: Set<string>;
  coordenacoes: Set<string>;
  clientes: Set<string>;
  modelos: Set<string>;
};

const novoIds = (): IdsReferencias => ({
  usuarios: new Set(), processos: new Set(), coordenacoes: new Set(), clientes: new Set(), modelos: new Set(),
});

function coletarValor(campo: string, valor: any, ids: IdsReferencias) {
  if (Array.isArray(valor)) {
    valor.forEach((v) => coletarValor(campo, v, ids));
    return;
  }
  if (valor && typeof valor === "object") {
    Object.entries(valor).forEach(([k, v]) => coletarValor(k, v, ids));
    return;
  }
  if (typeof valor !== "string" || !UUID.test(valor)) return;
  if (CAMPOS_USUARIO.has(campo)) ids.usuarios.add(valor);
  else if (campo === "processo_id") ids.processos.add(valor);
  else if (campo === "coordenacao_id") ids.coordenacoes.add(valor);
  else if (campo === "cliente_id") ids.clientes.add(valor);
  else if (campo === "modelo_tarefa_id") ids.modelos.add(valor);
}

export function coletarIdsAuditoria(
  campos: CampoAuditoria[],
  extras?: { processoIds?: string[]; usuarioIds?: string[] },
) {
  const ids = novoIds();
  for (const c of campos) {
    coletarValor(c.campo || "", c.de ?? c.anterior, ids);
    coletarValor(c.campo || "", c.para ?? c.novo, ids);
  }
  extras?.processoIds?.forEach((id) => id && ids.processos.add(id));
  extras?.usuarioIds?.forEach((id) => id && ids.usuarios.add(id));
  return ids;
}

async function buscarEmLotes(
  tabela: string,
  selecao: string,
  ids: Set<string>,
  rotulo: (row: any) => string,
): Promise<Record<string, string>> {
  const valores = Array.from(ids);
  const resultado: Record<string, string> = {};
  for (let i = 0; i < valores.length; i += 200) {
    const { data, error } = await (supabase as any)
      .from(tabela)
      .select(selecao)
      .in("id", valores.slice(i, i + 200));
    if (error) throw error;
    (data || []).forEach((row: any) => { resultado[row.id] = rotulo(row); });
  }
  return resultado;
}

/** Resolve os vínculos exibidos na auditoria sem alterar os registros históricos. */
export async function buscarReferenciasAuditoria(
  campos: CampoAuditoria[],
  extras?: { processoIds?: string[]; usuarioIds?: string[] },
): Promise<ReferenciasAuditoria> {
  const ids = coletarIdsAuditoria(campos, extras);
  const [usuarios, processos, coordenacoes, clientes, modelos] = await Promise.all([
    buscarEmLotes("profiles", "id,nome,email", ids.usuarios, (p) => p.nome || p.email || "Usuário sem nome"),
    buscarEmLotes("processos", "id,numero", ids.processos, (p) => p.numero || "Processo sem número"),
    buscarEmLotes("coordenacoes", "id,nome", ids.coordenacoes, (c) => c.nome || "Coordenação sem nome"),
    buscarEmLotes("clientes", "id,nome", ids.clientes, (c) => c.nome || "Cliente sem nome"),
    buscarEmLotes("modelos_titulo_coordenacao", "id,nome,titulo", ids.modelos, (m) => m.nome || m.titulo || "Modelo sem nome"),
  ]);
  const todos = { ...usuarios, ...processos, ...coordenacoes, ...clientes, ...modelos };
  return { usuarios, processos, coordenacoes, clientes, modelos, todos };
}

/** Formata valores da auditoria com nomes legíveis e sem expor IDs ou tokens de anexos. */
export function formatValorAuditoria(campo: string, valor: any, refs: ReferenciasAuditoria): string {
  if (Array.isArray(valor)) {
    if (valor.length === 0) return "—";
    return valor.map((v) => formatValorAuditoria(campo, v, refs)).join(", ");
  }
  if (valor && typeof valor === "object") {
    if (typeof valor.nome === "string") return valor.nome;
    if (typeof valor.numero === "string") return valor.numero;
    const convertido = Object.fromEntries(
      Object.entries(valor).map(([k, v]) => [k, formatValorAuditoria(k, v, refs)]),
    );
    return JSON.stringify(convertido);
  }
  if (typeof valor === "string" && UUID.test(valor)) {
    return refs.todos[valor] || "Registro não identificado";
  }
  return formatValor(valor);
}
