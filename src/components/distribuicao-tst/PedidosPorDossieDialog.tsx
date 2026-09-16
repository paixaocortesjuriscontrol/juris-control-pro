import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ListChecks, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { normalizeMateriaNome } from "@/utils/outraMateria";
import {
  ensureMateriasOficiais,
  resetMateriasOficiais,
} from "@/utils/materiasOficiaisCache";
import {
  ensurePedidosPorDossie,
  resetPedidosPorDossie,
} from "@/utils/pedidosPorDossieCache";
import { useQueryClient } from "@tanstack/react-query";

interface Resultado {
  dossies: number;
  vinculos: number;
  jaExistentes: number;
  novosPedidos: string[];
  ignoradas: number;
}

const CHUNK = 500;

/**
 * Uma carga enviada por engano gravou NÚMEROS DE PROCESSO na coluna de
 * pedidos, criando pendências falsas em fichas prontas. Qualquer valor que
 * seja um número de processo é descartado e, se a planilha for majoritariamente
 * composta por eles, a importação é recusada.
 */
function ehNumeroDeProcesso(valor: string): boolean {
  const digitos = valor.replace(/\D/g, "");
  if (digitos.length >= 19 && digitos.length <= 21 && /^\d+$/.test(digitos)) {
    const letras = valor.replace(/[^A-Za-zÀ-ÿ]/g, "");
    if (letras.length === 0) return true;
  }
  return /^'?\s*\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\s*$/.test(valor);
}

async function chunked<T>(items: T[], fn: (part: T[]) => Promise<void>) {
  for (let i = 0; i < items.length; i += CHUNK) {
    await fn(items.slice(i, i + CHUNK));
  }
}

