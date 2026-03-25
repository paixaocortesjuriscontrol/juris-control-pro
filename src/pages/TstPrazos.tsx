import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus, Upload } from "lucide-react";
import { usePrazosTst, ProcessoTst } from "@/hooks/usePrazosTst";
import { TstKanbanBoard } from "@/components/tst-prazos/TstKanbanBoard";
import { TstPrazoDetailSheet } from "@/components/tst-prazos/TstPrazoDetailSheet";
import { TstPrazoFormDialog } from "@/components/tst-prazos/TstPrazoFormDialog";
import { TstImportDialog } from "@/components/tst-prazos/TstImportDialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

interface CoordResult {
  coordenacoes: { id: string; nome: string }[];
  isAdmin: boolean;
}

export default function TstPrazos() {
  const { user } = useAuth();

  const { data: coordResult } = useQuery<CoordResult>({
    queryKey: ["coordenacoes-usuario-tst", user?.id],
    queryFn: async () => {
      const userId = user?.id ?? "";
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      const isAdmin = roleData?.some((r) => r.role === "admin") ?? false;

      if (isAdmin) {
        const { data } = await supabase.from("coordenacoes").select("id, nome").order("nome");
        return { coordenacoes: data ?? [], isAdmin: true };
      }

      const { data: membros } = await supabase
        .from("membros_coordenacao")
        .select("coordenacao_id")
        .eq("usuario_id", userId);
      const ids = membros?.map((m) => m.coordenacao_id) ?? [];

      const { data: coordenadas } = await supabase
        .from("coordenacoes")
        .select("id")
        .eq("coordenador_id", userId);
      const coordIds = coordenadas?.map((c) => c.id) ?? [];

      const allIds = [...new Set([...ids, ...coordIds])];
      if (allIds.length === 0) return { coordenacoes: [], isAdmin: false };

      const { data } = await supabase
        .from("coordenacoes")
        .select("id, nome")
        .in("id", allIds)
        .order("nome");
      return { coordenacoes: data ?? [], isAdmin: false };
    },
    enabled: !!user?.id,
  });

  const coordenacoes = coordResult?.coordenacoes ?? [];
  const isAdmin = coordResult?.isAdmin ?? false;

  const [coordenacaoId, setCoordenacaoId] = useState<string | null>(null);

  // Auto-selecionar a coordenação do usuário logado
  const { data: userCoordenacaoId } = useQuery({
    queryKey: ['user-coordenacao-prazos', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data: coordenador } = await supabase
        .from('coordenacoes')
        .select('id')
        .eq('coordenador_id', user.id)
        .maybeSingle();
      if (coordenador) return coordenador.id;

      const { data: membro } = await supabase
        .from('membros_coordenacao')
        .select('coordenacao_id')
        .eq('usuario_id', user.id)
        .maybeSingle();
      return membro?.coordenacao_id || null;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (coordenacaoId === null && coordenacoes.length > 0 && userCoordenacaoId !== undefined) {
      if (isAdmin) {
        setCoordenacaoId("todas");
      } else {
        const match = coordenacoes.find(c => c.id === userCoordenacaoId);
        setCoordenacaoId(match ? match.id : coordenacoes[0].id);
      }
    }
  }, [coordenacoes, userCoordenacaoId, coordenacaoId, isAdmin]);

  const coordIdForQuery = coordenacaoId === "todas" ? null : coordenacaoId;
  const allCoordIds = isAdmin ? coordenacoes.map(c => c.id) : [];
  const { prazos, isLoading, create, remove, bulkImport, clearAndImport, isCreating, isImporting } = usePrazosTst(
    coordenacaoId === "todas" ? "todas" : coordenacaoId,
    allCoordIds
  );

  const [selected, setSelected] = useState<ProcessoTst | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const showSelector = isAdmin || coordenacoes.length > 1;

  return (
    <MainLayout title="Prazos Fatais">
      <div className="flex flex-col h-full gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Prazos Fatais</h1>
            <p className="text-sm text-muted-foreground">
              {coordenacoes.length === 1 && !isAdmin
                ? coordenacoes[0].nome
                : "Kanban de prazos fatais por coordenação"}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {showSelector && (
              <Select value={coordenacaoId ?? ""} onValueChange={setCoordenacaoId}>
                <SelectTrigger className="w-[260px]">
                  <SelectValue placeholder="Selecione coordenação" />
                </SelectTrigger>
                <SelectContent>
                  {isAdmin && (
                    <SelectItem value="todas">Todas as coordenações</SelectItem>
                  )}
                  {coordenacoes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
              <Upload className="w-4 h-4 mr-1" /> Importar
            </Button>
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="w-4 h-4 mr-1" /> Novo Prazo
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[400px] rounded-lg" />
            ))}
          </div>
        ) : (
          <TstKanbanBoard prazos={prazos} onCardClick={setSelected} />
        )}

        <TstPrazoDetailSheet
          processo={selected}
          open={!!selected}
          onClose={() => setSelected(null)}
        />

        <TstPrazoFormDialog
          open={showForm}
          onClose={() => setShowForm(false)}
          onSave={create}
          coordenacaoId={coordenacaoId === "todas" ? null : coordenacaoId}
          isSaving={isCreating}
        />

        <TstImportDialog
          open={showImport}
          onClose={() => setShowImport(false)}
          coordenacaoId={coordenacaoId}
          coordenacoes={coordenacoes}
          onImport={bulkImport}
          onClearAndImport={clearAndImport}
          isImporting={isImporting}
          onCoordenacaoChange={setCoordenacaoId}
        />
      </div>
    </MainLayout>
  );
}
