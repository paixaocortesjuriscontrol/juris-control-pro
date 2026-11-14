import { useRef, useState } from "react";
import { executarFila } from "@/lib/projurisImportQueue";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Upload, Download, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lerPlanilha, norm, digitos, formatarCnj, paraData, paraHora } from "@/lib/migracaoProjuris";
import { casarNomeAproximado } from "./agendaFuturaProjuris";
import { dividirPipe, statusAudiencia, statusTarefa, tipoItem, semPapel, TITULOS_AUDIENCIA } from "./agendaFuturaProjuris";

const db = supabase as any;
const COORD = "968631d0-6659-46f1-b45d-899892cb0121"; // Coordenação Santander Cível
const LOTE = 200;
const ceder = () => new Promise((r) => setTimeout(r, 0));

type Linha = Record<string, any>;
const col = (r: Linha, nome: string) => {
  const k = Object.keys(r).find((h) => norm(h) === norm(nome));
  return k ? String(r[k] ?? "").trim() : "";
};
const isoBRT = (data: string | null, hora: string | null) => (data ? `${data}T${hora || "12:00"}:00-03:00` : null);

export function ImportarAgendaFuturaProjuris({ userId, onConcluido }: { userId: string; onConcluido?: () => void }) {
  const [linhas, setLinhas] = useState<any[] | null>(null);
  const [resumo, setResumo] = useState<[string, number][]>([]);
  const [msg, setMsg] = useState("");
  const [prog, setProg] = useState({ etapa: "", feito: 0, total: 0, inicio: 0, criados: 0, erros: 0 });
  const [rodando, setRodando] = useState(false);
  const cancelar = useRef(false);
  const ultimo = useRef(0);
  const etapa = (nome: string, feito: number, total: number, extra: { criados?: number; erros?: number } = {}, forcar = false) => {
    const agora = Date.now();
    if (!forcar && agora - ultimo.current < 300 && feito < total) return;
    ultimo.current = agora;
    setProg((p) => ({ ...p, ...extra, etapa: nome, feito, total, inicio: p.etapa === nome ? p.inicio : agora }));
  };
  const [relatorio, setRelatorio] = useState<any | null>(null);

  const ler = async (f: File | undefined) => {
    if (!f) return;
    setRodando(true); setRelatorio(null); setMsg("Lendo planilha...");
    try {
      const ps = await lerPlanilha(f);
      const p = ps.find((x) => x.headers.some((h) => norm(h) === "identificador da tarefa"));
      if (!p) throw new Error("A planilha não tem a coluna 'Identificador da tarefa'.");
      const ls = p.linhas.map((r) => {
        const titulo = col(r, "TÍTULO DA ATIVIDADE");
        const t = tipoItem(titulo);
        return {
          tar: col(r, "Identificador da tarefa"), pro: col(r, "Identificador do módulo"),
          dig: digitos(col(r, "PROCESSO DE VÍNCULO")), titulo, ...t,
          obs: col(r, "OBSERVAÇÕES"), compl: col(r, "Descrição complementar"), link: col(r, "Link/Local"),
          criacao: paraData(col(r, "Data de criação")), horaCriacao: paraHora(col(r, "Hora de criação")),
          base: paraData(col(r, "Data base")), prevista: paraData(col(r, "Data prevista")), horaPrev: paraHora(col(r, "Hora prevista")),
          fatal: paraData(col(r, "Data fatal")), horaFatal: paraHora(col(r, "Hora fatal")),
          conclusao: paraData(col(r, "Data da conclusão")), horaConcl: paraHora(col(r, "Hora da conclusão")),
          situacao: col(r, "Status da atividade"),
          responsaveis: dividirPipe(col(r, "Responsáveis pela tarefa")), criadoPor: col(r, "Criada por"), concluidoPor: col(r, "Concluída por"),
          etiquetas: dividirPipe(col(r, "ETIQUETAS DA TAREFA")), comentarios: dividirPipe(col(r, "COMENTÁRIOS")),
          assunto: col(r, "Assunto"), instancia: col(r, "Instância"), vara: col(r, "Vara"), fase: col(r, "Fase"),
          ultimoAndamento: col(r, "Descrição do último andamento"),
          ativas: dividirPipe(col(r, "Envolvidos do processo (partes ativas)")), passivas: dividirPipe(col(r, "Envolvidos do processo (partes passivas)")),
          outras: dividirPipe(col(r, "Envolvidos do processo (outras partes)")),
          pasta: col(r, "Pasta física"), pastaCliente: col(r, "Pasta do cliente"), orgao: col(r, "Órgão"), orgaoJulgador: col(r, "Órgão julgador"),
          motivo: null as string | null,
        };
      });
      // Já migradas (reconhece pelo TAR.)
      const tars = Array.from(new Set(ls.map((l) => l.tar).filter(Boolean)));
      const ja = new Set<string>();
      const blocos = Array.from({ length: Math.ceil(tars.length / 200) }, (_, i) => tars.slice(i * 200, i * 200 + 200));
      let feitos = 0; setMsg("");
      await executarFila(blocos, async (b) => {
        const { data, error } = await db.from("migracoes_projuris_itens").select("chave_externa").in("tipo", ["tarefa", "audiencia"]).eq("status", "criado").in("chave_externa", b);
        if (error) throw error;
        (data || []).forEach((d: any) => ja.add(d.chave_externa));
        feitos += b.length; etapa("Conferindo atividades já migradas", feitos, tars.length);
      }, 4);
      etapa("Conferência pronta", tars.length, tars.length, {}, true);
      const vistos = new Set<string>();
      ls.forEach((l) => {
        if (!l.tar) l.motivo = "Sem identificador da tarefa";
        else if (vistos.has(l.tar)) l.motivo = "Repetida na planilha";
        else if (ja.has(l.tar)) l.motivo = "Já migrada antes";
        else if (!l.prevista && !l.fatal) l.motivo = "Sem data";
        vistos.add(l.tar);
      });
      const res = new Map<string, number>();
      ls.forEach((l) => { const k = l.motivo || (l.audiencia ? "Audiência a importar" : l.registro === "prazo" ? "Prazo a importar" : "Tarefa a importar"); res.set(k, (res.get(k) || 0) + 1); });
      setLinhas(ls); setResumo(Array.from(res.entries()).sort((a, b) => b[1] - a[1]));
    } catch (e: any) { toast.error(e?.message || String(e)); }
    setRodando(false); setMsg("");
  };

  const importar = async () => {
    if (!linhas) return;
    setRodando(true); cancelar.current = false;
    const ok = linhas.filter((l) => !l.motivo);
    const cont: Record<string, number> = { audiencias: 0, prazos: 0, tarefas: 0, processosCriados: 0, processosVinculados: 0, comentarios: 0, etiquetas: 0, erros: 0, pulados: linhas.length - ok.length };
    const semUsuario = new Map<string, number>(); const semModelo = new Map<string, number>(); const erros: any[] = [];
    const { data: mig, error: em } = await db.from("migracoes_projuris").insert({ coordenacao_id: COORD, nome: `Projuris Agenda Futura ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`, mapeamento: { modulo: "agenda_futura" }, criado_por: userId }).select("id").single();
    if (em || !mig) { toast.error(em?.message || "Falha ao abrir migração"); setRodando(false); return; }
    const mid = mig.id;
    const log = async (it: any[]) => { for (let k = 0; k < it.length; k += 500) await db.from("migracoes_projuris_itens").insert(it.slice(k, k + 500).map((x) => ({ migracao_id: mid, ...x }))); };
    try {
      await log(linhas.filter((l) => l.motivo).map((l) => ({ tipo: l.audiencia ? "audiencia" : "tarefa", chave_externa: l.tar || null, status: "pulado", motivo: l.motivo, dados: { titulo: l.titulo } })));
      setMsg("Carregando usuários, modelos e etiquetas...");
      const [{ data: perfis }, { data: modelos }, { data: etqs }, { data: cli }] = await Promise.all([
        supabase.from("profiles").select("id, nome"),
        db.from("modelos_titulo_coordenacao").select("id, nome, titulo").eq("coordenacao_id", COORD).eq("ativo", true),
        db.from("etiquetas").select("id, nome").eq("coordenacao_id", COORD),
        db.from("clientes").select("id, nome").ilike("nome", "BANCO SANTANDER (BRASIL)%").limit(1),
      ]);
      const avisados = new Set<string>();
      const usuarios = (perfis || []) as { id: string; nome: string }[];
      const casar = (n: string) => {
        const k = norm(n); if (!k) return null;
        const ex = usuarios.filter((u) => norm(u.nome) === k); if (ex.length === 1) return ex[0].id;
        const t = k.split(" "); const p = usuarios.filter((u) => { const ut = norm(u.nome).split(" "); return ut[0] === t[0] && ut.includes(t[t.length - 1]); });
        if (p.length === 1) return p[0].id;
        const ap = casarNomeAproximado(n, usuarios); if (ap) return ap;
        if (!avisados.has(n)) { avisados.add(n); semUsuario.set(n, 0); } return null;
      };
      const modeloPor = new Map<string, string>();
      (modelos || []).forEach((m: any) => { [m.nome, m.titulo].forEach((x) => x && !modeloPor.has(norm(x)) && modeloPor.set(norm(x), m.id)); });
      const modeloDe = (t: string) => { const id = modeloPor.get(norm(t)); if (!id) semModelo.set(t, (semModelo.get(t) || 0) + 1); return id || null; };
      const etqId = new Map<string, string>((etqs || []).map((e: any) => [norm(e.nome), e.id]));
      const faltam = Array.from(new Set(ok.flatMap((l) => l.etiquetas).filter((e: string) => norm(e) !== "captura" && !etqId.has(norm(e)))));
      etapa("Etiquetas", 0, 1, {}, true);
      if (faltam.length) {
        const { data, error } = await db.from("etiquetas").insert(faltam.map((nome) => ({ nome: String(nome).toUpperCase(), coordenacao_id: COORD, created_by: userId }))).select("id, nome");
        if (error) erros.push({ Etapa: "Etiquetas", Erro: error.message });
        (data || []).forEach((e: any) => etqId.set(norm(e.nome), e.id));
      }
      etapa("Etiquetas", 1, 1, {}, true);
      const clienteId = cli?.[0]?.id || null;

      // Processos
      const digs = Array.from(new Set(ok.map((l) => l.dig).filter((d) => d.length === 20)));
      const proc = new Map<string, { id: string; coord: string | null; pro: string | null }>();
      const blocosP = Array.from({ length: Math.ceil(digs.length / 100) }, (_, i) => digs.slice(i * 100, i * 100 + 100));
      let achados = 0;
      await executarFila(blocosP, async (parte) => {
        const { data, error } = await db.from("processos").select("id, numero, coordenacao_id, identificador_projuris").in("numero", [...parte, ...parte.map(formatarCnj)]);
        if (error) throw error;
        (data || []).forEach((p: any) => proc.set(digitos(p.numero), { id: p.id, coord: p.coordenacao_id, pro: p.identificador_projuris }));
        achados += parte.length; etapa("Procurando processos", achados, digs.length);
      }, 4);
      const primeira = new Map<string, any>(); ok.forEach((l) => l.dig.length === 20 && !primeira.has(l.dig) && primeira.set(l.dig, l));
      const outras = Array.from(primeira.keys()).filter((d) => proc.has(d) && proc.get(d)!.coord !== COORD);
      for (let k = 0; k < outras.length; k += LOTE) {
        await db.from("processos_coordenacoes_responsaveis").upsert(outras.slice(k, k + LOTE).map((d) => ({ processo_id: proc.get(d)!.id, coordenacao_id: COORD })), { onConflict: "processo_id,coordenacao_id", ignoreDuplicates: true });
      }
      cont.processosVinculados = outras.length;
      await log(outras.map((d) => ({ tipo: "processo", chave_externa: d, registro_id: proc.get(d)!.id, status: "existente", motivo: "Já cadastrado em outra coordenação; Santander Cível adicionado como responsável", dados: { pro: primeira.get(d).pro } })));
      // Guarda o PRO. nos processos existentes que ainda não têm
      const semPro = Array.from(primeira.keys()).filter((d) => proc.has(d) && !proc.get(d)!.pro && primeira.get(d).pro);
      let gravPro = 0;
      await executarFila(semPro, async (d) => {
        if (cancelar.current) return;
        await db.from("processos").update({ identificador_projuris: primeira.get(d).pro }).eq("id", proc.get(d)!.id).is("identificador_projuris", null);
        gravPro++; etapa("Gravando número Projuris nos processos", gravPro, semPro.length);
      }, 8);
      const novos = Array.from(primeira.keys()).filter((d) => !proc.has(d));
      for (let k = 0; k < novos.length; k += LOTE) {
        if (cancelar.current) break;
        etapa("Criando processos", k, novos.length, {}, true);
        const parte = novos.slice(k, k + LOTE).map((d) => primeira.get(d));
        const { data, error } = await db.from("processos").insert(parte.map((l: any) => ({
          numero: formatarCnj(l.dig), area: "civil", status: "ativo", coordenacao_id: COORD, cliente_id: clienteId,
          identificador_projuris: l.pro || null, pasta_cliente: l.pastaCliente || l.pasta || null,
          polo_ativo: l.ativas.map(semPapel).join("; ") || null, polo_passivo: l.passivas.map(semPapel).join("; ") || null,
          tribunal: l.orgao || null, vara: l.vara || null, assunto: l.assunto || null, fase: l.fase || null,
          acompanhamento_especial: l.etiquetas.some((e: string) => norm(e) === "captura"),
          observacoes_processo: [l.pasta ? `Pasta física: ${l.pasta}` : "", l.pastaCliente && l.pasta ? `Pasta do cliente: ${l.pastaCliente}` : "", "Importado Projuris (Agenda Futura)"].filter(Boolean).join("\n"),
        }))).select("id, numero");
        if (error) { erros.push(...parte.map((l: any) => ({ Processo: formatarCnj(l.dig), Erro: error.message }))); continue; }
        (data || []).forEach((p: any) => proc.set(digitos(p.numero), { id: p.id, coord: COORD, pro: null }));
        await log((data || []).map((p: any) => ({ tipo: "processo", chave_externa: digitos(p.numero), registro_id: p.id, status: "criado", dados: { pro: primeira.get(digitos(p.numero))?.pro } })));
        cont.processosCriados += (data || []).length;
        await ceder();
      }
      // CAPTURA em processos existentes liga o Acompanhamento Especial
      const capt = Array.from(primeira.values()).filter((l: any) => l.etiquetas.some((e: string) => norm(e) === "captura") && proc.has(l.dig)).map((l: any) => proc.get(l.dig)!.id);
      for (let k = 0; k < capt.length; k += LOTE) await db.from("processos").update({ acompanhamento_especial: true }).in("id", capt.slice(k, k + LOTE)).eq("acompanhamento_especial", false);

      // Atividades
      etapa("Gravando atividades", 0, ok.length, {}, true);
      let gravadas = 0;
      const extras = (l: any) => [
        l.obs, l.compl ? `Descrição complementar: ${l.compl}` : "",
        `Importado Projuris — ${l.tar}${l.pro ? ` / ${l.pro}` : ""}`,
        l.criadoPor ? `Criada por (Projuris): ${l.criadoPor}` : "", l.concluidoPor ? `Concluída por (Projuris): ${l.concluidoPor}` : "",
        l.dig.length !== 20 ? "Sem processo válido na planilha" : "",
      ].filter(Boolean).join("\n");
      const lotes = Array.from({ length: Math.ceil(ok.length / LOTE) }, (_, i) => ok.slice(i * LOTE, i * LOTE + LOTE));
      await executarFila(lotes, async (parte) => {
        if (cancelar.current) return;
        const tar = parte.filter((l) => !l.audiencia); const aud = parte.filter((l) => l.audiencia);
        const pid = (l: any) => proc.get(l.dig)?.id || null;
        const etqRows: any[] = []; const comRowsT: any[] = []; const comRowsA: any[] = [];
        if (tar.length) {
          const { data, error } = await db.from("tarefas").insert(tar.map((l) => {
            const st = statusTarefa(l.situacao); const resp = l.responsaveis.map(casar).filter(Boolean);
            return {
              titulo: l.titulo.slice(0, 500), descricao: l.obs || null, tipo_tarefa: l.tipo, tipo_registro: l.registro,
              data_vencimento: l.prevista || l.fatal, data_prevista: l.prevista || l.fatal, data_fatal: l.fatal || l.prevista, data_base: l.base,
              hora_prevista: l.horaPrev, hora_fatal: l.horaFatal, hora_criacao: l.horaCriacao, hora_conclusao: l.horaConcl,
              data_criacao_projuris: l.criacao, status: st,
              data_cumprimento: ["cumprido", "concluido_sem_sucesso"].includes(st) ? isoBRT(l.conclusao || l.prevista, l.horaConcl) : null,
              prioridade: "media", processo_id: pid(l), coordenacao_id: COORD, responsavel_id: resp[0] || null, criado_por: null,
              criado_por_nome: l.criadoPor || null, concluido_por_nome: l.concluidoPor || null, origem: "projuris",
              identificador_projuris: l.tar, identificador_modulo: l.pro || null, modulo: "Processo", modelo_tarefa_id: modeloDe(l.titulo),
              link_local: l.link || null, descricao_ultimo_andamento: l.ultimoAndamento || null, instancia: l.instancia || null,
              orgao: l.orgao || null, orgao_julgador: l.orgaoJulgador || null, partes_ativas: l.ativas.join(" | ") || null,
              partes_passivas: l.passivas.join(" | ") || null, outras_partes: l.outras.join(" | ") || null, marcadores: l.etiquetas.join(" | ") || null,
              observacoes: extras(l), ...(l.criacao ? { created_at: isoBRT(l.criacao, l.horaCriacao) } : {}),
            };
          })).select("id");
          if (error) { cont.erros += tar.length; erros.push(...tar.map((l) => ({ Atividade: l.tar, Título: l.titulo, Erro: error.message }))); }
          else {
            const rows = data || [];
            const resp = rows.flatMap((r: any, j: number) => Array.from(new Set(tar[j].responsaveis.map(casar).filter(Boolean))).map((u) => ({ tarefa_id: r.id, usuario_id: u })));
            if (resp.length) await db.from("tarefa_responsaveis").insert(resp);
            rows.forEach((r: any, j: number) => {
              const l = tar[j]; l.registro === "prazo" ? cont.prazos++ : cont.tarefas++;
              l.etiquetas.forEach((e: string) => etqId.has(norm(e)) && etqRows.push({ etiqueta_id: etqId.get(norm(e)), entidade: l.registro, entidade_id: r.id, created_by: userId }));
              l.comentarios.forEach((c: string) => comRowsT.push({ tarefa_id: r.id, autor_id: userId, conteudo: `[Importado Projuris] ${c}` }));
            });
            await log(rows.map((r: any, j: number) => ({ tipo: "tarefa", chave_externa: tar[j].tar, registro_id: r.id, status: "criado", dados: { titulo: tar[j].titulo, tipo: tar[j].tipo, data: tar[j].prevista, pro: tar[j].pro } })));
          }
        }
        if (aud.length) {
          const { data, error } = await db.from("audiencias_detectadas").insert(aud.map((l) => {
            const hora = l.horaPrev || l.horaFatal || "12:00";
            return {
              titulo: l.titulo, tipo_audiencia: l.titulo, data_audiencia: isoBRT(l.prevista || l.fatal, hora), hora, hora_brasilia: hora,
              modalidade: /presencial/i.test(l.titulo) ? "Presencial" : null, status: statusAudiencia(l.situacao),
              processo_id: pid(l), processo_numero: l.dig.length === 20 ? formatarCnj(l.dig) : null, coordenacao_id: COORD,
              polo_ativo: l.ativas.map(semPapel).join("; ") || null, cliente: l.passivas.map(semPapel).join("; ") || null,
              local_audiencia: l.link || null, vara_camara: l.vara || null, forum: l.orgao || null, dossie: l.pasta || null,
              advogado: l.responsaveis.join(", ") || null, origem: "projuris", observacoes: extras(l),
              ...(l.criacao ? { created_at: isoBRT(l.criacao, l.horaCriacao) } : {}),
            };
          })).select("id");
          if (error) { cont.erros += aud.length; erros.push(...aud.map((l) => ({ Atividade: l.tar, Título: l.titulo, Erro: error.message }))); }
          else {
            const rows = data || [];
            const adv = rows.flatMap((r: any, j: number) => Array.from(new Set(aud[j].responsaveis.map(casar).filter(Boolean))).map((u) => ({ audiencia_id: r.id, advogado_id: u })));
            if (adv.length) await db.from("audiencias_advogados").insert(adv);
            rows.forEach((r: any, j: number) => {
              cont.audiencias++;
              aud[j].etiquetas.forEach((e: string) => etqId.has(norm(e)) && etqRows.push({ etiqueta_id: etqId.get(norm(e)), entidade: "audiencia", entidade_id: r.id, created_by: userId }));
              aud[j].comentarios.forEach((c: string) => comRowsA.push({ audiencia_id: r.id, autor_id: userId, conteudo: `[Importado Projuris] ${c}` }));
            });
            await log(rows.map((r: any, j: number) => ({ tipo: "audiencia", chave_externa: aud[j].tar, registro_id: r.id, status: "criado", dados: { titulo: aud[j].titulo, tipo: "AUDIÊNCIA", data: aud[j].prevista, pro: aud[j].pro } })));
          }
        }
        const [r1, r2, r3] = await Promise.all([
          etqRows.length ? db.from("etiquetas_itens").insert(etqRows) : { error: null },
          comRowsT.length ? db.from("comentarios_tarefas").insert(comRowsT) : { error: null },
          comRowsA.length ? db.from("comentarios_audiencias").insert(comRowsA) : { error: null },
        ]);
        if (r1.error) erros.push({ Etapa: "Etiquetas das atividades", Erro: r1.error.message }); else cont.etiquetas += etqRows.length;
        if (r2.error) erros.push({ Etapa: "Comentários", Erro: r2.error.message }); else cont.comentarios += comRowsT.length;
        if (r3.error) erros.push({ Etapa: "Comentários de audiências", Erro: r3.error.message }); else cont.comentarios += comRowsA.length;
        gravadas += parte.length;
        etapa("Gravando atividades", gravadas, ok.length, { criados: cont.audiencias + cont.prazos + cont.tarefas, erros: cont.erros });
      }, 3);
      etapa(cancelar.current ? "Cancelado" : "Finalizando", gravadas, ok.length, { criados: cont.audiencias + cont.prazos + cont.tarefas, erros: cont.erros }, true);
      await db.from("migracoes_projuris").update({ status: cancelar.current ? "cancelada" : "concluida", contadores: cont }).eq("id", mid);
      setRelatorio({ cont, cancelado: cancelar.current, semUsuario: Array.from(semUsuario.keys()).map((n) => [n, ok.filter((l) => l.responsaveis.includes(n)).length]), semModelo: Array.from(semModelo), erros, pulados: linhas.filter((l) => l.motivo) });
      toast.success(`Agenda futura: ${cont.audiencias} audiências, ${cont.prazos} prazos e ${cont.tarefas} tarefas importados.`);
      setLinhas(null); onConcluido?.();
    } catch (e: any) {
      await db.from("migracoes_projuris").update({ status: "erro", contadores: cont }).eq("id", mid);
      toast.error(e?.message || String(e));
    }
    setRodando(false); setMsg("");
  };

  const baixar = () => {
    if (!relatorio) return;
    const { cont } = relatorio; const wb = XLSX.utils.book_new();
    const rot: Record<string, string> = { audiencias: "Audiências criadas", prazos: "Prazos criados", tarefas: "Tarefas criadas", processosCriados: "Processos criados", processosVinculados: "Processos de outras coordenações vinculados", comentarios: "Comentários (Importado Projuris)", etiquetas: "Etiquetas aplicadas", erros: "Atividades com erro", pulados: "Linhas puladas" };
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(Object.keys(rot).map((k) => ({ Item: rot[k], Quantidade: cont[k] || 0 }))), "Resumo");
    const aba = (rows: any[], nome: string) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ Aviso: "Nenhum registro" }]), nome);
    aba(relatorio.semUsuario.map(([n, q]: any) => ({ "Responsável no Projuris": n, Ocorrências: q })), "Pessoas não encontradas");
    aba(relatorio.semModelo.map(([n, q]: any) => ({ "Título sem modelo": n, Ocorrências: q })), "Títulos sem modelo");
    aba(relatorio.pulados.map((l: any) => ({ Atividade: l.tar, Título: l.titulo, Motivo: l.motivo })), "Linhas puladas");
    aba(relatorio.erros, "Erros");
    XLSX.writeFile(wb, `Relatorio_Agenda_Futura_Projuris.xlsx`);
  };

  const aImportar = linhas ? linhas.filter((l) => !l.motivo).length : 0;
  const pct = prog.total ? Math.round((prog.feito / prog.total) * 100) : 0;
  const decorrido = prog.inicio ? (Date.now() - prog.inicio) / 1000 : 0;
  const restante = prog.feito > 0 && prog.feito < prog.total ? Math.round((decorrido / prog.feito) * (prog.total - prog.feito)) : null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Agenda futura (planilha do Projuris) — Coordenação Santander Cível</CardTitle>
        <CardDescription>
          Viram audiência somente: {TITULOS_AUDIENCIA.join(", ")}. Os demais títulos viram prazo ou tarefa, ligados aos modelos da coordenação.
          Comentários entram como "Importado Projuris"; processos ausentes são criados. Reimportar não duplica (identificador TAR.).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed p-6 text-sm text-muted-foreground hover:bg-muted/40">
          <Upload className="h-6 w-6" /> Enviar AGENDA_FUTURA_PROJURIS.xlsx
          <input type="file" accept=".xlsx,.xls" className="hidden" disabled={rodando} onChange={(e) => { void ler(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        {rodando && prog.etapa && (
          <div className="space-y-1 rounded-md border bg-muted/30 p-3">
            <div className="flex justify-between text-sm font-medium"><span>{cancelar.current ? "Cancelando…" : prog.etapa}</span><span>{pct}%</span></div>
            <Progress value={pct} />
            <p className="text-xs text-muted-foreground">
              {prog.feito.toLocaleString("pt-BR")} de {prog.total.toLocaleString("pt-BR")}
              {prog.criados ? ` · ${prog.criados.toLocaleString("pt-BR")} criados` : ""}{prog.erros ? ` · ${prog.erros} erros` : ""}
              {restante !== null ? ` · faltam ~${restante >= 60 ? `${Math.ceil(restante / 60)} min` : `${restante} s`}` : ""}
            </p>
          </div>
        )}
        {msg && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{msg}</p>}
        {linhas && (
          <div className="space-y-2 rounded-md border p-3">
            <h4 className="text-sm font-semibold">Conferência (nada foi gravado ainda)</h4>
            {resumo.map(([k, n]) => <div key={k} className="flex justify-between text-sm"><span>{k}</span><Badge variant="secondary">{n.toLocaleString("pt-BR")}</Badge></div>)}
            <div className="flex gap-2">
              <Button disabled={rodando || !aImportar} onClick={importar}>{rodando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Importar {aImportar.toLocaleString("pt-BR")} atividades</Button>
              {rodando && <Button variant="outline" onClick={() => { cancelar.current = true; toast.info("Cancelando ao fim do lote atual…"); }}><X className="mr-1 h-4 w-4" />Cancelar</Button>}
            </div>
          </div>
        )}
        {relatorio && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm">
            <span>{relatorio.cont.audiencias} audiências · {relatorio.cont.prazos} prazos · {relatorio.cont.tarefas} tarefas · {relatorio.cont.processosCriados} processos criados · {relatorio.cont.erros} erros</span>
            <Button size="sm" variant="outline" className="ml-auto" onClick={baixar}><Download className="mr-1 h-4 w-4" />Relatório Excel</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
