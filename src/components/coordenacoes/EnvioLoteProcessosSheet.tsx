import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { lerLinhasLote, separarEtiquetas, semAcento, type LinhaLote } from "@/lib/loteProcessosSantander";
import { garantirRito } from "@/components/processos/RitoProcessualSelect";

const sb = supabase as any;
const pausa = () => new Promise((r) => requestAnimationFrame(() => r(null)));

export function EnvioLoteProcessosSheet({ open, onOpenChange, coordenacaoId, coordenacaoNome }: {
  open: boolean; onOpenChange: (v: boolean) => void; coordenacaoId: string; coordenacaoNome: string;
}) {
  const [linhas, setLinhas] = useState<LinhaLote[]>([]);
  const [existentes, setExistentes] = useState<Map<string, string>>(new Map());
  const [progresso, setProgresso] = useState<number | null>(null);
  const [feitos, setFeitos] = useState(0);
  const cancelarRef = useRef(false);
  const [resumo, setResumo] = useState<{ criados: number; atualizados: number; compartilhados?: number; rejeitados: LinhaLote[] } | null>(null);

  const [leitura, setLeitura] = useState<{ etapa: string; pct: number } | null>(null);

  const carregar = async (f: File) => {
    setResumo(null); setLinhas([]);
    atuaisRef.current = new Map();
    try {
      setLeitura({ etapa: "Lendo a planilha...", pct: 5 }); await pausa();
      const wb = XLSX.read(await f.arrayBuffer());
      setLeitura({ etapa: "Conferindo as linhas...", pct: 15 }); await pausa();
      const dados = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null });
      const lidas = lerLinhasLote(dados, coordenacaoNome);
      setLeitura({ etapa: "Conferindo os responsáveis...", pct: 25 }); await pausa();
      const perfis: any[] = [];
      for (let de = 0; ; de += 1000) {
        const { data, error } = await sb.from("profiles").select("id,nome").range(de, de + 999);
        if (error) throw error;
        perfis.push(...(data || []));
        if (!data || data.length < 1000) break;
      }
      const { data: membros } = await sb.from("membros_coordenacao").select("usuario_id").eq("coordenacao_id", coordenacaoId);
      const idsMembros = new Set((membros || []).map((m: any) => m.usuario_id));
      const porNome = new Map<string, string>();
      perfis.forEach((p: any) => p.nome && (!porNome.has(semAcento(p.nome)) || idsMembros.has(p.id)) && porNome.set(semAcento(p.nome), p.id));
      lidas.forEach((l) => {
        const r = l.campos._responsavel;
        if (!l.erro && r) {
          const id = porNome.get(semAcento(r));
          if (id) l.campos.advogado_responsavel_id = id; else l.erro = `Responsável não encontrado (${r})`;
        }
      });
      // Só as colunas usadas pela planilha (a tabela tem 200+ colunas)
      const cols = new Set<string>(["id", "numero", "coordenacao_id"]);
      lidas.forEach((l) => Object.keys(l.campos).forEach((k) => !k.startsWith("_") && cols.add(k)));
      const nums = [...new Set(lidas.filter((l) => !l.erro).map((l) => l.campos.numero as string))];
      const mapa = new Map<string, string>();
      const TAM = 200;
      for (let i = 0; i < nums.length; i += TAM) {
        const { data, error } = await sb.from("processos").select([...cols].join(",")).in("numero", nums.slice(i, i + TAM));
        if (error) throw error;
        (data || []).forEach((p: any) => { mapa.set(p.numero, p.id); atuaisRef.current.set(p.id, p); });
        const feito = Math.min(i + TAM, nums.length);
        setLeitura({ etapa: `Procurando processos já cadastrados: ${feito} de ${nums.length}`, pct: 30 + Math.round((feito / nums.length) * 70) });
        await pausa();
      }
      setExistentes(mapa);
      setLinhas(lidas);
    } finally {
      setLeitura(null);
    }
  };

  const atuaisRef = useRef<Map<string, any>>(new Map());
  const validas = linhas.filter((l) => !l.erro);
  const novos = validas.filter((l) => !existentes.has(l.campos.numero)).length;

  const enviar = async () => {
    setProgresso(0);
    const rejeitados = linhas.filter((l) => l.erro);
    let criados = 0, atualizados = 0, compartilhados = 0;
    const { data: ritosDb } = await sb.from("ritos_processuais").select("nome");
    const ritos: string[] = (ritosDb || []).map((r: any) => r.nome);
    const { data: clientes } = await sb.from("clientes").select("id,nome");
    const cli = new Map<string, string>((clientes || []).map((c: any) => [semAcento(c.nome), c.id]));
    // Etiquetas da coordenação (cria as que faltarem)
    const { data: u } = await sb.auth.getUser();
    const { data: etqDb } = await sb.from("etiquetas").select("id,nome").eq("coordenacao_id", coordenacaoId);
    const etq = new Map<string, string>((etqDb || []).map((e: any) => [semAcento(e.nome), e.id]));
    const nomesEtq = new Set<string>();
    validas.forEach((l) => separarEtiquetas(l.campos._etiquetas).forEach((n) => nomesEtq.add(n)));
    for (const n of nomesEtq) {
      if (etq.has(semAcento(n))) continue;
      const { data: nova, error } = await sb.from("etiquetas").insert({ nome: n.toUpperCase(), coordenacao_id: coordenacaoId, modulos: ["processo"], created_by: u.user?.id }).select("id").single();
      if (!error && nova?.id) etq.set(semAcento(n), nova.id);
    }
    const etiquetar = async (processoId: string, valor: any) => {
      const ids = separarEtiquetas(valor).map((n) => etq.get(semAcento(n))).filter(Boolean) as string[];
      for (const etiqueta_id of ids) {
        const { error } = await sb.from("etiquetas_itens").insert({ etiqueta_id, entidade: "processo", entidade_id: processoId, created_by: u.user?.id });
        if (error && !String(error.message).toLowerCase().includes("duplicate")) console.warn("etiqueta", error.message);
      }
    };
    cancelarRef.current = false;
    let feitosN = 0;
    const marcar = (n: number) => { feitosN += n; setFeitos(feitosN); setProgresso(Math.round((feitosN / validas.length) * 100)); };
    const preparar = async (l: LinhaLote) => {
      const { _responsavel, _situacao, _coordenacao, _cliente, _etiquetas, ...c } = l.campos;
      if (c.rito_processual) { c.rito_processual = await garantirRito(c.rito_processual, ritos); if (!ritos.includes(c.rito_processual)) ritos.push(c.rito_processual); }
      if (_cliente && cli.has(semAcento(_cliente))) c.cliente_id = cli.get(semAcento(_cliente));
      return c;
    };
    const novosL = validas.filter((l) => !existentes.has(l.campos.numero));
    const atuaisL = validas.filter((l) => existentes.has(l.campos.numero));
    // Compartilhamentos já existentes desta coordenação
    const jaCompart = new Set<string>();
    const idsOutras = atuaisL.map((l) => existentes.get(l.campos.numero)!).filter((id) => atuaisRef.current.get(id)?.coordenacao_id !== coordenacaoId);
    for (let i = 0; i < idsOutras.length; i += 150) {
      const { data } = await sb.from("processos_coordenacoes_responsaveis").select("processo_id").eq("coordenacao_id", coordenacaoId).in("processo_id", idsOutras.slice(i, i + 150));
      (data || []).forEach((r: any) => jaCompart.add(r.processo_id));
    }
    // Novos: em lotes de 50; se o lote falhar, tenta um a um para isolar o erro
    for (let i = 0; i < novosL.length && !cancelarRef.current; i += 50) {
      const lote = novosL.slice(i, i + 50);
      const regs: any[] = [];
      for (const l of lote) regs.push({ ...(await preparar(l)), coordenacao_id: coordenacaoId, status: "ativo" });
      const { data: ins, error } = await sb.from("processos").insert(regs).select("id,numero");
      if (!error) {
        criados += lote.length;
        const porNum = new Map((ins || []).map((r: any) => [r.numero, r.id]));
        for (const l of lote) { const id = porNum.get(l.campos.numero); if (id && l.campos._etiquetas) await etiquetar(id, l.campos._etiquetas); }
      }
      else for (let k = 0; k < lote.length; k++) {
        const r = await sb.from("processos").insert(regs[k]).select("id").single();
        if (!r.error) { criados++; if (r.data?.id && lote[k].campos._etiquetas) await etiquetar(r.data.id, lote[k].campos._etiquetas); continue; }
        // Já cadastrado em outra coordenação: compartilha com esta
        if (String(r.error.message).includes("processos_numero_digits_uidx")) {
          const { data: achado } = await sb.rpc("find_processo_by_digits", { _numero: regs[k].numero });
          const p = Array.isArray(achado) ? achado[0] : achado;
          if (p?.id) {
            if (p.coordenacao_id === coordenacaoId) { compartilhados++; continue; }
            const { data: jaTem } = await sb.from("processos_coordenacoes_responsaveis").select("id")
              .eq("processo_id", p.id).eq("coordenacao_id", coordenacaoId).maybeSingle();
            const ins = jaTem ? { error: null } : await sb.from("processos_coordenacoes_responsaveis")
              .insert({ processo_id: p.id, coordenacao_id: coordenacaoId, principal: false });
            if (!ins.error) { compartilhados++; continue; }
            rejeitados.push({ ...lote[k], erro: `Já existe em outra coordenação e não foi possível compartilhar: ${ins.error.message}` });
            continue;
          }
        }
        rejeitados.push({ ...lote[k], erro: r.error.message });
      }
      marcar(lote.length); await pausa();
    }
    // Existentes: 6 atualizações em paralelo
    for (let i = 0; i < atuaisL.length && !cancelarRef.current; i += 10) {
      const lote = atuaisL.slice(i, i + 10);
      await Promise.all(lote.map(async (l) => {
        try {
          const c = await preparar(l);
          const id = existentes.get(c.numero)!;
          const atual = atuaisRef.current.get(id) || {};
          const vazio = (v: any) => v === null || v === undefined || (typeof v === "string" && v.trim() === "");
          const patch: any = {};
          for (const [k, v] of Object.entries(c)) if (k !== "numero" && !vazio(v) && vazio(atual[k])) patch[k] = v;
          if (Object.keys(patch).length) {
            const { error } = await sb.from("processos").update(patch).eq("id", id);
            if (error) throw error;
          }
          if (l.campos._etiquetas) await etiquetar(id, l.campos._etiquetas);
          if (atual.coordenacao_id && atual.coordenacao_id !== coordenacaoId) {
            if (!jaCompart.has(id)) {
              const { error } = await sb.from("processos_coordenacoes_responsaveis").insert({ processo_id: id, coordenacao_id: coordenacaoId, principal: false });
              if (error && !String(error.message).includes("duplicate")) throw error;
            }
            compartilhados++;
          } else atualizados++;
        } catch (e: any) { rejeitados.push({ ...l, erro: e?.message || String(e) }); }
      }));
      marcar(lote.length); await pausa();
    }
    if (cancelarRef.current) toast.warning(`Envio cancelado: ${criados} criados e ${atualizados} atualizados até aqui`);
    setProgresso(null);
    setResumo({ criados, atualizados, compartilhados, rejeitados });
    setLinhas([]);
    if (!cancelarRef.current) toast.success(`Envio concluído: ${criados} criados, ${atualizados} atualizados, ${compartilhados} compartilhados`);
  };

  const baixarRejeitados = () => {
    if (!resumo) return;
    const ws = XLSX.utils.json_to_sheet(resumo.rejeitados.map((r) => ({ Linha: r.linha, "Número do processo": r.campos.numero, Motivo: r.erro })));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Rejeitados");
    XLSX.writeFile(wb, "processos_rejeitados.xlsx");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Envio em lote de processos</SheetTitle>
          <SheetDescription>{coordenacaoNome} — use a planilha modelo de importação de processos.</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 mt-4">
          <Button variant="outline" size="sm" asChild>
            <a href="/modelos/MODELO_IMPORTACAO_PROCESSO_PADRAO.xlsx" download="MODELO_IMPORTACAO_PROCESSO_PADRAO.xlsx">
              Baixar planilha modelo
            </a>
          </Button>
          <Input type="file" accept=".xlsx,.xls" disabled={progresso !== null || leitura !== null}
            onChange={(e) => e.target.files?.[0] && carregar(e.target.files[0]).catch((er) => toast.error(String(er?.message || er)))} />
          {leitura && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm"><span>{leitura.etapa}</span><b>{leitura.pct}%</b></div>
              <Progress value={leitura.pct} />
            </div>
          )}
          {linhas.length > 0 && (
            <div className="space-y-2 text-sm">
              <p><b>{novos}</b> novos · <b>{validas.length - novos}</b> já existem (completa só os campos vazios e inclui esta coordenação) · <b>{linhas.length - validas.length}</b> com erro</p>
              <div className="max-h-60 overflow-y-auto border rounded p-2 space-y-1">
                {linhas.filter((l) => l.erro).slice(0, 300).map((l) => <div key={l.linha} className="text-destructive">Linha {l.linha}: {l.erro}</div>)}
              </div>
              <Button onClick={enviar} disabled={!validas.length || progresso !== null}>Enviar {validas.length} processos</Button>
            </div>
          )}
          {progresso !== null && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm"><span>Enviando {feitos} de {validas.length}</span><b>{progresso}%</b></div>
              <Progress value={progresso} />
              <Button variant="outline" size="sm" onClick={() => { cancelarRef.current = true; }}>Cancelar envio</Button>
            </div>
          )}
          {resumo && (
            <div className="text-sm space-y-2">
              <p>Criados: <b>{resumo.criados}</b> · Atualizados: <b>{resumo.atualizados}</b> · Já existiam em outra coordenação (compartilhados): <b>{resumo.compartilhados ?? 0}</b> · Rejeitados: <b>{resumo.rejeitados.length}</b></p>
              {resumo.rejeitados.length > 0 && <Button size="sm" variant="outline" onClick={baixarRejeitados}>Baixar rejeitados</Button>}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
