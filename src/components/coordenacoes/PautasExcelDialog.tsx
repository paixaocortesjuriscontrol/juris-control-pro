import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { FileSpreadsheet, Upload, Loader2, AlertCircle, CheckCircle2, Download, Tag, Plus } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { PeoplePicker } from "@/components/shared/PeoplePicker";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useEtiquetas, ETIQUETA_MODULOS, ETIQUETA_COLOR_PALETTE } from "@/hooks/useEtiquetas";
import { useFixosDoTipoCoordenacao } from "@/hooks/useCoordenadoresDaCoordenacao";
import { baixarModeloPautasExcel } from "@/lib/pautasExcelModelo";
import {
  parsePautaExcel,
  type PautaExcelRow,
  type PautaExcelParseError,
} from "@/lib/pautasExcelParser";


interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  coordenacaoId: string;
  coordenacaoNome: string;
}

type Etapa = "upload" | "preview" | "importando" | "concluido";

interface ResumoImport {
  processosCriados: number;
  processosExistentes: number;
  audienciasCriadas: number;
  audienciasDuplicadas: number;
  etiquetasAplicadas?: number;
  etiquetasCriadas?: number;
  erros: { linha: number; motivo: string; processo?: string }[];

}

type ErroImport = { linha: number; motivo: string; processo?: string };

/** Classifica o erro em uma categoria legível para o usuário. */
function categoriaErro(motivo: string): string {
  const m = motivo.toLowerCase();
  if (m.includes("número do processo inválido")) return "Número do processo inválido na planilha";
  if (m.includes("duplicate key") || m.includes("já existe")) return "Processo já cadastrado (reutilizado)";
  if (m.includes("etiqueta")) return "Falha ao aplicar etiqueta";
  if (m.includes("audiência") || m.includes("audiencia")) return "Falha ao criar audiência";
  if (m.includes("processo")) return "Falha ao cadastrar processo";
  if (m.includes("data")) return "Data inválida ou ausente";
  return "Outros";
}

function agruparErros(erros: ErroImport[]): { categoria: string; total: number }[] {
  const mapa = new Map<string, number>();
  for (const e of erros) {
    const c = categoriaErro(e.motivo);
    mapa.set(c, (mapa.get(c) || 0) + 1);
  }
  return Array.from(mapa, ([categoria, total]) => ({ categoria, total })).sort(
    (a, b) => b.total - a.total
  );
}

