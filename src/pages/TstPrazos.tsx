import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, Upload } from "lucide-react";
import { usePrazosTst, PrazoTst } from "@/hooks/usePrazosTst";
import { TstKanbanBoard } from "@/components/tst-prazos/TstKanbanBoard";
import { TstPrazoDetailSheet } from "@/components/tst-prazos/TstPrazoDetailSheet";
import { TstPrazoFormDialog } from "@/components/tst-prazos/TstPrazoFormDialog";
import { TstImportDialog } from "@/components/tst-prazos/TstImportDialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

export default function TstPrazos() {
  const { user } = useAuth();

  // Fetch coordenacoes the user belongs to
  const { data: coordenacoes = [] } = useQuery({
    queryKey: ["coordenacoes-usuario-tst"],
    queryFn: async () => {
      // Get user memberships
      const { data: membros } = await supabase
        .from("membros_coordenacao")
        .select("coordenacao_id")
        .eq("usuario_id", user?.id ?? "");
      const ids = membros?.map((m) => m.coordenacao_id) ?? [];

      // Also check if user is coordinator
      const { data: coordenadas } = await supabase
        .from("coordenacoes")
        .select("id")
        .eq("coordenador_id", user?.id ?? "");
      const coordIds = coordenadas?.map((c) => c.id) ?? [];

      const allIds = [...new Set([...ids, ...coordIds])];

      // Check if admin - fetch all
      const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user?.id ?? "");
      const isAdmin = roleData?.some((r) => r.role === "admin") ?? false;

      if (isAdmin) {
        const { data } = await supabase.from("coordenacoes").select("id, nome").order("nome");
        return data ?? [];
      }

      if (allIds.length === 0) return [];
      const { data } = await supabase.from("coordenacoes").select("id, nome").in("id", allIds).order("nome");
      return data ?? [];
    },
    enabled: !!user?.id,
  });

  const [coordenacaoId, setCoordenacaoId] = useState<string | null>(null);

  // Auto-select first coord
  if (!coordenacaoId && coordenacoes.length > 0) {
    setCoordenacaoId(coordenacoes[0].id);
  }

  const { prazos, isLoading, create, remove, bulkInsert, clearAndInsert, isCreating, isImporting } = usePrazosTst(coordenacaoId);

  const [selected, setSelected] = useState<PrazoTst | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);

  return (
    <MainLayout>
      <div className="flex flex-col h-full gap-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">TST Prazos</h1>
            <p className="text-sm text-muted-foreground">Kanban de prazos fatais por coordenação</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={coordenacaoId ?? ""} onValueChange={setCoordenacaoId}>
              <SelectTrigger className="w-[260px]">
                <SelectValue placeholder="Selecione coordenação" />
              </SelectTrigger>
              <SelectContent>
                {coordenacoes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
              <Upload className="w-4 h-4 mr-1" /> Importar
            </Button>
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-1" /> Novo Prazo
            </Button>
          </div>
        </div>

        {/* Kanban */}
        {isLoading ? (
          <div className="grid grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-[400px] rounded-lg" />
            ))}
          </div>
        ) : (
          <TstKanbanBoard prazos={prazos} onCardClick={setSelected} />
        )}

        {/* Detail Sheet */}
        <TstPrazoDetailSheet
          prazo={selected}
          open={!!selected}
          onClose={() => setSelected(null)}
          onDelete={(id) => remove(id)}
        />

        {/* Form Dialog */}
        <TstPrazoFormDialog
          open={showForm}
          onClose={() => setShowForm(false)}
          onSave={create}
          coordenacaoId={coordenacaoId}
          isSaving={isCreating}
        />

        {/* Import Dialog */}
        <TstImportDialog
          open={showImport}
          onClose={() => setShowImport(false)}
          coordenacaoId={coordenacaoId}
          onImport={bulkInsert}
          onClearAndImport={clearAndInsert}
          isImporting={isImporting}
        />
      </div>
    </MainLayout>
  );
}
