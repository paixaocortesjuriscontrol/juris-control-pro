import { complementosProjuris, type Complementos } from "./projurisComplementos";

type Row = Record<string, unknown>;
type Tabelas = Record<string, Row[]>;
const str = (x: unknown) => String(x ?? "").trim();
const norm = (x: unknown) => str(x).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const ativo = (r: Row) => str(r.flativo) !== "N" && !str(r.flexclusaotipo);

export const TABELAS_PROCESSOS_RELACIONADOS: Record<string, string[]> = {
  cidade: ["cdcidade", "nmcidade", "cdestado"], estado: ["cdestado", "nmsigla", "nmestado"],
  processojustica: ["cdprocessojustica", "nmprocessojustica"],
  processoorgao: ["cdprocessoorgao", "nmorgao", "abvorgao", "cdcidade", "cdprocessoorgaopai", "florgaotipo"],
  processofase: ["cdprocessofase", "nmfase", "flativo"], processoarea: ["cdprocessoarea", "nmarea", "flativo"],
  processosituacao: ["cdprocessosituacao", "desituacao", "flativo"],
  processovaranumero: ["cdprocessovaranumero", "nmprocessovaranumero", "flativo"],
  processovaratipo: ["cdprocessovaratipo", "nmprocessovaratipo", "flativo"],
  classecnj: ["cod_classe", "natureza"],
  unidadeorganizacional: ["cdunidadeorganizacional", "nmunidadeorganizacional", "nmsigla"],
  processoparticipacaotipo: ["cdprocesso", "cdpessoa", "cdparticipacaotipo", "flcliente", "flprincipal", "flativo", "flexclusaotipo"],
  participacaotipo: ["cdparticipacaotipo", "nmparticipacaotipo", "departicipacaotipo", "flpolo", "flativo"],
  campodinamico: ["cdcampodinamico", "nmcampo", "flcampotipo", "flativo"],
  campodinamicodado: ["cddado", "cdmodulo", "cdregistrovinculo", "cdcampodinamico", "devalortexto", "devalornumero", "devalordata", "devalorboolean", "flcampotipo", "flativo"],
  campodinamicoitemlista: ["cditemlista", "nmitemlista", "cdcampodinamico", "flativo"],
  processopedido: ["cdprocesso", "nmprocessopedido", "observacao", "valorpedido", "valordeferido", "flativo", "flexclusaotipo"],
};

