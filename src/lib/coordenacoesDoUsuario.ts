export interface CoordenacaoUsuario {
  id: string;
  nome: string;
  area?: string | null;
}

export interface CoordenacoesUsuarioResultado {
  isAdmin: boolean;
  podeDelegar: boolean;
  coordenacoes: CoordenacaoUsuario[];
  idsProprias: string[];
}

type ClienteConsulta = {
  from: (tabela: string) => any;
};

function falharSeErro(error: any) {
  if (error) throw error;
}

/**
 * Única consulta de coordenações dos formulários.
 * Erros são propagados: uma falha temporária não pode ser confundida com
 * "usuário sem coordenação" e ficar guardada como uma lista vazia válida.
 */
export async function carregarCoordenacoesDoUsuario(
  supabase: ClienteConsulta,
  userId: string,
  incluirTodasParaCoordenador = false,
): Promise<CoordenacoesUsuarioResultado> {
  const { data: roles, error: erroRoles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  falharSeErro(erroRoles);

  const listaRoles = (roles || []).map((r: any) => String(r.role || ""));
  const isAdmin = listaRoles.some((r) => r === "admin" || r === "assistente_juridico_geral");
  const coordenadorGlobal = listaRoles.some((r) => /coordenador/i.test(r));

  if (isAdmin) {
    const { data: all, error } = await supabase
      .from("coordenacoes")
      .select("id, nome, area")
      .order("nome");
    falharSeErro(error);
    return {
      isAdmin: true,
      podeDelegar: true,
      coordenacoes: (all || []) as CoordenacaoUsuario[],
      idsProprias: [],
    };
  }

  const [{ data: membros, error: erroMembros }, { data: coordenador, error: erroCoordenador }] = await Promise.all([
    supabase.from("membros_coordenacao").select("coordenacao_id").eq("usuario_id", userId),
    supabase.from("coordenacoes").select("id").eq("coordenador_id", userId),
  ]);
  falharSeErro(erroMembros);
  falharSeErro(erroCoordenador);

  const idsProprias = Array.from(new Set([
    ...(membros || []).map((m: any) => m.coordenacao_id).filter(Boolean),
    ...(coordenador || []).map((c: any) => c.id).filter(Boolean),
  ])) as string[];

  let podeDelegar = coordenadorGlobal;
  if (!podeDelegar) {
    const { data: cargos, error: erroCargos } = await supabase
      .from("membros_coordenacao")
      .select("cargo")
      .eq("usuario_id", userId);
    falharSeErro(erroCargos);
    podeDelegar = (cargos || []).some((c: any) => /coordenador/i.test(String(c.cargo || "")));
  }

  if (incluirTodasParaCoordenador && coordenadorGlobal) {
    const { data: all, error } = await supabase
      .from("coordenacoes")
      .select("id, nome, area")
      .order("nome");
    falharSeErro(error);
    return {
      isAdmin: false,
      podeDelegar,
      coordenacoes: (all || []) as CoordenacaoUsuario[],
      idsProprias,
    };
  }

  if (idsProprias.length === 0) {
    return { isAdmin: false, podeDelegar, coordenacoes: [], idsProprias: [] };
  }

  const { data: coords, error: erroCoords } = await supabase
    .from("coordenacoes")
    .select("id, nome, area")
    .in("id", idsProprias)
    .order("nome");
  falharSeErro(erroCoords);

  return {
    isAdmin: false,
    podeDelegar,
    coordenacoes: (coords || []) as CoordenacaoUsuario[],
    idsProprias,
  };
}
