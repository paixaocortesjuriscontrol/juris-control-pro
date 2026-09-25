import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Upload, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

type Status = { nome: string; estado: "fila" | "lendo" | "ok" | "erro"; msg?: string };

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
  const [aberto, setAberto] = useState(false);
  const [coordId, setCoordId] = useState<string>(coordPadrao || coords[0]?.id || "");
  const [area, setArea] = useState("trabalhista");
  const [itens, setItens] = useState<Status[]>([]);
  const [rodando, setRodando] = useState(false);

  async function processar(files: File[]) {
    setRodando(true);
    const lista: Status[] = files.map((f) => ({ nome: f.name, estado: "fila" }));
    setItens([...lista]);
    for (let i = 0; i < files.length; i++) {
      lista[i] = { ...lista[i], estado: "lendo" };
      setItens([...lista]);
      try {
        const texto = await extrairTexto(files[i]);
        const { data, error } = await supabase.functions.invoke("importar-tese-peca", {
          body: { texto, nomeArquivo: files[i].name, area, coordenacaoId: coordId || null },
        });
        if (error || data?.error) throw new Error(data?.error || error?.message);
        lista[i] = { ...lista[i], estado: "ok", msg: data.tese?.titulo };
      } catch (e: any) {
        lista[i] = { ...lista[i], estado: "erro", msg: e?.message || "Falhou" };
      }
      setItens([...lista]);
      await new Promise((r) => setTimeout(r, 800));
    }
    await qc.invalidateQueries({ queryKey: ["teses-juridicas"] });
    await qc.invalidateQueries();
    setRodando(false);
  }

  return (
    <>
      <Button variant="outline" onClick={() => setAberto(true)} disabled={!coords.length}>
        <Upload className="h-4 w-4 mr-1" /> Importar peças
      </Button>
      <Dialog open={aberto} onOpenChange={(v) => !rodando && setAberto(v)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Importar peças do escritório</DialogTitle>
            <DialogDescription>
              Envie peças em Word (.docx) ou PDF com texto. A IA extrai a tese, os fundamentos e guarda a peça como modelo,
              sem dados pessoais. Cada uma entra como <b>inativa</b>: confira e ative antes de usar.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            <Select value={coordId} onValueChange={setCoordId}>
              <SelectTrigger><SelectValue placeholder="Coordenação" /></SelectTrigger>
              <SelectContent>{coords.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={area} onValueChange={setArea}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="trabalhista">Trabalhista</SelectItem>
                <SelectItem value="civil">Civil</SelectItem>
                <SelectItem value="empresarial">Empresarial</SelectItem>
                <SelectItem value="direito_privado">Direito Privado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Input
            type="file"
            multiple
            accept=".docx,.pdf,.txt"
            disabled={rodando}
            onChange={(e) => { const f = Array.from(e.target.files || []); if (f.length) processar(f); e.target.value = ""; }}
          />
          <div className="max-h-72 overflow-auto space-y-1 text-sm">
            {itens.map((it, i) => (
              <div key={i} className="flex items-start gap-2">
                {it.estado === "ok" ? <CheckCircle2 className="h-4 w-4 text-primary mt-0.5" />
                  : it.estado === "erro" ? <XCircle className="h-4 w-4 text-destructive mt-0.5" />
                  : <Loader2 className={`h-4 w-4 mt-0.5 ${it.estado === "lendo" ? "animate-spin" : "opacity-40"}`} />}
                <div>
                  <div>{it.nome}</div>
                  {it.msg && <div className="text-xs text-muted-foreground">{it.msg}</div>}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
