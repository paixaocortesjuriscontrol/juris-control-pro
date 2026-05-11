import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FileUp, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  onImported?: () => void;
}

const RENATA_COORDENACAO_ID = "3e47fc83-3539-4fa7-9fcf-33825120e1b7";

// Linha típica: "0000006-91.2023.5.21.0001  AIRR  05/03/2026 14:42"
const LINE_RE = /(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})\s+\S+\s+(\d{2}\/\d{2}\/\d{4})/g;

function brToIso(br: string): string | null {
  const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const d = Number(m[1]), mo = Number(m[2]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export function CertidaoPdfImport({ onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");

  const reset = () => {
    setRunning(false);
    setProgress(0);
    setStatusText("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRunning(true);
    setStatusText("Lendo PDF...");
    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) {
        toast.error("Você precisa estar autenticado.");
        reset();
        return;
      }

      const buf = await file.arrayBuffer();
      const pdfjsLib: any = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
      let text = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((it: any) => it.str).join(" ") + "\n";
        setProgress(Math.round((i / pdf.numPages) * 20));
      }

      // Extrai pares (numero, data autuação)
      const map = new Map<string, string>(); // processo -> data ISO
      let m: RegExpExecArray | null;
      while ((m = LINE_RE.exec(text)) !== null) {
        const num = m[1];
        const iso = brToIso(m[2]);
        if (!iso) continue;
        if (!map.has(num)) map.set(num, iso);
      }

      if (map.size === 0) {
        toast.warning("Nenhum processo encontrado no PDF.");
        reset();
        return;
      }

      const numeros = [...map.keys()];
      setStatusText(`Encontrados ${numeros.length} processos. Verificando existentes...`);
      setProgress(25);

      // Verifica dados_benner existentes (skip duplicados por processo+tribunal=TST)
      const existentes = new Set<string>();
      const CHK = 200;
      for (let i = 0; i < numeros.length; i += CHK) {
        const slice = numeros.slice(i, i + CHK);
        const { data, error } = await (supabase.from("dados_benner") as any)
          .select("processo")
          .eq("tribunal", "TST")
          .in("processo", slice);
        if (error) throw error;
        (data || []).forEach((r: any) => existentes.add(r.processo));
      }

      const novos = numeros.filter(n => !existentes.has(n));
      setStatusText(`${novos.length} novos · ${existentes.size} já cadastrados`);
      setProgress(40);

      if (novos.length === 0) {
        toast.info("Todos os processos já estão cadastrados.");
        reset();
        onImported?.();
        return;
      }

      // Upsert em processos
      const procsPayload = novos.map(numero => ({
        numero,
        status: "ativo" as const,
        area: "trabalhista",
      }));
      const UP = 200;
      for (let i = 0; i < procsPayload.length; i += UP) {
        const batch = procsPayload.slice(i, i + UP);
        const { error } = await (supabase.from("processos") as any)
          .upsert(batch, { onConflict: "numero", ignoreDuplicates: true });
        if (error) console.error("Erro upsert processos:", error);
        setProgress(40 + Math.round(((i + batch.length) / procsPayload.length) * 30));
      }

      // Insert em dados_benner
      const bennerPayload = novos.map(numero => {
        const data = map.get(numero)!;
        return {
          processo: numero,
          tribunal: "TST",
          aba_origem: "Certidão TST",
          data_distribuicao_planilha: data,
          data_distribuicao_real: data,
          status: "rascunho",
          user_id: user.id,
          coordenacao_id: RENATA_COORDENACAO_ID,
        };
      });

      let inseridos = 0;
      for (let i = 0; i < bennerPayload.length; i += UP) {
        const batch = bennerPayload.slice(i, i + UP);
        const { error } = await (supabase.from("dados_benner") as any).insert(batch);
        if (error) {
          console.error("Erro insert dados_benner:", error);
        } else {
          inseridos += batch.length;
        }
        setProgress(70 + Math.round(((i + batch.length) / bennerPayload.length) * 30));
        setStatusText(`Cadastrando ${inseridos}/${novos.length}...`);
      }

      toast.success(`${inseridos} processos cadastrados a partir da certidão. ${existentes.size} já existiam.`);
      onImported?.();
    } catch (err: any) {
      console.error("Erro ao importar certidão PDF:", err);
      toast.error("Erro ao processar PDF: " + (err?.message || String(err)));
    } finally {
      reset();
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={handleFile}
      />
      <Button
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={running}
        title="Lê uma Certidão de Distribuição em PDF (TST) e cadastra os processos com a data de autuação."
      >
        {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileUp className="w-4 h-4 mr-2" />}
        {running ? (statusText || "Processando...") : "Importar PDF Certidão Distribuição"}
      </Button>
      {running && progress > 0 && (
        <div className="w-40 self-center">
          <Progress value={progress} className="h-1.5" />
        </div>
      )}
    </>
  );
}
