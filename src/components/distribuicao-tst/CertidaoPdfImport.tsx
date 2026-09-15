import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FileUp, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { iniciarAuditoriaLote, finalizarAuditoriaLote } from "@/lib/auditoriaLoteAdminTst";

interface Props {
  onImported?: () => void;
}

const RENATA_COORDENACAO_ID = "3e47fc83-3539-4fa7-9fcf-33825120e1b7";

// Números CNJ: "0000006-91.2023.5.21.0001". A data de autuação vem depois, às vezes
// separada por classe do recurso (que pode conter dígitos), por isso buscamos a
// primeira data numa janela de texto após o número.
const NUM_RE = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/g;
const DATE_RE = /\d{2}\/\d{2}\/\d{4}/;
const JANELA_DATA = 240;

function normalizeNumberSpacing(raw: string): string {
  let prev = raw;
  for (let i = 0; i < 4; i++) {
    const next = prev.replace(/([\d.\-/:])\s+(?=[\d.\-/:])/g, "$1");
    if (next === prev) break;
    prev = next;
  }
  return prev;
}

function onlyDigits(v: string): string {
  return String(v ?? "").replace(/\D/g, "");
}

function brToIso(br: string): string | null {
  const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const d = Number(m[1]), mo = Number(m[2]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

type Rejeitado = { processo: string; data?: string | null; motivo: string };
type Duplicado = { processo: string; data?: string | null; motivo: string };

function baixarRelatorio(arquivo: string, rejeitados: Rejeitado[], duplicados: Duplicado[]) {
  const wb = XLSX.utils.book_new();

  const resumo = [
    { Informação: "Arquivo", Valor: arquivo },
    { Informação: "Gerado em", Valor: new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) },
    { Informação: "Rejeitados", Valor: rejeitados.length },
    { Informação: "Duplicados", Valor: duplicados.length },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumo), "Resumo");

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      rejeitados.length
        ? rejeitados.map(r => ({ Processo: r.processo, "Data Distribuição": r.data || "—", Motivo: r.motivo }))
        : [{ Processo: "—", "Data Distribuição": "—", Motivo: "Nenhum rejeitado" }]
    ),
    "Rejeitados"
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      duplicados.length
        ? duplicados.map(r => ({ Processo: r.processo, "Data Distribuição": r.data || "—", Motivo: r.motivo }))
        : [{ Processo: "—", "Data Distribuição": "—", Motivo: "Nenhum duplicado" }]
    ),
    "Duplicados"
  );

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  XLSX.writeFile(wb, `Certidao_TST_Rejeitados_Duplicados_${stamp}.xlsx`);
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

    const rejeitados: Rejeitado[] = [];
    const duplicados: Duplicado[] = [];

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

      text = normalizeNumberSpacing(text);

      // Extrai números e, para cada um, a primeira data logo após
      const map = new Map<string, string>(); // digits -> data ISO
      const formatado = new Map<string, string>(); // digits -> número formatado
      const vistos = new Map<string, number>(); // digits -> ocorrências no arquivo
      let m: RegExpExecArray | null;
      NUM_RE.lastIndex = 0;
      while ((m = NUM_RE.exec(text)) !== null) {
        const num = m[0];
        const digits = onlyDigits(num);
        const janela = text.slice(m.index + num.length, m.index + num.length + JANELA_DATA);
        const dm = janela.match(DATE_RE);
        const iso = dm ? brToIso(dm[0]) : null;

        vistos.set(digits, (vistos.get(digits) || 0) + 1);

        if (map.has(digits)) {
          duplicados.push({ processo: num, data: iso, motivo: "Repetido dentro do próprio PDF" });
          continue;
        }
        if (!iso) {
          rejeitados.push({ processo: num, data: null, motivo: "Data de autuação não localizada ao lado do número" });
          continue;
        }
        map.set(digits, iso);
        formatado.set(digits, num);
      }

      if (map.size === 0) {
        if (rejeitados.length || duplicados.length) baixarRelatorio(file.name, rejeitados, duplicados);
        toast.warning("Nenhum processo válido encontrado no PDF.");
        await finalizarAuditoriaLote(auditId, {
          status: "concluida",
          resumo: "Nenhum processo válido encontrado no PDF.",
        });
        reset();
        return;
      }

      const digitsList = [...map.keys()];
      setStatusText(`Encontrados ${digitsList.length} processos. Verificando existentes...`);
      setProgress(25);

      // Verifica dados_benner existentes por número formatado E por dígitos (evita duplicar
      // quando a base guarda o número em outro formato ou noutro tribunal)
      const existentesPorDigits = new Map<string, { id: string; processo: string }>();
      const CHK = 150;
      for (let i = 0; i < digitsList.length; i += CHK) {
        const slice = digitsList.slice(i, i + CHK);
        const variantes = [...slice, ...slice.map(d => formatado.get(d)!).filter(Boolean)];
        const { data, error } = await (supabase.from("dados_benner") as any)
          .select("id, processo")
          .in("processo", variantes);
        if (error) throw error;
        (data || []).forEach((r: any) => {
          const d = onlyDigits(r.processo);
          if (!existentesPorDigits.has(d)) existentesPorDigits.set(d, { id: r.id, processo: r.processo });
        });
        setStatusText(`Verificando existentes ${Math.min(i + CHK, digitsList.length)}/${digitsList.length}...`);
      }

      const novos = digitsList.filter(d => !existentesPorDigits.has(d));
      const jaExistentes = digitsList.filter(d => existentesPorDigits.has(d));
      jaExistentes.forEach(d => {
        duplicados.push({
          processo: formatado.get(d) || d,
          data: map.get(d),
          motivo: "Já existe na base — nenhum dado foi alterado",
        });
      });

      setStatusText(`${novos.length} novos · ${jaExistentes.length} já existentes (não alterados)`);
      setProgress(55);

      let inseridos = 0;

      if (novos.length > 0) {
        // Upsert em processos
        const procsPayload = novos.map(d => ({
          numero: formatado.get(d)!,
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

        // Insert em dados_benner (lote com fallback linha a linha para não perder registros)
        const buildRow = (d: string) => ({
          processo: formatado.get(d)!,
          tribunal: "TST",
          aba_origem: "Certidão TST",
          data_distribuicao_planilha: map.get(d)!,
          data_distribuicao_real: map.get(d)!,
          status: "rascunho",
          user_id: user.id,
          coordenacao_id: RENATA_COORDENACAO_ID,
          fontes_importacao: ["Certidão TST"],
        });

        for (let i = 0; i < novos.length; i += UP) {
          const slice = novos.slice(i, i + UP);
          const batch = slice.map(buildRow);
          const { error } = await (supabase.from("dados_benner") as any).insert(batch);
          if (error) {
            // Reprocessa individualmente para identificar exatamente quem falhou
            for (const d of slice) {
              const { error: e1 } = await (supabase.from("dados_benner") as any).insert([buildRow(d)]);
              if (e1) {
                rejeitados.push({
                  processo: formatado.get(d)!,
                  data: map.get(d),
                  motivo: `Falha ao cadastrar: ${e1.message}`,
                });
              } else {
                inseridos++;
              }
            }
          } else {
            inseridos += slice.length;
          }
          setProgress(70 + Math.round(((i + slice.length) / novos.length) * 30));
          setStatusText(`Cadastrando ${inseridos}/${novos.length}...`);
        }
      }

      if (rejeitados.length || duplicados.length) {
        baixarRelatorio(file.name, rejeitados, duplicados);
      }

      const partes = [`${inseridos} cadastrado(s)`];
      if (duplicados.length) partes.push(`${duplicados.length} duplicado(s)`);
      if (rejeitados.length) partes.push(`${rejeitados.length} rejeitado(s)`);
      const msg = partes.join(" · ");
      if (rejeitados.length) toast.warning(`${msg}. Relatório em Excel baixado.`);
      else toast.success(duplicados.length ? `${msg}. Relatório em Excel baixado.` : msg);

      await finalizarAuditoriaLote(auditId, {
        status: "concluida",
        totalLinhas: digitsList.length + rejeitados.length,
        criados: inseridos,
        atualizados: 0,
        resumo: msg,
        itens: [
          ...novos.map((d) => ({
            processo: formatado.get(d)!,
            acao: "criado",
            detalhe: `Data de distribuição: ${map.get(d) || "—"}`,
          })),
          ...jaExistentes.map((d) => ({
            processo: formatado.get(d)!,
            acao: "ignorado",
            detalhe: "Já existe na base — nenhum dado foi alterado",
          })),
          ...rejeitados.map((r) => ({
            processo: r.processo,
            acao: "rejeitado",
            detalhe: r.motivo,
          })),
        ],
      });
      onImported?.();
    } catch (err: any) {
      console.error("Erro ao importar certidão PDF:", err);
      if (rejeitados.length || duplicados.length) baixarRelatorio(file.name, rejeitados, duplicados);
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
        title="Lê uma Certidão de Distribuição em PDF (TST), cadastra os processos e gera relatório de rejeitados/duplicados."
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
