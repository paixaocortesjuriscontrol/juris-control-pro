import { useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { lerLinhasLote, semAcento, type LinhaLote } from "@/lib/loteProcessosSantander";
import { garantirRito } from "@/components/processos/RitoProcessualSelect";

const sb = supabase as any;
const pausa = () => new Promise((r) => requestAnimationFrame(() => r(null)));

export function EnvioLoteProcessosSheet({ open, onOpenChange, coordenacaoId, coordenacaoNome }: {
  open: boolean; onOpenChange: (v: boolean) => void; coordenacaoId: string; coordenacaoNome: string;
}) {
  const [linhas, setLinhas] = useState<LinhaLote[]>([]);
  const [existentes, setExistentes] = useState<Map<string, string>>(new Map());
  const [progresso, setProgresso] = useState<number | null>(null);
  const [resumo, setResumo] = useState<{ criados: number; atualizados: number; rejeitados: LinhaLote[] } | null>(null);

  const carregar = async (f: File) => {
    setResumo(null);
    const wb = XLSX.read(await f.arrayBuffer());
    const dados = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: null });
    const lidas = lerLinhasLote(dados, coordenacaoNome);
    const [{ data: perfis }, { data: membros }] = await Promise.all([
      sb.from("profiles").select("id,nome"),
      sb.from("membros_coordenacao").select("user_id").eq("coordenacao_id", coordenacaoId),
    ]);
    const idsMembros = new Set((membros || []).map((m: any) => m.user_id));
    const porNome = new Map<string, string>();
    (perfis || []).forEach((p: any) => p.nome && (!porNome.has(semAcento(p.nome)) || idsMembros.has(p.id)) && porNome.set(semAcento(p.nome), p.id));
    lidas.forEach((l) => {
      const r = l.campos._responsavel;
      if (!l.erro && r) {
        const id = porNome.get(semAcento(r));
        if (id) l.campos.advogado_responsavel_id = id; else l.erro = `Responsável não encontrado (${r})`;
      }
    });
    const nums = [...new Set(lidas.filter((l) => !l.erro).map((l) => l.campos.numero as string))];
    const mapa = new Map<string, string>();
    for (let i = 0; i < nums.length; i += 150) {
      const { data } = await sb.from("processos").select("id,numero").eq("coordenacao_id", coordenacaoId).in("numero", nums.slice(i, i + 150));
      (data || []).forEach((p: any) => mapa.set(p.numero, p.id));
    }
    setExistentes(mapa);
    setLinhas(lidas);
  };

  const validas = linhas.filter((l) => !l.erro);
  const novos = validas.filter((l) => !existentes.has(l.campos.numero)).length;

  const enviar = async () => {
    setProgresso(0);
    const rejeitados = linhas.filter((l) => l.erro);
    let criados = 0, atualizados = 0;
    const { data: ritosDb } = await sb.from("ritos_processuais").select("nome");
    const ritos: string[] = (ritosDb || []).map((r: any) => r.nome);
    const { data: clientes } = await sb.from("clientes").select("id,nome");
    const cli = new Map<string, string>((clientes || []).map((c: any) => [semAcento(c.nome), c.id]));
    for (let i = 0; i < validas.length; i++) {
      const l = validas[i];
      const { _responsavel, _situacao, _coordenacao, _cliente, ...c } = l.campos;
      try {
        if (c.rito_processual) { c.rito_processual = await garantirRito(c.rito_processual, ritos); if (!ritos.includes(c.rito_processual)) ritos.push(c.rito_processual); }
        if (_cliente && cli.has(semAcento(_cliente))) c.cliente_id = cli.get(semAcento(_cliente));
        const id = existentes.get(c.numero);
        const { error } = id
          ? await sb.from("processos").update(c).eq("id", id)
          : await sb.from("processos").insert({ ...c, coordenacao_id: coordenacaoId, status: "ativo" });
        if (error) throw error;
        id ? atualizados++ : criados++;
      } catch (e: any) { rejeitados.push({ ...l, erro: e?.message || String(e) }); }
      if (i % 20 === 0) { setProgresso(Math.round(((i + 1) / validas.length) * 100)); await pausa(); }
    }
    setProgresso(null);
    setResumo({ criados, atualizados, rejeitados });
    setLinhas([]);
    toast.success(`Envio concluído: ${criados} criados, ${atualizados} atualizados`);
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
          <Input type="file" accept=".xlsx,.xls" disabled={progresso !== null}
            onChange={(e) => e.target.files?.[0] && carregar(e.target.files[0]).catch((er) => toast.error(String(er?.message || er)))} />
          {linhas.length > 0 && (
            <div className="space-y-2 text-sm">
              <p><b>{novos}</b> novos · <b>{validas.length - novos}</b> já existem (atualiza só os campos preenchidos) · <b>{linhas.length - validas.length}</b> com erro</p>
              <div className="max-h-60 overflow-y-auto border rounded p-2 space-y-1">
                {linhas.filter((l) => l.erro).map((l) => <div key={l.linha} className="text-destructive">Linha {l.linha}: {l.erro}</div>)}
              </div>
              <Button onClick={enviar} disabled={!validas.length || progresso !== null}>Enviar {validas.length} processos</Button>
            </div>
          )}
          {progresso !== null && <Progress value={progresso} />}
          {resumo && (
            <div className="text-sm space-y-2">
              <p>Criados: <b>{resumo.criados}</b> · Atualizados: <b>{resumo.atualizados}</b> · Rejeitados: <b>{resumo.rejeitados.length}</b></p>
              {resumo.rejeitados.length > 0 && <Button size="sm" variant="outline" onClick={baixarRejeitados}>Baixar rejeitados</Button>}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