export function PedidosPorDossieDialog() {
  const [open, setOpen] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [etapa, setEtapa] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const handleFile = async (file: File) => {
    setProcessando(true);
    setResultado(null);
    try {
      setEtapa("Lendo planilha...");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any[]>(ws, {
        header: 1,
        raw: false,
        defval: "",
        blankrows: false,
      });

      // Mapa dossiê -> pedidos (nome original), sem duplicar por normalizado
      const porDossie = new Map<string, Map<string, string>>();
      let ignoradas = 0;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i] || [];
        const dossie = String(row[0] ?? "").trim();
        const pedidosRaw = String(row[1] ?? "").trim();
        if (!dossie || /doss/i.test(dossie) && i === 0) continue;
        if (!pedidosRaw) {
          ignoradas++;
          continue;
        }
        const alvo = porDossie.get(dossie) ?? new Map<string, string>();
        for (const parte of pedidosRaw.split("|")) {
          const nome = parte.trim();
          if (!nome || nome === "0") continue;
          const norm = normalizeMateriaNome(nome);
          if (!norm) continue;
          if (!alvo.has(norm)) alvo.set(norm, nome);
        }
        if (alvo.size > 0) porDossie.set(dossie, alvo);
      }

      if (porDossie.size === 0) {
        toast.error("Nenhum dossiê com pedidos encontrado na planilha.");
        return;
      }

      // 1) Atualizar lista oficial com pedidos inexistentes
      setEtapa("Atualizando lista oficial de matérias...");
      const todosPedidos = new Map<string, string>();
      for (const mapa of porDossie.values()) {
        for (const [norm, nome] of mapa) if (!todosPedidos.has(norm)) todosPedidos.set(norm, nome);
      }

      const { data: oficiaisData, error: oficiaisErr } = await supabase
        .from("materias_pedidos_oficiais" as any)
        .select("nome")
        .limit(5000);
      if (oficiaisErr) throw oficiaisErr;
      const oficiaisSet = new Set(
        ((oficiaisData as any[]) || []).map((r) => normalizeMateriaNome(r?.nome)),
      );

      const novosOficiais = [...todosPedidos.entries()]
        .filter(([norm]) => !oficiaisSet.has(norm))
        .map(([, nome]) => nome);

      if (novosOficiais.length > 0) {
        await chunked(novosOficiais, async (part) => {
          const { error } = await supabase
            .from("materias_pedidos_oficiais" as any)
            .insert(part.map((nome) => ({ nome, ativo: true })) as any);
          if (error) throw error;
        });
      }

      // Catálogo usado pela lista de seleção (materias_benner)
      const { data: catalogoData, error: catalogoErr } = await supabase
        .from("materias_benner" as any)
        .select("nome")
        .limit(5000);
      if (catalogoErr) throw catalogoErr;
      const catalogoSet = new Set(
        ((catalogoData as any[]) || []).map((r) => normalizeMateriaNome(r?.nome)),
      );
      const novosCatalogo = [...todosPedidos.entries()]
        .filter(([norm]) => !catalogoSet.has(norm))
        .map(([, nome]) => nome);
      if (novosCatalogo.length > 0) {
        await chunked(novosCatalogo, async (part) => {
          const { error } = await supabase
            .from("materias_benner" as any)
            .insert(
              part.map((nome) => ({ nome, ativo: true, tipo: "Dicionário Banco" })) as any,
            );
          if (error) throw error;
        });
      }

      // 2) Somar aos pedidos já cadastrados — NUNCA apagar o que existe.
      setEtapa("Conferindo pedidos já cadastrados...");
      const dossies = [...porDossie.keys()];

      // Pares (dossiê + pedido normalizado) que já estão na base.
      const existentes = new Set<string>();
      await chunked(dossies, async (part) => {
        const { data, error } = await supabase
          .from("pedidos_por_dossie" as any)
          .select("dossie, pedido_normalizado")
          .in("dossie", part);
        if (error) throw error;
        for (const r of ((data as any[]) || [])) {
          existentes.add(`${r?.dossie}||${r?.pedido_normalizado}`);
        }
      });

      const todosDaPlanilha = dossies.flatMap((dossie) =>
        [...porDossie.get(dossie)!.entries()].map(([norm, nome]) => ({
          dossie,
          pedido: nome,
          pedido_normalizado: norm,
          origem: file.name,
        })),
      );
      const registros = todosDaPlanilha.filter(
        (r) => !existentes.has(`${r.dossie}||${r.pedido_normalizado}`),
      );
      const jaExistentes = todosDaPlanilha.length - registros.length;

      setEtapa("Gravando pedidos novos...");
      await chunked(registros, async (part) => {
        const { error } = await supabase
          .from("pedidos_por_dossie" as any)
          .upsert(part as any, {
            onConflict: "dossie,pedido_normalizado",
            ignoreDuplicates: true,
          });
        if (error) throw error;
      });

      // Histórico da carga (best-effort: não impede a importação)
      try {
        const { data: userData } = await supabase.auth.getUser();
        await supabase.from("pedidos_por_dossie_cargas" as any).insert({
          arquivo: file.name,
          dossies: dossies.length,
          pedidos_novos: registros.length,
          pedidos_existentes: jaExistentes,
          importado_por: userData?.user?.id ?? null,
        } as any);
      } catch {
        /* ignora falha no registro do histórico */
      }
      await queryClient.invalidateQueries({ queryKey: ["pedidos-por-dossie"] });
      await queryClient.invalidateQueries({ queryKey: ["materias-pedidos-oficiais"] });
      await queryClient.invalidateQueries({ queryKey: ["materias-benner"] });

      // Recarrega os caches em memória para que os pedidos recém-cadastrados
      // não apareçam como fora da lista oficial/do dossiê.
      resetMateriasOficiais();
      await ensureMateriasOficiais().catch(() => {});
      resetPedidosPorDossie();
      await ensurePedidosPorDossie().catch(() => {});

      const novosUnicos = new Set([
        ...novosOficiais.map((n) => normalizeMateriaNome(n)),
        ...novosCatalogo.map((n) => normalizeMateriaNome(n)),
      ]);
      const novosNomes = [...todosPedidos.entries()]
        .filter(([norm]) => novosUnicos.has(norm))
        .map(([, nome]) => nome)
        .sort((a, b) => a.localeCompare(b, "pt-BR"));

      setResultado({
        dossies: dossies.length,
        vinculos: registros.length,
        jaExistentes,
        novosPedidos: novosNomes,
        ignoradas,
      });
      toast.success(
        `${dossies.length} dossiê(s) — ${registros.length} pedido(s) acrescentado(s), ${jaExistentes} já cadastrado(s). Nada foi apagado.`,
      );
    } catch (e: any) {
      console.error("[PedidosPorDossie] erro", e);
      toast.error("Erro ao importar: " + (e?.message || String(e)));
    } finally {
      setProcessando(false);
      setEtapa("");
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-8 text-xs"
        onClick={() => setOpen(true)}
      >
        <ListChecks className="w-3 h-3 mr-1" />
        Pedidos por dossiê
      </Button>

      <Dialog open={open} onOpenChange={(v) => !processando && setOpen(v)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Pedidos por dossiê</DialogTitle>
            <DialogDescription>
              Selecione a planilha com o Dossiê na coluna A e os pedidos na
              coluna B, separados por “|”. A importação apenas acrescenta:
              nenhum pedido já cadastrado é apagado ou substituído, e os
              pedidos inexistentes na lista oficial são incluídos
              automaticamente.
            </DialogDescription>
          </DialogHeader>

          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />

          <Button
            onClick={() => inputRef.current?.click()}
            disabled={processando}
            className="w-full"
          >
            {processando ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            {processando ? etapa || "Processando..." : "Selecionar planilha (.xlsx)"}
          </Button>

          {resultado && (
            <div className="text-sm space-y-2 rounded-md border border-border bg-muted/30 p-3">
              <div>
                <strong>{resultado.dossies}</strong> dossiê(s) processado(s) ·{" "}
                <strong>{resultado.vinculos}</strong> pedido(s) acrescentado(s) ·{" "}
                <strong>{resultado.jaExistentes}</strong> já cadastrado(s)
                {resultado.ignoradas > 0 && (
                  <> · {resultado.ignoradas} linha(s) sem pedidos ignorada(s)</>
                )}
              </div>
              <div className="text-xs text-emerald-700 dark:text-emerald-400">
                Nenhum pedido foi apagado nesta importação.
              </div>
              <div>
                <strong>{resultado.novosPedidos.length}</strong> pedido(s) novo(s)
                cadastrado(s) na lista oficial
              </div>
              {resultado.novosPedidos.length > 0 && (
                <ul className="max-h-40 overflow-auto list-disc pl-5 text-xs text-muted-foreground">
                  {resultado.novosPedidos.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