function baixarErrosCsv(erros: ErroImport[]) {
  const linhas = [
    "Linha;Processo;Categoria;Motivo",
    ...erros.map((e) =>
      [e.linha || "", e.processo || "", categoriaErro(e.motivo), e.motivo.replace(/;/g, ",")].join(";")
    ),
  ];
  const blob = new Blob(["\uFEFF" + linhas.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "erros-importacao-pautas.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Busca todas as linhas de uma tabela para uma lista de valores, em blocos e
 * paginando as respostas — o Supabase devolve no máximo 1000 linhas por página,
 * e truncar aqui fazia a checagem de duplicidade falhar.
 */
async function buscarPaginado<T = any>(
  tabela: string,
  colunas: string,
  valores: string[],
  coluna: string,
  coordenacaoId?: string,
): Promise<T[]> {
  const unicos = Array.from(new Set(valores.filter(Boolean)));
  if (unicos.length === 0) return [];
  const BLOCO = 150;
  const PAGINA = 1000;
  const out: T[] = [];
  for (let i = 0; i < unicos.length; i += BLOCO) {
    const slice = unicos.slice(i, i + BLOCO);
    let from = 0;
    while (true) {
      let q = (supabase as any)
        .from(tabela)
        .select(colunas)
        .in(coluna, slice)
        .range(from, from + PAGINA - 1);
      if (coordenacaoId) q = q.eq("coordenacao_id", coordenacaoId);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data as T[]) || [];
      out.push(...rows);
      if (rows.length < PAGINA) break;
      from += PAGINA;
    }
  }
  return out;
}



export function PautasExcelDialog({
  open,
  onOpenChange,
  coordenacaoId,
  coordenacaoNome,
}: Props) {
  const queryClient = useQueryClient();
  const [etapa, setEtapa] = useState<Etapa>("upload");
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [linhas, setLinhas] = useState<PautaExcelRow[]>([]);
  const [errosParse, setErrosParse] = useState<PautaExcelParseError[]>([]);
  const [processosExistentes, setProcessosExistentes] = useState<Set<string>>(new Set());
  /** Chaves `digits|dia|titulo` de atividades já existentes no banco. */
  const [chavesExistentes, setChavesExistentes] = useState<Set<string>>(new Set());
  const [verificandoDuplicidade, setVerificandoDuplicidade] = useState(false);
  const [mostrarErros, setMostrarErros] = useState(true);
  const [responsaveisIds, setResponsaveisIds] = useState<string[]>([]);
  const [envolvidosIds, setEnvolvidosIds] = useState<string[]>([]);
  /** "importar" cria as audiências; "etiquetas" só aplica etiquetas em itens já existentes. */
  const [modo, setModo] = useState<"importar" | "etiquetas">("importar");
  /** Resultado do casamento planilha → audiência existente (modo etiquetas). */
  const [matchEtiquetas, setMatchEtiquetas] = useState<Map<number, string[]>>(new Map());
  const [progresso, setProgresso] = useState(0);
  const [resumo, setResumo] = useState<ResumoImport | null>(null);
  const [etiquetasSel, setEtiquetasSel] = useState<string[]>([]);
  const [buscaEtiqueta, setBuscaEtiqueta] = useState("");
  const { data: catalogoEtiquetas = [], isLoading: carregandoEtiquetas } = useEtiquetas(
    coordenacaoId,
    "itens",
  );
  const { data: fixos } = useFixosDoTipoCoordenacao(coordenacaoId, "audiencia");

  // Pré-carrega responsáveis/envolvidos fixos do tipo Audiência da coordenação.
  const fixosKey = JSON.stringify(fixos ?? null);
  useEffect(() => {
    if (!open || !fixos) return;
    setResponsaveisIds((prev) => (prev.length ? prev : fixos.responsaveis));
    setEnvolvidosIds((prev) => (prev.length ? prev : fixos.envolvidos));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fixosKey]);


  const etiquetasFiltradas = useMemo(() => {
    const q = buscaEtiqueta.trim().toLowerCase();
    return q
      ? catalogoEtiquetas.filter((e) => e.nome.toLowerCase().includes(q))
      : catalogoEtiquetas;
  }, [catalogoEtiquetas, buscaEtiqueta]);

  const toggleEtiqueta = (id: string, checked: boolean) =>
    setEtiquetasSel((prev) => (checked ? [...prev, id] : prev.filter((x) => x !== id)));


  const normalizarTitulo = (titulo: string | null | undefined) =>
    String(titulo ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();

  const diaLocalISO = (dataHora: string | null | undefined) => {
    if (!dataHora) return null;
    // Datas vindas do banco já chegam em ISO; usamos o dia em BRT para comparar
    const bruto = String(dataHora);
    const soData = bruto.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(soData) && bruto.length <= 10) return soData;
    const data = new Date(bruto);
    if (Number.isNaN(data.getTime())) return null;
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(data);
  };

  /**
   * Chave de duplicidade: mesmo processo + MESMO DIA + MESMO TÍTULO.
   * A hora é ignorada de propósito — reimportar a mesma pauta com horário
   * ajustado não deve duplicar a audiência/tarefa.
   */
  const audienciaKey = (
    processoId: string,
    dataHora: string | null | undefined,
    titulo: string | null | undefined,
  ) => {
    const dia = diaLocalISO(dataHora);
    if (!processoId || !dia) return null;
    return `${processoId}|${dia}|${normalizarTitulo(titulo)}`;
  };

  /** Chave por número do processo (dígitos) + dia + título, usada na prévia. */
  const chaveDigits = (
    digits: string,
    dataHora: string | null | undefined,
    titulo: string | null | undefined,
  ) => {
    const dia = diaLocalISO(dataHora);
    if (!digits || !dia) return null;
    return `${digits}|${dia}|${normalizarTitulo(titulo)}`;
  };

  const resetAll = useCallback(() => {
    setEtapa("upload");
    setNomeArquivo("");
    setLinhas([]);
    setErrosParse([]);
    setProcessosExistentes(new Set());
    setChavesExistentes(new Set());
    setMatchEtiquetas(new Map());
    setResponsaveisIds([]);
    setEnvolvidosIds([]);
    setEtiquetasSel([]);
    setBuscaEtiqueta("");

    setProgresso(0);
    setResumo(null);
  }, []);


  const handleClose = () => {
    if (etapa === "importando") return;
    onOpenChange(false);
    setTimeout(resetAll, 300);
  };

  const handleFile = async (file: File) => {
    setNomeArquivo(file.name);
    try {
      const buf = await file.arrayBuffer();
      const { linhas: ls, erros } = parsePautaExcel(buf);
      if (ls.length === 0) {
        toast.error("Nenhuma linha válida encontrada na planilha.");
        setErrosParse(erros);
        setLinhas([]);
        return;
      }

      // Consultar quais processos já existem nesta coordenação
      const numerosMasked = Array.from(new Set(ls.map((l) => l.processo_numero)));
      const numerosDigits = Array.from(new Set(ls.map((l) => l.processo_digits)));
      setVerificandoDuplicidade(true);
      // Processos são únicos por número em TODO o sistema (uma base compartilhada
      // entre coordenações). Por isso a busca não filtra por coordenação: se já
      // existir, ele é reutilizado e a coordenação atual é apenas vinculada.
      const { data: processosDb } = await supabase
        .from("processos")
        .select("id, numero")
        .or(
          [
            `numero.in.(${numerosMasked.map((n) => `"${n}"`).join(",")})`,
            `numero.in.(${numerosDigits.map((n) => `"${n}"`).join(",")})`,
          ].join(",")
        );


      const existSet = new Set<string>();
      const digitsById = new Map<string, string>();
      for (const p of processosDb || []) {
        const d = String(p.numero || "").replace(/\D/g, "");
        if (d) {
          existSet.add(d);
          digitsById.set(p.id as string, d);
        }
      }

      // Atividades já existentes (audiência, tarefa ou evento) nos mesmos processos.
      // Importante: duplicidade é avaliada APENAS dentro da coordenação atual.
      // Itens iguais em outras coordenações são permitidos.
      const chaves = new Set<string>();
      const procIds = Array.from(digitsById.keys());

      // Audiências da coordenação: busca por NÚMERO do processo (mascarado ou só
      // dígitos), o que também alcança audiências sem processo_id vinculado.
      const audiencias = await buscarPaginado<any>(
        "audiencias_detectadas",
        "id, processo_id, processo_numero, data_audiencia, titulo",
        [...numerosMasked, ...numerosDigits],
        "processo_numero",
        coordenacaoId,
      );
      /** `digits|dia` → ids das audiências existentes (usado no modo etiquetas). */
      const audienciasPorDigitsDia = new Map<string, string[]>();
      for (const a of audiencias) {
        const d = String(a.processo_numero || "").replace(/\D/g, "") ||
          digitsById.get(a.processo_id as string) ||
          "";
        if (!d) continue;
        const k = chaveDigits(d, a.data_audiencia, a.titulo);
        if (k) chaves.add(k);
        const dia = diaLocalISO(a.data_audiencia);
        if (dia) {
          const kd = `${d}|${dia}`;
          const arr = audienciasPorDigitsDia.get(kd) || [];
          arr.push(a.id as string);
          audienciasPorDigitsDia.set(kd, arr);
        }
      }

      if (procIds.length > 0) {
        const [tarDb, evtDb] = await Promise.all([
          buscarPaginado<any>(
            "tarefas",
            "processo_id, titulo, data_vencimento",
            procIds,
            "processo_id",
            coordenacaoId,
          ),
          buscarPaginado<any>(
            "eventos_agenda",
            "processo_id, titulo, data_inicio",
            procIds,
            "processo_id",
            coordenacaoId,
          ),
        ]);
        const add = (procId: string, data: any, titulo: any) => {
          const d = digitsById.get(procId);
          if (!d) return;
          const k = chaveDigits(d, data, titulo);
          if (k) chaves.add(k);
        };
        for (const t of tarDb) add(t.processo_id, t.data_vencimento, t.titulo);
        for (const e of evtDb) add(e.processo_id, e.data_inicio, e.titulo);
      }

      // Casamento planilha → audiências existentes (modo "aplicar etiquetas")
      const match = new Map<number, string[]>();
      for (const l of ls) {
        const ids = audienciasPorDigitsDia.get(`${l.processo_digits}|${l.data_iso}`);
        if (ids?.length) match.set(l.linha, ids);
      }

      setLinhas(ls);
      setErrosParse(erros);
      setProcessosExistentes(existSet);
      setChavesExistentes(chaves);
      setMatchEtiquetas(match);
      setMostrarErros(erros.length > 0);
      setEtapa("preview");
    } catch (e: any) {
      console.error(e);
      toast.error(`Erro ao ler planilha: ${e.message || e}`);
    } finally {
      setVerificandoDuplicidade(false);
    }
  };

  const novosCount = useMemo(
    () => linhas.filter((l) => !processosExistentes.has(l.processo_digits)).length,
    [linhas, processosExistentes]
  );

  /** Status por linha: nova, duplicada no banco ou repetida na própria planilha. */
  const statusPorLinha = useMemo(() => {
    const mapa = new Map<number, "nova" | "duplicada_banco" | "duplicada_planilha">();
    const vistas = new Set<string>();
    for (const l of linhas) {
      const k = chaveDigits(l.processo_digits, l.data_iso, l.tipo || "Audiência");
      if (k && chavesExistentes.has(k)) mapa.set(l.linha, "duplicada_banco");
      else if (k && vistas.has(k)) mapa.set(l.linha, "duplicada_planilha");
      else {
        mapa.set(l.linha, "nova");
        if (k) vistas.add(k);
      }
    }
    return mapa;
  }, [linhas, chavesExistentes]);

  const linhasImportaveis = useMemo(
    () => linhas.filter((l) => statusPorLinha.get(l.linha) === "nova"),
    [linhas, statusPorLinha]
  );
  const duplicadasCount = linhas.length - linhasImportaveis.length;

  const executarImport = async () => {
    if (responsaveisIds.length === 0) {
      toast.error("Selecione ao menos um responsável para as audiências.");
      return;
    }

    const alvos = linhasImportaveis;
    setEtapa("importando");
    setProgresso(0);
    const r: ResumoImport = {
      processosCriados: 0,
      processosExistentes: 0,
      audienciasCriadas: 0,
      audienciasDuplicadas: duplicadasCount,
      erros: [...errosParse],
    };

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Sessão expirada.");
      setEtapa("preview");
      return;
    }

    // 1) Buscar processos já existentes (base compartilhada, sem filtro de coordenação)
    const digits = Array.from(new Set(alvos.map((l) => l.processo_digits)));
    const numerosMasked = Array.from(new Set(alvos.map((l) => l.processo_numero)));
    const { data: procsExistentes } = await supabase
      .from("processos")
      .select("id, numero")
      .or(
        [
          `numero.in.(${numerosMasked.map((n) => `"${n}"`).join(",")})`,
          `numero.in.(${digits.map((n) => `"${n}"`).join(",")})`,
        ].join(",")
      );

    const procIdByDigits = new Map<string, string>();
    for (const p of procsExistentes || []) {
      const d = String(p.numero || "").replace(/\D/g, "");
      if (d) procIdByDigits.set(d, p.id as string);
    }
    r.processosExistentes = procIdByDigits.size;

    /** Vincula a coordenação atual a um processo já existente (não sobrescreve o dono). */
    const vincularCoordenacao = async (processoId: string) => {
      await (supabase as any)
        .from("processos_coordenacoes_responsaveis")
        .insert({ processo_id: processoId, coordenacao_id: coordenacaoId, principal: false })
        .then(() => {}, () => {});
    };

    for (const id of procIdByDigits.values()) await vincularCoordenacao(id);

    // 2) Criar processos ausentes (dedup por digits, primeira ocorrência ganha)
    const primeirasPorDigits = new Map<string, PautaExcelRow>();
    for (const l of alvos) {
      if (!procIdByDigits.has(l.processo_digits) && !primeirasPorDigits.has(l.processo_digits)) {
        primeirasPorDigits.set(l.processo_digits, l);
      }
    }

    for (const l of primeirasPorDigits.values()) {
      const { data, error } = await supabase
        .from("processos")
        .insert({
          numero: l.processo_numero,
          tribunal: l.foro || null,
          orgao_julgador: l.vara_camara || null,
          vara: l.vara_camara || null,
          comarca: l.comarca || null,
          uf: l.uf || null,
          polo_ativo: l.polo_ativo || null,
          coordenacao_id: coordenacaoId,
          area: "trabalhista",
          status: "ativo",
        })
        .select("id, numero")
        .single();
      if (error) {
        // Já existe em outra coordenação (índice único global por número):
        // reutiliza o processo e apenas vincula esta coordenação.
        const { data: achado } = await supabase
          .from("processos")
          .select("id")
          .or([`numero.eq.${l.processo_numero}`, `numero.eq.${l.processo_digits}`].join(","))
          .limit(1)
          .maybeSingle();
        if (achado?.id) {
          procIdByDigits.set(l.processo_digits, achado.id as string);
          r.processosExistentes++;
          await vincularCoordenacao(achado.id as string);
          continue;
        }
        r.erros.push({
          linha: l.linha,
          motivo: `Não foi possível cadastrar o processo: ${error.message}`,
          processo: l.processo_numero,
        });
        continue;
      }
      procIdByDigits.set(l.processo_digits, data.id as string);
      r.processosCriados++;
    }


    // 3) Pré-consulta de duplicidade: atividade (audiência, tarefa ou evento)
    //    já existente no MESMO processo + MESMO DIA + MESMO TÍTULO bloqueia a criação.
    //    Se o título for diferente, permite criar a nova atividade.
    const procIds = Array.from(new Set(Array.from(procIdByDigits.values())));
    const audChave = new Set<string>(); // processo|dia|titulo

    if (procIds.length > 0) {
      const [audienciasDb, tarefasDb, eventosDb] = await Promise.all([
        buscarPaginado<any>(
          "audiencias_detectadas",
          "processo_id, data_audiencia, titulo",
          procIds,
          "processo_id",
          coordenacaoId,
        ),
        buscarPaginado<any>(
          "tarefas",
          "processo_id, titulo, data_vencimento",
          procIds,
          "processo_id",
          coordenacaoId,
        ),
        buscarPaginado<any>(
          "eventos_agenda",
          "processo_id, titulo, data_inicio",
          procIds,
          "processo_id",
          coordenacaoId,
        ),
      ]);

      for (const a of audienciasDb) {
        const chave = audienciaKey(a.processo_id || "", a.data_audiencia, a.titulo);
        if (chave) audChave.add(chave);
      }
      for (const t of tarefasDb) {
        const chave = audienciaKey(t.processo_id || "", t.data_vencimento, t.titulo);
        if (chave) audChave.add(chave);
      }
      for (const e of eventosDb) {
        const chave = audienciaKey(e.processo_id || "", e.data_inicio, e.titulo);
        if (chave) audChave.add(chave);
      }
    }

    // 3.5) Resolver etiquetas por linha (coluna ETIQUETA): nome (normalizado) → id.
    //      Se a etiqueta não existir no catálogo da coordenação, é criada.
    const normNomeEtiqueta = (v: string) =>
      v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

    const etiquetaIdByNome = new Map<string, string>();
    for (const e of catalogoEtiquetas) {
      etiquetaIdByNome.set(normNomeEtiqueta(e.nome), e.id);
    }

    const nomesNovos = Array.from(
      new Set(
        alvos
          .map((l) => l.etiqueta)
          .filter((n) => n && !etiquetaIdByNome.has(normNomeEtiqueta(n))),
      ),
    );
    // Dedup por nome normalizado (evita criar "X" e "x")
    const novasPorNome = new Map<string, string>();
    for (const n of nomesNovos) {
      const k = normNomeEtiqueta(n);
      if (!novasPorNome.has(k)) novasPorNome.set(k, n.trim());
    }

    let etiquetasCriadas = 0;
    for (const [nomeNorm, nomeOriginal] of novasPorNome) {
      const cor = ETIQUETA_COLOR_PALETTE[etiquetaIdByNome.size % ETIQUETA_COLOR_PALETTE.length];
      const { data: nova, error: errNova } = await (supabase as any)
        .from("etiquetas")
        .insert({
          coordenacao_id: coordenacaoId,
          nome: nomeOriginal,
          cor,
          modulos: ETIQUETA_MODULOS.map((m) => m.value),
          created_by: user.id,
        })
        .select("id")
        .single();
      if (errNova || !nova) {
        r.erros.push({ linha: 0, motivo: `Erro ao criar etiqueta "${nomeOriginal}": ${errNova?.message || "desconhecido"}` });
        continue;
      }
      etiquetaIdByNome.set(nomeNorm, nova.id as string);
      etiquetasCriadas++;
    }
    r.etiquetasCriadas = etiquetasCriadas;

    // 4) Criar audiências
    let processadas = 0;
    const idsCriados: string[] = [];
    const etiquetasPorAudiencia = new Map<string, string[]>();
    for (const l of alvos) {
      processadas++;
      setProgresso(Math.round((processadas / alvos.length) * 100));

      const procId = procIdByDigits.get(l.processo_digits);
      if (!procId) continue;

      const hora = l.hora || "12:00";
      const dataAudISO = `${l.data_iso}T${hora}:00-03:00`;
      const titulo = l.tipo || "Audiência";
      const chaveAudiencia = audienciaKey(procId, l.data_iso, titulo);

      if (chaveAudiencia && audChave.has(chaveAudiencia)) {
        r.audienciasDuplicadas++;
        continue;
      }



      const audId = crypto.randomUUID();
      const { error: audErr } = await supabase
        .from("audiencias_detectadas")
        .insert({
          id: audId,
          processo_id: procId,
          processo_numero: l.processo_numero,
          titulo,
          tipo_audiencia: l.tipo || null,
          data_audiencia: dataAudISO,
          hora: l.hora || null,
          forum: l.foro || null,
          sala_forum: l.vara_camara || null,
          vara_camara: l.vara_camara || null,
          local_audiencia: l.local || null,
          comarca: l.comarca || null,
          polo_ativo: l.polo_ativo || null,
          cliente: l.cliente || null,
          terceirizado: l.terceirizada,
          modalidade: l.modalidade || null,
          observacoes: l.observacoes || null,
          coordenacao_id: coordenacaoId,
          criado_por: user.id,
          status: "pendente",
          origem: "pauta_excel",
        });

      if (audErr) {
        r.erros.push({
          linha: l.linha,
          motivo: `Erro ao cadastrar audiência: ${audErr.message || "desconhecido"}`,
          processo: l.processo_numero,
        });
        continue;
      }

      // Vincular responsáveis
      const advogadosInsert = responsaveisIds.map((advogadoId) => ({
        audiencia_id: audId,
        advogado_id: advogadoId,
      }));
      if (advogadosInsert.length > 0) {
        await supabase.from("audiencias_advogados").insert(advogadosInsert);
      }

      if (chaveAudiencia) audChave.add(chaveAudiencia);
      idsCriados.push(audId);

      const etiquetaLinhaId = l.etiqueta
        ? etiquetaIdByNome.get(normNomeEtiqueta(l.etiqueta))
        : undefined;
      const etiquetasDaAudiencia = Array.from(
        new Set([...(etiquetasSel || []), ...(etiquetaLinhaId ? [etiquetaLinhaId] : [])]),
      );
      if (etiquetasDaAudiencia.length > 0) etiquetasPorAudiencia.set(audId, etiquetasDaAudiencia);

      r.audienciasCriadas++;
    }

    // 5) Aplicar etiquetas (selecionadas na tela + coluna ETIQUETA por linha)
    if (etiquetasPorAudiencia.size > 0) {
      const vinculos = Array.from(etiquetasPorAudiencia.entries()).flatMap(
        ([entidadeId, ids]) =>
          ids.map((etiquetaId) => ({
            etiqueta_id: etiquetaId,
            entidade: "audiencia",
            entidade_id: entidadeId,
            created_by: user.id,
          })),
      );
      for (let i = 0; i < vinculos.length; i += 200) {
        const slice = vinculos.slice(i, i + 200);
        const { error } = await (supabase as any)
          .from("etiquetas_itens")
          .upsert(slice, {
            onConflict: "etiqueta_id,entidade,entidade_id",
            ignoreDuplicates: true,
          });
        if (error) {
          r.erros.push({ linha: 0, motivo: `Erro ao aplicar etiquetas: ${error.message}` });
          break;
        }
      }
      r.etiquetasAplicadas = vinculos.length;
    }

    setResumo(r);

    setEtapa("concluido");
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["audiencias-detectadas"] }),
      queryClient.invalidateQueries({ queryKey: ["audiencias-stats"] }),
      queryClient.invalidateQueries({ queryKey: ["painel-controle-audiencias-det-stats"] }),
      queryClient.invalidateQueries({ queryKey: ["processos"] }),
      queryClient.invalidateQueries({ queryKey: ["etiquetas-itens"] }),
      queryClient.invalidateQueries({ queryKey: ["etiquetas"] }),

    ]);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : handleClose())}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Importar Pautas Excel
          </DialogTitle>
          <DialogDescription>
            Coordenação: <strong>{coordenacaoNome}</strong>
          </DialogDescription>
        </DialogHeader>

        {etapa === "upload" && (
          <div className="space-y-4 py-4">
            <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-lg p-10 cursor-pointer hover:bg-muted/40 transition-colors">
              <Upload className="h-10 w-10 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">Selecione a planilha de pautas (.xlsx)</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Colunas esperadas: DATA, HORA, NÚMERO DO PROCESSO, ETIQUETA (opcional), FORO,
                  VT/CÂMARA, Local, COMARCA, UF, PÓLO ATIVO, CLIENTE, TERCEIRIZADA, TIPO,
                  TELEPRESENCIAL, OBSERVAÇÕES/PROVIDÊNCIAS.
                </p>
              </div>
              <input
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </label>
            <div className="flex items-center justify-center">
              <Button variant="outline" size="sm" onClick={baixarModeloPautasExcel}>
                <Download className="h-4 w-4 mr-2" /> Baixar planilha modelo
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground text-center">
              Todas as abas da planilha são lidas. O cabeçalho pode estar em qualquer uma das
              primeiras linhas.
            </p>
          </div>
        )}


        {etapa === "preview" && (
          <div className="flex flex-col gap-4 flex-1 overflow-hidden">
            <div className="flex flex-wrap gap-2 items-center text-sm">
              <Badge variant="secondary">{nomeArquivo}</Badge>
              <Badge className="bg-emerald-600 hover:bg-emerald-600">
                {linhas.length} linhas válidas
              </Badge>
              {novosCount > 0 && (
                <Badge variant="outline">{novosCount} processos novos</Badge>
              )}
              {linhas.length - novosCount > 0 && (
                <Badge variant="outline">{linhas.length - novosCount} já cadastrados</Badge>
              )}
              {duplicadasCount > 0 && (
                <Badge className="bg-amber-500 hover:bg-amber-500 text-black">
                  {duplicadasCount} duplicadas (não serão importadas)
                </Badge>
              )}
              {errosParse.length > 0 && (
                <Badge
                  variant="destructive"
                  className="cursor-pointer"
                  onClick={() => setMostrarErros((v) => !v)}
                >
                  {errosParse.length} linhas com erro
                </Badge>
              )}
              {verificandoDuplicidade && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> verificando duplicidades…
                </span>
              )}
            </div>

            {errosParse.length > 0 && mostrarErros && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <p className="font-medium mb-1">
                    {errosParse.length} linha(s) da planilha não serão importadas:
                  </p>
                  <ScrollArea className="h-40 pr-3">
                    <ul className="text-xs space-y-0.5">
                      {errosParse.map((e, i) => (
                        <li key={`pe-${i}`}>
                          Linha {e.linha}: {e.motivo}
                          {e.processo ? ` (${e.processo})` : ""}
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                </AlertDescription>
              </Alert>

            )}

            <div className="space-y-2">
              <Label>
                Responsáveis pelas audiências{" "}
                <span className="text-destructive">*</span>
              </Label>
              <PeoplePicker
                selectedIds={responsaveisIds}
                onChange={setResponsaveisIds}
                placeholder="Adicionar responsável"
                emptyLabel="Nenhum responsável selecionado — obrigatório"
              />
              <p className="text-xs text-muted-foreground">
                Os responsáveis selecionados serão vinculados a todas as audiências importadas.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Tag className="h-4 w-4" /> Etiquetas (opcional)
              </Label>
              {carregandoEtiquetas ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Carregando etiquetas…
                </div>
              ) : catalogoEtiquetas.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhuma etiqueta cadastrada para itens nesta coordenação.{" "}
                  <Link to="/etiquetas" className="inline-flex items-center gap-1 text-primary hover:underline">
                    <Plus className="h-3 w-3" /> Gerenciar etiquetas
                  </Link>
                </p>
              ) : (
                <>
                  <Input
                    value={buscaEtiqueta}
                    onChange={(e) => setBuscaEtiqueta(e.target.value)}
                    placeholder="Buscar etiqueta..."
                    className="h-8 text-xs"
                  />
                  <div className="max-h-32 overflow-auto border rounded-md p-2 space-y-1">
                    {etiquetasFiltradas.map((et) => (
                      <label
                        key={et.id}
                        className="flex items-center gap-2 text-xs px-1 py-0.5 rounded hover:bg-muted/60 cursor-pointer"
                      >
                        <Checkbox
                          checked={etiquetasSel.includes(et.id)}
                          onCheckedChange={(v) => toggleEtiqueta(et.id, !!v)}
                        />
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: et.cor }}
                        />
                        <span className="truncate">{et.nome}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    As etiquetas marcadas serão aplicadas a todas as audiências criadas. Se a
                    planilha tiver a coluna ETIQUETA, ela também é aplicada por linha (e criada
                    automaticamente se ainda não existir).
                  </p>
                </>
              )}
            </div>


            <ScrollArea className="flex-1 border rounded-md">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="p-2 text-left">Linha</th>
                    <th className="p-2 text-left">Data / Hora</th>
                    <th className="p-2 text-left">Processo</th>
                    <th className="p-2 text-left">Tipo</th>
                    <th className="p-2 text-left">Foro / Vara</th>
                    <th className="p-2 text-left">Cliente</th>
                    <th className="p-2 text-left">Etiqueta</th>
                    <th className="p-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => (
                    <tr
                      key={l.linha}
                      className={
                        statusPorLinha.get(l.linha) === "nova"
                          ? "border-t"
                          : "border-t bg-amber-500/10 text-muted-foreground"
                      }
                    >
                      <td className="p-2">{l.linha}</td>
                      <td className="p-2">
                        {l.data_iso.split("-").reverse().join("/")}
                        {l.hora ? ` ${l.hora}` : ""}
                      </td>
                      <td className="p-2 font-mono">{l.processo_numero}</td>
                      <td className="p-2">{l.tipo}</td>
                      <td className="p-2">
                        {l.foro}
                        {l.vara_camara ? ` — ${l.vara_camara}` : ""}
                      </td>
                      <td className="p-2">{l.cliente}</td>
                      <td className="p-2">
                        {l.etiqueta ? (
                          <Badge variant="secondary" className="text-[10px]">{l.etiqueta}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-2">
                        {statusPorLinha.get(l.linha) === "duplicada_banco" ? (
                          <Badge className="bg-amber-500 hover:bg-amber-500 text-black text-[10px]">
                            Já existe
                          </Badge>
                        ) : statusPorLinha.get(l.linha) === "duplicada_planilha" ? (
                          <Badge className="bg-amber-500 hover:bg-amber-500 text-black text-[10px]">
                            Repetida na planilha
                          </Badge>
                        ) : processosExistentes.has(l.processo_digits) ? (
                          <Badge variant="outline" className="text-[10px]">Existente</Badge>
                        ) : (
                          <Badge className="bg-emerald-600 hover:bg-emerald-600 text-[10px]">Novo</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                  {errosParse.map((e) => (
                    <tr key={`err-${e.linha}`} className="border-t bg-destructive/10">
                      <td className="p-2">{e.linha}</td>
                      <td colSpan={6} className="p-2 text-destructive">
                        {e.motivo}
                        {e.processo ? ` — ${e.processo}` : ""}
                      </td>
                      <td className="p-2">
                        <Badge variant="destructive" className="text-[10px]">Erro</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </div>
        )}

        {etapa === "importando" && (
          <div className="space-y-4 py-8">
            <div className="flex items-center gap-3 justify-center">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Importando pautas…</span>
            </div>
            <Progress value={progresso} />
            <p className="text-xs text-center text-muted-foreground">{progresso}%</p>
          </div>
        )}

        {etapa === "concluido" && resumo && (
          <div className="space-y-3 py-4">
            <Alert className="border-emerald-600/40 bg-emerald-600/10">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <AlertDescription>Importação concluída.</AlertDescription>
            </Alert>
            <ul className="text-sm space-y-1">
              <li>• Processos criados: <strong>{resumo.processosCriados}</strong></li>
              <li>• Processos reutilizados: <strong>{resumo.processosExistentes}</strong></li>
              <li>• Audiências criadas: <strong>{resumo.audienciasCriadas}</strong></li>
              <li>• Audiências duplicadas ignoradas: <strong>{resumo.audienciasDuplicadas}</strong></li>
              {!!resumo.etiquetasAplicadas && (
                <li>• Etiquetas aplicadas: <strong>{resumo.etiquetasAplicadas}</strong></li>
              )}
              {!!resumo.etiquetasCriadas && (
                <li>• Etiquetas novas criadas: <strong>{resumo.etiquetasCriadas}</strong></li>
              )}

              <li>• Erros: <strong>{resumo.erros.length}</strong></li>
            </ul>
            {resumo.erros.length > 0 && (
              <div className="space-y-2">
                <div className="rounded-md border bg-muted/40 p-2 space-y-1">
                  <p className="text-xs font-medium">Resumo dos erros por motivo:</p>
                  <ul className="text-xs space-y-0.5">
                    {agruparErros(resumo.erros).map((g) => (
                      <li key={g.categoria}>
                        • {g.categoria}: <strong>{g.total}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Lista completa ({resumo.erros.length}) — role para ver todos:
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => baixarErrosCsv(resumo.erros)}
                  >
                    Baixar erros (CSV)
                  </Button>
                </div>
                <ScrollArea className="h-64 border rounded-md p-2">
                  <ul className="text-xs space-y-1">
                    {resumo.erros.map((e, i) => (
                      <li key={i} className="flex gap-2 items-start">
                        <AlertCircle className="h-3 w-3 text-destructive mt-0.5 shrink-0" />
                        <span>
                          {e.linha ? `Linha ${e.linha}: ` : ""}
                          {e.motivo}
                          {e.processo ? ` (${e.processo})` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </div>
            )}

          </div>
        )}

        <DialogFooter>
          {etapa === "upload" && (
            <Button variant="ghost" onClick={handleClose}>Cancelar</Button>
          )}
          {etapa === "preview" && (
            <>
              <Button variant="ghost" onClick={handleClose}>Cancelar</Button>
              <Button
                onClick={executarImport}
                disabled={linhasImportaveis.length === 0 || responsaveisIds.length === 0}
              >
                Importar {linhasImportaveis.length} audiências
              </Button>
            </>
          )}
          {etapa === "concluido" && (
            <Button onClick={handleClose}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}