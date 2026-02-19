import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Newspaper, Building2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useMonitoramentosDjen, MonitoramentoDjen } from "@/hooks/useMonitoramentosDjen";
import { MonitoramentoDialog } from "@/components/djen/MonitoramentoDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Hook para buscar coordenações do usuário logado (ou todas se admin)
function useCoordenacoesFiltradas(isAdmin: boolean, userId: string | undefined) {
  return useQuery({
    queryKey: ["coordenacoes-usuario", userId, isAdmin],
    queryFn: async () => {
      if (!userId) return [];

      if (isAdmin) {
        // Admin vê todas
        const { data, error } = await supabase
          .from("coordenacoes")
          .select("id, nome, area")
          .order("nome");
        if (error) throw error;
        return data || [];
      }

      // Usuário comum: busca coordenações onde é membro
      const { data, error } = await supabase
        .from("membros_coordenacao")
        .select("coordenacao_id, coordenacoes(id, nome, area)")
        .eq("usuario_id", userId);

      if (error) throw error;

      const coordenacoes = (data || [])
        .map((m: any) => m.coordenacoes)
        .filter(Boolean);

      // Deduplicar por id
      const seen = new Set<string>();
      return coordenacoes.filter((c: any) => {
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });
    },
    enabled: !!userId,
  });
}

const TIPO_LABELS: Record<string, string> = {
  "palavra-chave": "Palavra-chave",
  advogado: "Advogado",
  processo: "Processo",
  parte: "Parte",
};

const TIPO_COLORS: Record<string, "default" | "secondary" | "outline"> = {
  "palavra-chave": "default",
  advogado: "secondary",
  processo: "outline",
  parte: "outline",
};

export default function TermosDjen() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();

  const { data: coordenacoes = [], isLoading: loadingCoordenacoes } = useCoordenacoesFiltradas(
    isAdmin,
    user?.id
  );

  const [coordenacaoFiltro, setCoordenacaoFiltro] = useState<string>("__all__");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMonitoramento, setEditingMonitoramento] = useState<MonitoramentoDjen | null>(null);

  const {
    monitoramentos,
    isLoading,
    atualizarMonitoramento,
    excluirMonitoramento,
  } = useMonitoramentosDjen();

  // IDs de coordenações permitidas para este usuário
  const coordenacoesPermitidas = new Set(coordenacoes.map((c: any) => c.id));

  // Filtrar monitoramentos pelas coordenações do usuário
  const monitoramentosFiltrados = monitoramentos.filter((m) => {
    if (!m.coordenacao_id) return isAdmin; // sem coordenação: só admin vê
    if (!isAdmin && !coordenacoesPermitidas.has(m.coordenacao_id)) return false;
    if (coordenacaoFiltro !== "__all__" && m.coordenacao_id !== coordenacaoFiltro) return false;
    return true;
  });

  // Criar mapa de nomes de coordenações
  const coordNomeMap = new Map<string, string>(
    coordenacoes.map((c: any) => [c.id, c.nome])
  );

  const handleNovo = () => {
    setEditingMonitoramento(null);
    setDialogOpen(true);
  };

  const handleEditar = (m: MonitoramentoDjen) => {
    setEditingMonitoramento(m);
    setDialogOpen(true);
  };

  return (
    <MainLayout
      title="Termos DJEN"
      subtitle="Gerencie os monitoramentos do Diário de Justiça Eletrônico Nacional por termos, advogado ou processo"
    >
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Newspaper className="h-5 w-5" />
                Monitoramentos Cadastrados
              </CardTitle>
              <CardDescription>
                {isAdmin
                  ? "Exibindo todos os monitoramentos de todas as coordenações"
                  : "Exibindo monitoramentos das suas coordenações"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Filtro por coordenação */}
              {coordenacoes.length > 1 && (
                <Select value={coordenacaoFiltro} onValueChange={setCoordenacaoFiltro}>
                  <SelectTrigger className="w-52">
                    <SelectValue placeholder="Filtrar coordenação" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todas as coordenações</SelectItem>
                    {coordenacoes.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button onClick={handleNovo} className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Monitoramento
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading || loadingCoordenacoes ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : monitoramentosFiltrados.length === 0 ? (
            <div className="text-center py-12">
              <Newspaper className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground font-medium">Nenhum monitoramento cadastrado</p>
              <p className="text-sm text-muted-foreground mt-1">
                Clique em "Novo Monitoramento" para começar a configurar alertas do DJEN.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Termo / Busca</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Coordenação</TableHead>
                  <TableHead>OAB / UF</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monitoramentosFiltrados.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium max-w-[200px]">
                      <div className="truncate" title={m.termo_busca}>
                        {m.termo_busca}
                      </div>
                      {m.descricao && (
                        <div className="text-xs text-muted-foreground truncate" title={m.descricao}>
                          {m.descricao}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={TIPO_COLORS[m.tipo] || "outline"}>
                        {TIPO_LABELS[m.tipo] || m.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {m.coordenacao_id ? (
                        <div className="flex items-center gap-1 text-sm">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                          <span className="truncate max-w-[140px]" title={coordNomeMap.get(m.coordenacao_id)}>
                            {coordNomeMap.get(m.coordenacao_id) || m.coordenacao_id.slice(0, 8) + "…"}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">Sem coordenação</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {m.oab && <div>OAB: {m.oab}</div>}
                      {m.uf && <div className="text-muted-foreground">{m.uf}</div>}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={m.ativo}
                        onCheckedChange={(checked) =>
                          atualizarMonitoramento.mutate({ id: m.id, ativo: checked })
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEditar(m)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir monitoramento?</AlertDialogTitle>
                              <AlertDialogDescription>
                                O monitoramento <strong>"{m.termo_busca}"</strong> será excluído
                                permanentemente, junto com todas as publicações associadas.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => excluirMonitoramento.mutate(m.id)}
                                className="bg-destructive text-destructive-foreground"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Diálogo de criação/edição com coordenações filtradas */}
      <MonitoramentoDialogFiltrado
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        monitoramento={editingMonitoramento}
        coordenacoes={coordenacoes}
        isAdmin={isAdmin}
      />
    </MainLayout>
  );
}

// Wrapper do dialog que injeta as coordenações filtradas
function MonitoramentoDialogFiltrado({
  open,
  onOpenChange,
  monitoramento,
  coordenacoes,
  isAdmin,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  monitoramento: MonitoramentoDjen | null;
  coordenacoes: any[];
  isAdmin: boolean;
}) {
  return (
    <MonitoramentoDialog
      open={open}
      onOpenChange={onOpenChange}
      monitoramento={monitoramento}
      coordenacoesOverride={coordenacoes}
    />
  );
}
