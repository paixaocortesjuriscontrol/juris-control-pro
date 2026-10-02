import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Search, FileSpreadsheet, FileArchive } from "lucide-react";
import { CAMPOS, mapearAutomatico, norm, digitos, type Planilha } from "@/lib/migracaoProjuris";

type Tipo = "tarefas" | "processos" | "andamentos" | "partes" | "apoio";
const ROTULO: Record<Tipo, { nome: string; acao: string; variant: "default" | "secondary" | "outline" }> = {
  tarefas: { nome: "Tarefas / prazos", acao: "Importar como tarefas (marcar)", variant: "default" },
  processos: { nome: "Cadastro de processos", acao: "Apoio: os processos são criados a partir das tarefas pelo CNJ", variant: "secondary" },
  andamentos: { nome: "Andamentos / histórico", acao: "Não importado nesta tela (apenas consulta)", variant: "outline" },
  partes: { nome: "Partes / pessoas", acao: "Não importado nesta tela (apenas consulta)", variant: "outline" },
  apoio: { nome: "Apoio / outros", acao: "Ignorado", variant: "outline" },
};

function classificar(headers: string[]): Tipo {
  const h = headers.map(norm).join(" | ");
  const m = mapearAutomatico(headers);
  if (m.id_externo && m.titulo && (m.data_vencimento || m.data_fatal) && /tarefa|prazo|vencimento|data prevista/.test(h)) return "tarefas";
  if (/andamento|movimenta/.test(h)) return "andamentos";
  if (/cpf|cnpj|parte|cliente|adverso/.test(h) && !/tarefa/.test(h)) return /cnj|numero do processo/.test(h) ? "processos" : "partes";
  if (/cnj|numero do processo|pasta|vara|comarca/.test(h)) return "processos";
  return "apoio";
}

interface Props {
  planilhas: Planilha[];
  zips: { file: File; entries: { filename: string; directory?: boolean }[] }[];
  selecionadas: Set<string>;
  chave: (p: Planilha) => string;
  marcar: (chaves: string[], valor: boolean) => void;
}

export function DiagnosticoProjuris({ planilhas, zips, selecionadas, chave, marcar }: Props) {
  const [aberto, setAberto] = useState<string | null>(null);

  const grupos = useMemo(() => {
    const g = new Map<string, { assinatura: string; tipo: Tipo; headers: string[]; abas: Planilha[]; linhas: number; cnjs: Set<string> }>();
    for (const p of planilhas) {
      const ass = p.headers.map(norm).sort().join("|");
      let x = g.get(ass);
      if (!x) { x = { assinatura: ass, tipo: classificar(p.headers), headers: p.headers, abas: [], linhas: 0, cnjs: new Set() }; g.set(ass, x); }
      x.abas.push(p); x.linhas += p.linhas.length;
      const col = mapearAutomatico(p.headers).processo;
      if (col) for (const l of p.linhas.slice(0, 5000)) { const d = digitos(l[col]); if (d.length === 20) x.cnjs.add(d); }
    }
    const ordem: Tipo[] = ["tarefas", "processos", "andamentos", "partes", "apoio"];
    return Array.from(g.values()).sort((a, b) => ordem.indexOf(a.tipo) - ordem.indexOf(b.tipo) || b.linhas - a.linhas);
  }, [planilhas]);

  const anexosZip = useMemo(() => zips.map((z) => {
    const arqs = z.entries.filter((e) => !e.directory);
    const ext = new Map<string, number>();
    let comCnj = 0;
    for (const e of arqs) {
      const x = (e.filename.split(".").pop() || "sem extensão").toLowerCase();
      ext.set(x, (ext.get(x) || 0) + 1);
      if (/\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}/.test(e.filename)) comCnj++;
    }
    return { nome: z.file.name, total: arqs.length, ext: Array.from(ext.entries()).sort((a, b) => b[1] - a[1]), comCnj };
  }), [zips]);

  if (!planilhas.length && !zips.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Search className="h-4 w-4 text-primary" /> Diagnóstico dos arquivos do Projuris</CardTitle>
        <CardDescription>
          Nada é gravado aqui. As planilhas com as mesmas colunas foram agrupadas como um mesmo tipo de arquivo, e para cada tipo aparece o que será feito com ele.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {grupos.map((g, i) => {
          const r = ROTULO[g.tipo];
          const chaves = g.abas.map(chave);
          const marcadas = chaves.filter((c) => selecionadas.has(c)).length;
          const mapa = mapearAutomatico(g.headers);
          const id = "g" + i;
          return (
            <div key={id} className="rounded-md border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">Tipo {i + 1}: {r.nome}</span>
                <Badge variant={r.variant}>{g.abas.length} arquivo(s) · {g.linhas.toLocaleString("pt-BR")} linhas</Badge>
                {g.cnjs.size > 0 && <Badge variant="outline">{g.cnjs.size.toLocaleString("pt-BR")} processos distintos</Badge>}
                <span className="ml-auto text-xs text-muted-foreground">{marcadas}/{chaves.length} marcadas</span>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => marcar(chaves, true)}>Marcar como tarefas</Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => marcar(chaves, false)}>Desmarcar</Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAberto(aberto === id ? null : id)}>{aberto === id ? "ocultar" : "detalhes"}</Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Sugestão: {r.acao}</p>
              {aberto === id && (
                <div className="mt-2 space-y-2 text-xs">
                  <div>
                    <span className="font-semibold">Campos reconhecidos: </span>
                    {CAMPOS.map((c) => (
                      <Badge key={c.campo} variant={mapa[c.campo] ? "secondary" : "outline"} className="mr-1 mb-1">
                        {c.label}{mapa[c.campo] ? ` ← ${mapa[c.campo]}` : c.obrigatorio ? " (falta)" : ""}
                      </Badge>
                    ))}
                  </div>
                  <div><span className="font-semibold">Todas as colunas: </span>{g.headers.join(" · ")}</div>
                  <div className="max-h-28 overflow-auto"><span className="font-semibold">Arquivos: </span>{g.abas.map((p) => `${p.arquivo} (${p.aba})`).join(" · ")}</div>
                  <div className="overflow-auto">
                    <span className="font-semibold">Exemplo de linhas:</span>
                    <table className="mt-1 w-full border text-[11px]">
                      <thead><tr>{g.headers.slice(0, 8).map((h) => <th key={h} className="border px-1 text-left">{h}</th>)}</tr></thead>
                      <tbody>{g.abas[0].linhas.slice(0, 3).map((l, k) => (
                        <tr key={k}>{g.headers.slice(0, 8).map((h) => <td key={h} className="border px-1 max-w-[180px] truncate">{String(l[h] ?? "")}</td>)}</tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {anexosZip.filter((z) => z.total > 0).map((z) => (
          <div key={z.nome} className="rounded-md border p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <FileArchive className="h-4 w-4 text-primary" />
              <span className="font-semibold">Anexos: {z.nome}</span>
              <Badge variant="secondary">{z.total.toLocaleString("pt-BR")} arquivos</Badge>
              <Badge variant="outline">{z.comCnj.toLocaleString("pt-BR")} com número do processo no nome</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Tipos: {z.ext.slice(0, 8).map(([e, n]) => `${e} (${n})`).join(" · ")}. Serão ligados à tarefa pelo identificador ou ao processo pelo número; os demais ficam "sem vínculo" no relatório.
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
