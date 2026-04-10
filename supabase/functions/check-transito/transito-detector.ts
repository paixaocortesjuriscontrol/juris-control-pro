import type {
  AnalisePosTransito,
  ClassificacaoMovimentacao,
  ConsultaProcesso,
  DeteccaoTransito,
  Movimentacao,
  ResultadoTribunal,
  StatusTransito,
} from "./types.ts";

const CODIGO_848 = 848;
const CODIGOS_SECUNDARIOS = new Set([22, 246]);
const RX_TRANSITO = /transit(?:ou|o|ado)\s+em\s+julgado/i;
const RX_NEGACAO_DIRETA =
  /\b(n[aã]o|sem|negativ[ao]|pend[eê]nt|aguardando|ausência|ausencia)\b/i;

function temNegacaoProxima(texto: string): boolean {
  const match = RX_NEGACAO_DIRETA.exec(texto);
  if (!match) return false;
  const inicio = Math.max(0, match.index - 30);
  const fim = Math.min(texto.length, match.index + 90);
  const janela = texto.slice(inicio, fim);
  return RX_TRANSITO.test(janela);
}

function textoMovimentacao(m: Movimentacao): string {
  return `${m.nome} ${m.complemento ?? ""}`.toLowerCase();
}

export function detectarTransito(
  movimentacoes: Movimentacao[],
): DeteccaoTransito {
  let candidato848: DeteccaoTransito | null = null;
  let candidatoSecundario: DeteccaoTransito | null = null;
  let candidatoTexto: DeteccaoTransito | null = null;

  for (const m of movimentacoes) {
    const texto = textoMovimentacao(m);

    if (m.codigo === CODIGO_848 && !candidato848) {
      candidato848 = {
        detectado: true,
        confianca: 95,
        dataTransito: new Date(m.dataHora),
        metodo: "codigo_848",
        movimentacaoOrigem: m,
      };
    }

    if (
      !candidatoSecundario &&
      CODIGOS_SECUNDARIOS.has(m.codigo) &&
      RX_TRANSITO.test(texto) &&
      !temNegacaoProxima(texto)
    ) {
      candidatoSecundario = {
        detectado: true,
        confianca: 75,
        dataTransito: new Date(m.dataHora),
        metodo: "codigo_22_246",
        movimentacaoOrigem: m,
      };
    }

    if (
      !candidatoTexto &&
      RX_TRANSITO.test(texto) &&
      !temNegacaoProxima(texto) &&
      !CODIGOS_SECUNDARIOS.has(m.codigo) &&
      m.codigo !== CODIGO_848
    ) {
      candidatoTexto = {
        detectado: true,
        confianca: 50,
        dataTransito: new Date(m.dataHora),
        metodo: "texto",
        movimentacaoOrigem: m,
      };
    }
  }

  return (
    candidato848 ??
    candidatoSecundario ??
    candidatoTexto ?? { detectado: false, confianca: 0 }
  );
}

// ─── Classificação de movimentações pós-trânsito ──────────────────────────────

const CODIGOS_ADMIN = new Set([
  3, 4, 11, 12, 14, 22, 26, 36, 50, 51, 60, 61, 67, 85, 123, 132,
  192, 193, 194, 246, 268, 581, 848, 852, 981, 1037,
  10001, 10003, 10004, 10005, 10006, 10044, 10045, 11009, 11010,
]);

const PALAVRAS_ADMIN = [
  "remessa", "baixa", "arquiv", "certidão", "certidao",
  "distribuição", "distribuicao", "juntada", "conclusão", "conclusao",
  "publicação", "publicacao", "expedição", "expedicao",
  "intimação", "intimacao", "notificação", "notificacao",
  "despacho", "ato ordinat", "vista", "recebimento",
  "autuação", "autuacao", "autos eletrôn", "autos eletron",
  "desentranhamento", "petição", "peticao", "mandado",
  "levantamento", "numeração", "numeracao", "redistribu",
  "anotação", "anotacao", "cancelamento", "retificação", "retificacao",
  "complementação", "complementacao", "cumprimento",
  "encaminhamento", "devolução", "devoluçao", "devolucao",
  "protocolo", "trânsito em julgado", "transito em julgado",
  "citação", "citacao", "encerramento", "reabertura",
  "sigilo", "desarchiv",
];

