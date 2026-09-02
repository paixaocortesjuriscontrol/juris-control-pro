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
import { useQueryClient } from "@tanstack/react-query";

interface Resultado {
  dossies: number;
  vinculos: number;
  novosPedidos: string[];
  ignoradas: number;
}

const CHUNK = 500;

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

      // 2) Substituir pedidos dos dossiês presentes na planilha
      setEtapa("Gravando pedidos por dossiê...");
      const dossies = [...porDossie.keys()];
      await chunked(dossies, async (part) => {
        const { error } = await supabase
          .from("pedidos_por_dossie" as any)
          .delete()
          .in("dossie", part);
        if (error) throw error;
      });

      const registros = dossies.flatMap((dossie) =>
        [...porDossie.get(dossie)!.entries()].map(([norm, nome]) => ({
          dossie,
          pedido: nome,
          pedido_normalizado: norm,
          origem: file.name,
        })),
      );

      await chunked(registros, async (part) => {
        const { error } = await supabase
          .from("pedidos_por_dossie" as any)
          .insert(part as any);
        if (error) throw error;
      });

      await queryClient.invalidateQueries({ queryKey: ["pedidos-por-dossie"] });
      await queryClient.invalidateQueries({ queryKey: ["materias-pedidos-oficiais"] });
      await queryClient.invalidateQueries({ queryKey: ["materias-benner"] });

      // Recarrega o cache em memória da lista oficial para que os pedidos
      // recém-cadastrados não apareçam mais como "fora lista do Benner".
      resetMateriasOficiais();
      await ensureMateriasOficiais().catch(() => {});

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
        novosPedidos: novosNomes,
        ignoradas,
      });
      toast.success(
        `${dossies.length} dossiê(s) atualizado(s) — ${registros.length} pedido(s) vinculado(s).`,
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
              coluna B, separados por “|”. Os pedidos do dossiê substituem os
              já cadastrados e os pedidos inexistentes na lista oficial são
              incluídos automaticamente.
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
                <strong>{resultado.vinculos}</strong> pedido(s) vinculado(s)
                {resultado.ignoradas > 0 && (
                  <> · {resultado.ignoradas} linha(s) sem pedidos ignorada(s)</>
                )}
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
