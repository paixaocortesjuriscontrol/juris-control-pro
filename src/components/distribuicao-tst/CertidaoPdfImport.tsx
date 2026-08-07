import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FileUp, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { iniciarAuditoriaLote, finalizarAuditoriaLote } from "@/lib/auditoriaLoteAdminTst";

interface Props {
  onImported?: () => void;
}

const RENATA_COORDENACAO_ID = "3e47fc83-3539-4fa7-9fcf-33825120e1b7";

// Linha típica: "0000006-91.2023.5.21.0001  AIRR  05/03/2026 14:42"
// Alguns PDFs (ex: Aymoré) saem com espaços entre dígitos: "0000092 - 91 . 2024 . 5 . 09 . 0088"
// e classe quebrada ("A I RR"); por isso normalizamos e usamos regex tolerante.
const LINE_RE = /(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})[^\d]*?(\d{2}\/\d{2}\/\d{4})/g;

function normalizeNumberSpacing(raw: string): string {
  // Remove espaços entre caracteres de número/pontuação (ex: "0000092 - 91 . 2024" -> "0000092-91.2024")
  let prev = raw;
  for (let i = 0; i < 4; i++) {
    const next = prev.replace(/([\d.\-/:])\s+(?=[\d.\-/:])/g, "$1");
    if (next === prev) break;
    prev = next;
  }
  return prev;
}

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
    const auditId = await iniciarAuditoriaLote({
      tipo: "importar_certidao_pdf",
      arquivoNome: file.name,
      coordenacaoId: RENATA_COORDENACAO_ID,
    });
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

      // Normaliza espaçamento dentro de números/datas para suportar PDFs como o da Aymoré
      text = normalizeNumberSpacing(text);

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
        await finalizarAuditoriaLote(auditId, {
          status: "concluida",
          resumo: "Nenhum processo encontrado no PDF.",
        });
        reset();
        return;
      }

      const numeros = [...map.keys()];
      setStatusText(`Encontrados ${numeros.length} processos. Verificando existentes...`);
      setProgress(25);

      // Verifica dados_benner existentes (serão atualizados com a data da certidão)
      const existentes = new Set<string>();
      const existentesRows: { id: string; processo: string; observacao_advogado: string | null }[] = [];
      const CHK = 200;
      for (let i = 0; i < numeros.length; i += CHK) {
        const slice = numeros.slice(i, i + CHK);
        const { data, error } = await (supabase.from("dados_benner") as any)
          .select("id, processo, observacao_advogado")
          .eq("tribunal", "TST")
          .in("processo", slice);
        if (error) throw error;
        (data || []).forEach((r: any) => {
          existentes.add(r.processo);
          existentesRows.push({ id: r.id, processo: r.processo, observacao_advogado: r.observacao_advogado ?? null });
        });
      }

      const novos = numeros.filter(n => !existentes.has(n));
      setStatusText(`${novos.length} novos · ${existentes.size} para atualizar`);
      setProgress(40);

      // Atualiza processos já existentes: data de distribuição + comentário no card
      const hoje = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
      let atualizados = 0;
      if (existentesRows.length > 0) {
        setStatusText(`Atualizando ${existentesRows.length} processos existentes...`);
        for (let i = 0; i < existentesRows.length; i++) {
          const row = existentesRows[i];
          const iso = map.get(row.processo);
          if (!iso) continue;
          const dataBr = iso.split("-").reverse().join("/");
          const comentario = `Data de distribuição atualizada pela Certidão de Distribuição TST (${dataBr}) em ${hoje}.`;
          const anterior = (row.observacao_advogado || "").trim();
          const novaObs = anterior ? `${anterior}\n${comentario}` : comentario;
          const { error } = await (supabase.from("dados_benner") as any)
            .update({
              data_distribuicao_planilha: iso,
              data_distribuicao_real: iso,
              observacao_advogado: novaObs,
            })
            .eq("id", row.id);
          if (error) console.error("Erro update dados_benner:", row.processo, error);
          else atualizados++;
          if (i % 20 === 0) {
            setProgress(40 + Math.round(((i + 1) / existentesRows.length) * 15));
            setStatusText(`Atualizando existentes ${atualizados}/${existentesRows.length}...`);
          }
        }
      }

      if (novos.length === 0) {
        toast.success(`${atualizados} processos existentes atualizados com a data da certidão.`);
        await finalizarAuditoriaLote(auditId, {
          status: "concluida",
          totalLinhas: numeros.length,
          atualizados,
          resumo: `${atualizados} processos existentes atualizados (data de distribuição).`,
          itens: numeros.map((p) => ({
            processo: p,
            acao: "atualizado",
            detalhe: `Data de distribuição: ${map.get(p) || "—"}`,
          })),
        });
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
        setProgress(55 + Math.round(((i + batch.length) / procsPayload.length) * 15));
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
          fontes_importacao: ["Certidão TST"],
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

      toast.success(`${inseridos} processos cadastrados · ${atualizados} atualizados a partir da certidão.`);
      await finalizarAuditoriaLote(auditId, {
        status: "concluida",
        totalLinhas: numeros.length,
        criados: inseridos,
        atualizados,
        resumo: `${inseridos} processos cadastrados · ${atualizados} atualizados`,
        itens: [
          ...novos.map((p) => ({
            processo: p,
            acao: "criado",
            detalhe: `Data de distribuição: ${map.get(p) || "—"}`,
          })),
          ...[...existentes].map((p) => ({
            processo: p,
            acao: "atualizado",
            detalhe: `Data de distribuição: ${map.get(p) || "—"}`,
          })),
        ],
      });
      onImported?.();
    } catch (err: any) {
      console.error("Erro ao importar certidão PDF:", err);
      toast.error("Erro ao processar PDF: " + (err?.message || String(err)));
      await finalizarAuditoriaLote(auditId, { status: "erro", erro: err?.message || String(err) });
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