const PALAVRAS_EXECUCAO = [
  "penhora", "arresto", "avaliação de bens", "avaliacao de bens",
  "leilão", "leilao", "hasta pública", "hasta publica",
  "adjudicação", "adjudicacao", "precatório", "precatorio",
  "requisição de pequeno valor", "rpv",
  "cálculo de liquidação", "calculo de liquidacao",
  "cumprimento de sentença", "cumprimento de sentenca",
  "ofício requisitório", "oficio requisitorio",
  "liquidação de sentença", "liquidacao de sentenca",
];

const PALAVRAS_RECURSO_NOVO = [
  "recurso extraordinário", "recurso especial",
  "embargos de divergência", "embargos de divergencia",
  "embargos de declaração", "embargos de declaracao",
  "agravo regimental", "agravo interno", "agravo em recurso",
  "reclamação constitucional", "reclamacao constitucional",
  "mandado de segurança", "mandado de seguranca",
  "habeas corpus",
  "tutela provisória", "tutela provisoria",
  "liminar",
  "suspensão de segurança", "suspensao de seguranca",
];

const CODIGOS_RECURSO_NOVO = new Set([219, 220, 221]);

function contemQualquer(texto: string, lista: string[]): boolean {
  return lista.some((p) => texto.includes(p.toLowerCase()));
}

function classificarMovimentacao(
  m: Movimentacao,
): ClassificacaoMovimentacao["categoria"] {
  if (
    CODIGOS_RECURSO_NOVO.has(m.codigo) ||
    contemQualquer(textoMovimentacao(m), PALAVRAS_RECURSO_NOVO)
  ) {
    return "recurso_novo";
  }

  if (contemQualquer(textoMovimentacao(m), PALAVRAS_EXECUCAO)) {
    return "execucao";
  }

  if (
    CODIGOS_ADMIN.has(m.codigo) ||
    contemQualquer(textoMovimentacao(m), PALAVRAS_ADMIN)
  ) {
    return "admin";
  }

  return "desconhecida";
}

export function analisarPosTransito(
  movimentacoes: Movimentacao[],
  dataTransito: Date,
): AnalisePosTransito {
  const posteriores = movimentacoes.filter(
    (m) => new Date(m.dataHora) > dataTransito,
  );

  const classificadas: ClassificacaoMovimentacao[] = posteriores.map((m) => ({
    movimentacao: m,
    categoria: classificarMovimentacao(m),
  }));

  const temRecursoPosterior = classificadas.some(
    (c) => c.categoria === "recurso_novo",
  );

  // Log desconhecidas for debugging (temporary)
  const desconhecidas = classificadas.filter(c => c.categoria === "desconhecida");
  if (desconhecidas.length > 0) {
    console.log(`[check-transito] ${desconhecidas.length} movimentações desconhecidas pós-trânsito:`,
      desconhecidas.map(d => ({ codigo: d.movimentacao.codigo, nome: d.movimentacao.nome }))
    );
  }

  const temExecucaoAtiva = classificadas.some(
    (c) => c.categoria === "execucao",
  );

  // Log recursos for debugging
  const recursos = classificadas.filter(c => c.categoria === "recurso_novo");
  if (recursos.length > 0) {
    console.log(`[check-transito] ${recursos.length} recurso_novo pós-trânsito:`,
      recursos.map(d => ({ codigo: d.movimentacao.codigo, nome: d.movimentacao.nome, data: d.movimentacao.dataHora }))
    );
  }

  return {
    temRecursoPosterior,
    temExecucaoAtiva,
    movimentacoesClassificadas: classificadas,
  };
}

export function analisarConsulta(consulta: ConsultaProcesso): ResultadoTribunal {
  console.log(`[check-transito] ${consulta.tribunal}: ${consulta.movimentacoes.length} movimentações`);
  const deteccao = detectarTransito(consulta.movimentacoes);
  console.log(`[check-transito] ${consulta.tribunal}: detectado=${deteccao.detectado}, confiança=${deteccao.confianca}, método=${deteccao.metodo}`);

  if (!deteccao.detectado || !deteccao.dataTransito) {
    return {
      tribunal: consulta.tribunal,
      status: "inconclusivo",
      confianca: 30,
    };
  }

  const analisePos = analisarPosTransito(
    consulta.movimentacoes,
    deteccao.dataTransito,
  );

  let status: StatusTransito;
  let confianca = deteccao.confianca;

  if (analisePos.temRecursoPosterior) {
    status = "ativo";
    confianca = Math.min(confianca + 10, 95);
  } else if (analisePos.temExecucaoAtiva) {
    status = "transitado_execucao";
  } else {
    status = "transitado";
  }

  return {
    tribunal: consulta.tribunal,
    status,
    confianca,
    dataTransito: deteccao.dataTransito,
    analisePos,
  };
}