export function criarEnriquecedorProjuris(tabelas: Tabelas) {
  const index = (t: string, chave: string) => new Map((tabelas[t] ?? []).filter(ativo).map(r => [str(r[chave]), r]));
  const group = (t: string, chave: string) => {
    const map = new Map<string, Row[]>();
    for (const r of (tabelas[t] ?? []).filter(ativo)) { const k = str(r[chave]); map.set(k, [...(map.get(k) ?? []), r]); }
    return map;
  };
  const cidades = index("cidade", "cdcidade"), estados = index("estado", "cdestado"), orgaos = index("processoorgao", "cdprocessoorgao");
  const pessoas = index("pessoa", "cdpessoa"), usuarios = index("usuario", "cdusuario");
  const partes = group("processoparticipacaotipo", "cdprocesso"), responsaveis = group("reprocessousuario", "cdprocesso"), pedidos = group("processopedido", "cdprocesso");
  const papeis = index("participacaotipo", "cdparticipacaotipo"), defs = index("campodinamico", "cdcampodinamico");
  const dinamicos = group("campodinamicodado", "cdregistrovinculo");
  const lookups = [
    ["cdprocessojustica", "processojustica", "cdprocessojustica", "nmprocessojustica", "justica"],
    ["cdfaseprocesso", "processofase", "cdprocessofase", "nmfase", "fase"],
    ["cdclasse", "classecnj", "cod_classe", "natureza", "classe"],
    ["cdsituacaoprocesso", "processosituacao", "cdprocessosituacao", "desituacao", "situacao_original"],
    ["cdunidadeorganizacionalatual", "unidadeorganizacional", "cdunidadeorganizacional", "nmunidadeorganizacional", "unidade_cliente"],
  ].map(([source, table, key, label, dest]) => ({ source, label, dest, map: index(table, key) }));
  const areas = index("processoarea", "cdprocessoarea"), varasN = index("processovaranumero", "cdprocessovaranumero"), varasT = index("processovaratipo", "cdprocessovaratipo");
  return (origem: Row): Complementos => {
    const out = complementosProjuris(origem); const cd = str(origem.cdprocesso); const notas: string[] = [];
    for (const x of lookups) { const v = str(x.map.get(str(origem[x.source]))?.[x.label]); if (v) out[x.dest] = v; }
    const orgao = orgaos.get(str(origem.cdprocessoorgaojudicial));
    if (orgao) {
      out.orgao_julgador = str(orgao.nmorgao);
      let atual = orgao; const vistos = new Set<string>();
      while (str(atual.cdprocessoorgaopai) && !vistos.has(str(atual.cdprocessoorgaopai))) { vistos.add(str(atual.cdprocessoorgaopai)); const pai = orgaos.get(str(atual.cdprocessoorgaopai)); if (!pai) break; atual = pai; }
      if (atual !== orgao || /tribunal/i.test(str(atual.nmorgao))) out.tribunal = str(atual.abvorgao) || str(atual.nmorgao);
    }
    const cidade = cidades.get(str(origem.cdcidade) || str(orgao?.cdcidade));
    if (cidade) out.comarca = str(cidade.nmcidade);
    const uf = str(estados.get(str(origem.cdestado) || str(cidade?.cdestado))?.nmsigla);
    if (uf) out.uf = uf;
    const vara = [str(varasN.get(str(origem.cdprocessovaranumero))?.nmprocessovaranumero), str(varasT.get(str(origem.cdprocessovaratipo))?.nmprocessovaratipo)].filter(Boolean).join(" ");
    if (vara) out.vara = vara;
    const area = norm(areas.get(str(origem.cdareaprocesso))?.nmarea);
    const areaEnum: Record<string, string> = { civil: "civil", trabalhista: "trabalhista", "direito privado": "direito_privado", empresarial: "empresarial" };
    if (areaEnum[area]) out.area = areaEnum[area];
    const nomesResp = (responsaveis.get(cd) ?? []).map(r => { const u = usuarios.get(str(r.cdusuario)); return str(pessoas.get(str(u?.cdpessoa))?.nmpessoa) || str(u?.delogin); }).filter(Boolean);
    if (nomesResp.length) out.responsaveis_projuris = [...new Set(nomesResp)].join("; ");
    const ativoN: string[] = [], passivoN: string[] = [];
    for (const r of partes.get(cd) ?? []) {
      const nome = str(pessoas.get(str(r.cdpessoa))?.nmpessoa); if (!nome) continue;
      const papel = papeis.get(str(r.cdparticipacaotipo)); const label = str(papel?.nmparticipacaotipo || papel?.departicipacaotipo);
      if (/^(autor|reclamante|requerente|exequente)$/.test(norm(label))) ativoN.push(nome);
      else if (/^(reu|reclamado|requerido|executado)$/.test(norm(label))) passivoN.push(nome);
      else notas.push(`Parte (${label || `tipo Projuris ${str(r.cdparticipacaotipo)}`}): ${nome}`);
    }
    if (ativoN.length) out.polo_ativo = [...new Set(ativoN)].join("; ");
    if (passivoN.length) out.polo_passivo = [...new Set(passivoN)].join("; ");
    const textosPedidos = (pedidos.get(cd) ?? []).map(r => [str(r.nmprocessopedido), str(r.observacao), str(r.valorpedido) ? `Valor pedido: ${str(r.valorpedido)}` : ""].filter(Boolean).join(" — "));
    if (textosPedidos.length) out.pedidos = textosPedidos.join("\n");
    for (const r of dinamicos.get(cd) ?? []) {
      if (str(r.cdmodulo) !== "3") continue;
      const def = defs.get(str(r.cdcampodinamico)); const label = str(def?.nmcampo); if (!label) continue;
      // Selection values require a linkage table; the boolean placeholder is not a selected option.
      if (/LISTA/.test(str(r.flcampotipo))) continue;
      const value = str(r.devalortexto) || str(r.devalornumero) || str(r.devalordata) || (/BOOLEAN/.test(str(r.flcampotipo)) ? str(r.devalorboolean) : "");
      if (!value) continue;
      if (norm(label) === "sistema judicial") out.sistema = value; else notas.push(`${label}: ${value}`);
    }
    if (str(origem.dttransitojulgado)) notas.push(`Trânsito em julgado (Projuris): ${str(origem.dttransitojulgado)}`);
    if (str(origem.deencerramento)) notas.push(`Encerramento (Projuris): ${str(origem.deencerramento)}`);
    if (notas.length) out.observacoes_processo = [str(out.observacoes_processo), "Informações complementares do Projuris:", ...new Set(notas)].filter(Boolean).join("\n");
    return out;
  };
}