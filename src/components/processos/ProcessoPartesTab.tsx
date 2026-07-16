import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  processoNumero?: string | null;
}

type Parte = {
  nome: string | null;
  documento: string | null;
  tipo_pessoa: string | null;
  polo: string | null;
  is_advogado: boolean | null;
};

const formatDoc = (doc: string | null) => {
  if (!doc) return "—";
  const d = doc.replace(/\D/g, "");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return doc;
};

export function ProcessoPartesTab({ processoNumero }: Props) {
  const { data: partes = [], isLoading } = useQuery<Parte[]>({
    queryKey: ["processo-partes-benner", processoNumero],
    enabled: !!processoNumero,
    queryFn: async () => {
      if (!processoNumero) return [];
      const { data: benner, error: e1 } = await supabase
        .from("dados_benner")
        .select("id")
        .eq("processo", processoNumero);
      if (e1) throw e1;
      const ids = (benner || []).map((b: any) => b.id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("partes_processo_benner")
        .select("nome, documento, tipo_pessoa, polo, is_advogado")
        .in("dados_benner_id", ids)
        .order("is_advogado", { ascending: true })
        .order("nome", { ascending: true });
      if (error) throw error;
      // dedup por nome+documento
      const seen = new Set<string>();
      const out: Parte[] = [];
      for (const p of (data as Parte[] | null) || []) {
        const key = `${(p.nome || "").trim().toLowerCase()}|${(p.documento || "").replace(/\D/g, "")}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(p);
      }
      return out;
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="w-5 h-5" />
          Partes do processo
          {partes.length > 0 && <Badge variant="secondary" className="ml-2">{partes.length}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
            <Skeleton className="h-8" />
          </div>
        ) : partes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
            Nenhuma parte registrada. Importe via <strong>Judit</strong> na tela de Distribuição TST para popular.
          </div>
        ) : (
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Polo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF/CNPJ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partes.map((p, i) => (
                  <TableRow
                    key={i}
                    className={cn(
                      p.is_advogado && "text-muted-foreground",
                      "bg-emerald-50/40 dark:bg-emerald-950/20"
                    )}
                  >
                    <TableCell className="text-xs">
                      {p.polo === "Active" ? "Ativo" : p.polo === "Passive" ? "Passivo" : p.polo || "—"}
                    </TableCell>
                    <TableCell className="text-xs">{p.tipo_pessoa || "—"}</TableCell>
                    <TableCell className="font-medium text-sm">{p.nome || "Sem nome"}</TableCell>
                    <TableCell className="text-xs font-mono">{formatDoc(p.documento)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}