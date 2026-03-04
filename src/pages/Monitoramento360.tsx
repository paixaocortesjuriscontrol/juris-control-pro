import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Radar, 
  Play, 
  Loader2,
  Bell,
  Filter,
  Search,
  Building2,
  FileQuestion
} from "lucide-react";
import { useMonitoramento360 } from "@/hooks/useMonitoramento360";
import { useCoordenacoes } from "@/hooks/useDashboardData";
import { useNaoCadastradosConfig } from "@/hooks/useNaoCadastradosConfig";
import TermosConfig from "@/components/monitoramento360/TermosConfig";
import AlertasList from "@/components/monitoramento360/AlertasList";
import CarteirasConfig from "@/components/monitoramento360/CarteirasConfig";
import AlertasNaoCadastradosList from "@/components/monitoramento360/AlertasNaoCadastradosList";

export default function Monitoramento360() {
  const {
    termos,
    alertas,
    termosAtivos,
    executarVarredura,
  } = useMonitoramento360();

  const { data: coordenacoes } = useCoordenacoes();
  const { ativo, loading: loadingConfig, toggle } = useNaoCadastradosConfig();
  const [activeTab, setActiveTab] = useState("alertas");
  const [coordenacaoId, setCoordenacaoId] = useState<string>("todas");

  const alertasFiltradosPorCoordenacao = alertas.filter((alerta) => {
    if (coordenacaoId === "todas") return true;
    if (!alerta.processo?.coordenacao_id) return false;
    return alerta.processo.coordenacao_id === coordenacaoId;
  });

  const alertasPendentes = alertasFiltradosPorCoordenacao.filter(a => a.status === 'pendente').length;
  const alertasUrgentes = alertasFiltradosPorCoordenacao.filter(a => a.status === 'pendente' && a.prioridade === 'urgente').length;
  const totalAlertas = alertasFiltradosPorCoordenacao.length;

  return (
    <MainLayout title="Monitoração 360º" subtitle="Monitoramento inteligente de termos estratégicos">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Radar className="h-7 w-7 text-primary" />
              Monitoração 360º
            </h1>
            <p className="text-muted-foreground mt-1">
              Monitoramento inteligente de termos estratégicos nos andamentos processuais
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={coordenacaoId} onValueChange={setCoordenacaoId}>
              <SelectTrigger className="w-[280px]">
                <Building2 className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Coordenação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as Coordenações</SelectItem>
                {coordenacoes?.map((coord) => (
                  <SelectItem key={coord.id} value={coord.id}>
                    {coord.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => executarVarredura.mutate()}
              disabled={executarVarredura.isPending}
            >
              {executarVarredura.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Executar Varredura
            </Button>
          </div>
        </div>

        {/* Opção: Incluir Processos Não Cadastrados */}
        <Card className="border-dashed">
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileQuestion className="h-5 w-5 text-amber-500" />
                <div>
                  <Label className="text-sm font-medium">Incluir processos não cadastrados</Label>
                  <p className="text-xs text-muted-foreground">
                    Pesquisa termos em publicações DJEN de processos que não estão importados no sistema
                  </p>
                </div>
              </div>
              <Switch
                checked={ativo}
                onCheckedChange={toggle}
                disabled={loadingConfig}
              />
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Termos Ativos</CardDescription>
              <CardTitle className="text-3xl">{termosAtivos}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {termos.length} termos configurados
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Alertas Pendentes</CardDescription>
              <CardTitle className="text-3xl text-amber-500">{alertasPendentes}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Aguardando tratamento
              </p>
            </CardContent>
          </Card>
          
          <Card className={alertasUrgentes > 0 ? "border-destructive" : ""}>
            <CardHeader className="pb-2">
              <CardDescription>Alertas Urgentes</CardDescription>
              <CardTitle className="text-3xl text-destructive">{alertasUrgentes}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Prioridade máxima
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total de Alertas</CardDescription>
              <CardTitle className="text-3xl">{totalAlertas}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                {coordenacaoId === "todas" ? "Todas as coordenações" : "Coordenação selecionada"}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="alertas" className="gap-2">
              <Bell className="h-4 w-4" />
              Alertas
              {alertasPendentes > 0 && (
                <Badge variant="destructive" className="ml-1">
                  {alertasPendentes}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="nao-cadastrados" className="gap-2">
              <FileQuestion className="h-4 w-4" />
              Não Cadastrados
            </TabsTrigger>
            <TabsTrigger value="termos" className="gap-2">
              <Search className="h-4 w-4" />
              Termos
            </TabsTrigger>
            <TabsTrigger value="carteiras" className="gap-2">
              <Filter className="h-4 w-4" />
              Carteiras
            </TabsTrigger>
          </TabsList>

          <TabsContent value="alertas" className="mt-6">
            <AlertasList coordenacaoId={coordenacaoId !== "todas" ? coordenacaoId : undefined} />
          </TabsContent>

          <TabsContent value="nao-cadastrados" className="mt-6">
            <AlertasNaoCadastradosList coordenacaoId={coordenacaoId !== "todas" ? coordenacaoId : undefined} />
          </TabsContent>

          <TabsContent value="termos" className="mt-6">
            <TermosConfig />
          </TabsContent>

          <TabsContent value="carteiras" className="mt-6">
            <CarteirasConfig />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
