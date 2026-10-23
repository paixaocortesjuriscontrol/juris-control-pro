import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Upload, CheckCircle2, XCircle, Loader2, FileText, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

type Status = {
  nome: string;
  estado: "fila" | "lendo" | "ok" | "dup" | "erro";
  msg?: string;
  tipo?: string;
  area?: string;
  materia?: string | null;
  tags?: string[];
};

const ROTULO_TIPO: Record<string, string> = {
  contestacao: "Contestação", recurso_ordinario: "Recurso Ordinário", contrarrazoes: "Contrarrazões",
  peticao_inicial: "Petição Inicial", memoriais: "Memoriais", outros: "Outros",
};
const ROTULO_AREA: Record<string, string> = {
  trabalhista: "Trabalhista", civil: "Civil", empresarial: "Empresarial", direito_privado: "Direito Privado",
};
const ACEITOS = [".docx", ".pdf", ".txt"];

async function extrairTexto(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const nome = file.name.toLowerCase();
  if (nome.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ arrayBuffer: buf });
    return value;
  }
  if (nome.endsWith(".pdf")) {
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const partes: string[] = [];
    for (let i = 1; i <= Math.min(pdf.numPages, 80); i++) {
      const pg = await pdf.getPage(i);
      const c = await pg.getTextContent();
      partes.push(c.items.map((it: any) => it.str).join(" "));
    }
    return partes.join("\n");
  }
  if (nome.endsWith(".txt")) return new TextDecoder().decode(buf);
  throw new Error("Formato não suportado (use .docx, .pdf ou .txt)");
}

export function ImportarPecasTeses({ coords, coordPadrao }: { coords: any[]; coordPadrao?: string }) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [aberto, setAberto] = useState(false);
  const [coordId, setCoordId] = useState<string>(coordPadrao || coords[0]?.id || "");
  const [area, setArea] = useState("auto");
  const [itens, setItens] = useState<Status[]>([]);
  const [rodando, setRodando] = useState(false);
  const [arrastando, setArrastando] = useState(false);

  async function processar(entrada: File[]) {
    const files = entrada.filter((f) => ACEITOS.some((ext) => f.name.toLowerCase().endsWith(ext)));
    if (!files.length) return;
    setRodando(true);
    const lista: Status[] = files.map((f) => ({ nome: f.name, estado: "fila" }));
    setItens([...lista]);
    let proximo = 0;
    const worker = async () => {
      while (proximo < files.length) {
        const i = proximo++;
        lista[i] = { ...lista[i], estado: "lendo" };
        setItens([...lista]);
        try {
          const texto = await extrairTexto(files[i]);
          const { data, error } = await supabase.functions.invoke("importar-tese-peca", {
            body: { texto, nomeArquivo: files[i].name, area, coordenacaoId: coordId || null },
          });
          if (error || data?.error) throw new Error(data?.error || error?.message);
          const t = data.tese || {};
          lista[i] = {
            ...lista[i], estado: data.duplicada ? "dup" : "ok",
            msg: data.duplicada ? `Já estava no banco: ${t.titulo}` : t.titulo,
            tipo: t.tipo_peca, area: t.area, materia: t.materia, tags: t.tags,
          };
        } catch (e: any) {
          lista[i] = { ...lista[i], estado: "erro", msg: e?.message || "Falhou" };
        }
        setItens([...lista]);
      }
    };
    await Promise.all([worker(), worker()]);
    await qc.invalidateQueries({ queryKey: ["teses-juridicas"] });
    setRodando(false);
  }

  const feitos = itens.filter((i) => ["ok", "dup", "erro"].includes(i.estado)).length;
  const ok = itens.filter((i) => i.estado === "ok").length;
  const dup = itens.filter((i) => i.estado === "dup").length;
  const erro = itens.filter((i) => i.estado === "erro").length;

  return (
    <>
      <Button variant="outline" onClick={() => setAberto(true)} disabled={!coords.length}>
        <Upload className="h-4 w-4 mr-1" /> Importar peças em lote
      </Button>
      <Sheet open={aberto} onOpenChange={(v) => !rodando && setAberto(v)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Importar peças em lote</SheetTitle>
            <SheetDescription>
              Arraste vários arquivos Word (.docx), PDF com texto ou .txt. A IA identifica a tese, o tipo de peça, a área,
              a matéria e as palavras-chave, e guarda tudo organizado, sem dados pessoais. Cada tese entra direto como
              <b>ativa</b>, pronta para o gerador usar. Arquivos já importados não são repetidos.
            </SheetDescription>
          </SheetHeader>

          <div className="grid grid-cols-2 gap-2 mt-4">
            <Select value={coordId} onValueChange={setCoordId} disabled={rodando}>
              <SelectTrigger><SelectValue placeholder="Coordenação" /></SelectTrigger>
              <SelectContent>{coords.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={area} onValueChange={setArea} disabled={rodando}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Área: a IA identifica</SelectItem>
                {Object.entries(ROTULO_AREA).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div
            role="button"
            tabIndex={0}
            onClick={() => !rodando && inputRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && !rodando && inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); if (!rodando) setArrastando(true); }}
            onDragLeave={() => setArrastando(false)}
            onDrop={(e) => {
              e.preventDefault(); setArrastando(false);
              if (!rodando) processar(Array.from(e.dataTransfer.files || []));
            }}
            className={`mt-4 rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${
              arrastando ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
            } ${rodando ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
            <div className="mt-2 font-medium">Arraste os arquivos aqui ou clique para escolher</div>
            <div className="text-xs text-muted-foreground">Vários arquivos de uma vez · .docx, .pdf, .txt</div>
            <input
              ref={inputRef} type="file" multiple accept={ACEITOS.join(",")} className="hidden"
              onChange={(e) => { processar(Array.from(e.target.files || [])); e.target.value = ""; }}
            />
          </div>

          {itens.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>{feitos} de {itens.length} arquivos</span>
                <span className="text-muted-foreground">{ok} novas · {dup} já existiam · {erro} com erro</span>
              </div>
              <Progress value={(feitos / itens.length) * 100} />
            </div>
          )}

          <div className="mt-4 space-y-2 text-sm">
            {itens.map((it, i) => (
              <div key={i} className="flex items-start gap-2 rounded-md border p-2">
                {it.estado === "ok" ? <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  : it.estado === "dup" ? <Copy className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  : it.estado === "erro" ? <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  : it.estado === "lendo" ? <Loader2 className="h-4 w-4 mt-0.5 animate-spin shrink-0" />
                  : <FileText className="h-4 w-4 mt-0.5 opacity-40 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-muted-foreground break-all">{it.nome}</div>
                  {it.msg && <div className={it.estado === "erro" ? "text-destructive text-xs" : "font-medium"}>{it.msg}</div>}
                  {it.estado === "lendo" && <div className="text-xs text-muted-foreground">Lendo e classificando…</div>}
                  {(it.tipo || it.area || it.materia) && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {it.tipo && <Badge variant="secondary">{ROTULO_TIPO[it.tipo] ?? it.tipo}</Badge>}
                      {it.area && <Badge variant="outline">{ROTULO_AREA[it.area] ?? it.area}</Badge>}
                      {it.materia && <Badge variant="outline">{it.materia}</Badge>}
                      {(it.tags ?? []).slice(0, 5).map((t) => <Badge key={t} variant="outline" className="font-normal">{t}</Badge>)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
