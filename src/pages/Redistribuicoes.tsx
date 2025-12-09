import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRedistribuicoes } from "@/hooks/useRedistribuicoes";
import { useCoordenacoesFull } from "@/hooks/useCoordenacoes";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowRight, Calendar, Filter, RefreshCw, Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const areaLabels: Record<string, string> = {
  civil: "Cível",
  trabalhista: "Trabalhista",
  empresarial: "Empresarial",
};

export default function Redistribuicoes() {
  const navigate = useNavigate();
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [processoNumero, setProcessoNumero] = useState("");
  const [coordenacaoId, setCoordenacaoId] = useState("all");

  const { data: coordenacoes } = useCoordenacoesFull();
  const { data: redistribuicoes, isLoading, refetch } = useRedistribuicoes({
    dataInicio: dataInicio || undefined,
    dataFim: dataFim || undefined,
    processoNumero: processoNumero || undefined,
    coordenacaoId: coordenacaoId !== "all" ? coordenacaoId : undefined,
  });

  const clearFilters = () => {
    setDataInicio("");
    setDataFim("");
    setProcessoNumero("");
    setCoordenacaoId("all");
  };

  const hasFilters = dataInicio || dataFim || processoNumero || coordenacaoId !== "all";

  return (
    <MainLayout
      title="Histórico de Redistribuições"
      subtitle={`${redistribuicoes?.length || 0} redistribuições detectadas`}
    >
      {/* Filters Card */}
      <Card className="mb-6 animate-fade-in">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Data Início</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Data Fim</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Nº Processo</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar processo..."
                  value={processoNumero}
                  onChange={(e) => setProcessoNumero(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Coordenação</label>
              <Select value={coordenacaoId} onValueChange={setCoordenacaoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {coordenacoes?.map((coord) => (
                    <SelectItem key={coord.id} value={coord.id}>
                      {coord.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => refetch()}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Atualizar
              </Button>
              {hasFilters && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearFilters}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card className="animate-slide-up">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : redistribuicoes && redistribuicoes.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Processo</TableHead>
                    <TableHead>Área</TableHead>
                    <TableHead>Coordenação</TableHead>
                    <TableHead>Advogado</TableHead>
                    <TableHead>Vara Antiga</TableHead>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Nova Vara</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {redistribuicoes.map((red) => (
                    <TableRow
                      key={red.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/processos/${red.processo_id}`)}
                    >
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(red.data_redistribuicao), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {red.processo_numero}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("badge-area-" + red.processo_area, "text-xs")}>
                          {areaLabels[red.processo_area] || red.processo_area}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {red.coordenacao_nome || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {red.advogado_nome || "—"}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={red.vara_antiga}>
                        {red.vara_antiga}
                      </TableCell>
                      <TableCell className="text-center">
                        <ArrowRight className="w-4 h-4 text-primary" />
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate font-medium text-primary" title={red.vara_nova}>
                        {red.vara_nova}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <RefreshCw className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Nenhuma redistribuição encontrada
              </h3>
              <p className="text-muted-foreground">
                {hasFilters
                  ? "Tente ajustar os filtros de busca"
                  : "Quando o sistema detectar redistribuições, elas aparecerão aqui"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </MainLayout>
  );
}
