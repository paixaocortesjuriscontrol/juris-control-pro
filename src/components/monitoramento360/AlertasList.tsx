import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Bell, Eye, CheckCircle, XCircle, Search, ExternalLink } from "lucide-react";
import { useMonitoramento360, AlertaMonitoramento } from "@/hooks/useMonitoramento360";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";

interface AlertasListProps {
  coordenacaoId?: string;
}

export default function AlertasList({ coordenacaoId }: AlertasListProps) {
  const { alertas, atualizarAlerta, PRIORIDADES } = useMonitoramento360();
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [filtroPrioridade, setFiltroPrioridade] = useState<string>('todas');
  const [busca, setBusca] = useState('');
  const [selectedAlerta, setSelectedAlerta] = useState<AlertaMonitoramento | null>(null);
  const [observacoes, setObservacoes] = useState('');

  const alertasFiltrados = alertas.filter((alerta) => {
    // Filtro por coordenação
    // Observação: dependendo das permissões (RLS), o objeto `processo` pode vir null;
    // nesse caso, não removemos o alerta do resultado para evitar lista vazia indevida.
    if (
      coordenacaoId &&
      alerta.processo?.coordenacao_id &&
      alerta.processo.coordenacao_id !== coordenacaoId
    ) {
      return false;
    }

    if (filtroStatus !== 'todos' && alerta.status !== filtroStatus) return false;
    if (filtroPrioridade !== 'todas' && alerta.prioridade !== filtroPrioridade) return false;
    if (busca) {
      const searchLower = busca.toLowerCase();
      return (
        alerta.termo_encontrado.toLowerCase().includes(searchLower) ||
        alerta.processo?.numero.toLowerCase().includes(searchLower) ||
        alerta.contexto?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const getPrioridadeColor = (prioridade: string) => {
    switch (prioridade) {
      case 'urgente': return 'destructive';
      case 'alta': return 'default';
      case 'media': return 'secondary';
      case 'baixa': return 'outline';
      default: return 'secondary';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pendente': return 'default';
      case 'visualizado': return 'secondary';
      case 'tratado': return 'outline';
      case 'ignorado': return 'outline';
      default: return 'secondary';
    }
  };

  const handleViewAlerta = (alerta: AlertaMonitoramento) => {
    setSelectedAlerta(alerta);
    setObservacoes(alerta.observacoes || '');
    if (alerta.status === 'pendente') {
      atualizarAlerta.mutate({ id: alerta.id, status: 'visualizado' });
    }
  };

  const handleTratarAlerta = (status: 'tratado' | 'ignorado') => {
    if (selectedAlerta) {
      atualizarAlerta.mutate({
        id: selectedAlerta.id,
        status,
        observacoes,
      });
      setSelectedAlerta(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Alertas de Monitoramento
              </CardTitle>
              <CardDescription>
                Eventos detectados nos andamentos processuais
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-9 w-[200px]"
                />
              </div>
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="visualizado">Visualizado</SelectItem>
                  <SelectItem value="tratado">Tratado</SelectItem>
                  <SelectItem value="ignorado">Ignorado</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filtroPrioridade} onValueChange={setFiltroPrioridade}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Prioridade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {PRIORIDADES.map((prio) => (
                    <SelectItem key={prio.value} value={prio.value}>
                      {prio.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Termo</TableHead>
                <TableHead>Processo</TableHead>
                <TableHead>Contexto</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alertasFiltrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhum alerta encontrado com os filtros selecionados.
                  </TableCell>
                </TableRow>
              ) : (
                alertasFiltrados.map((alerta) => (
                  <TableRow key={alerta.id} className={alerta.prioridade === 'urgente' ? 'bg-destructive/5' : ''}>
                    <TableCell className="font-medium">
                      <Badge variant="outline">{alerta.termo_encontrado}</Badge>
                    </TableCell>
                    <TableCell>
                      <Link 
                        to={`/processos/${alerta.processo_id}`}
                        className="text-primary hover:underline"
                      >
                        {alerta.processo?.numero || alerta.processo_id.slice(0, 8)}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {alerta.contexto || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getPrioridadeColor(alerta.prioridade)}>
                        {PRIORIDADES.find(p => p.value === alerta.prioridade)?.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(alerta.status)}>
                        {alerta.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(alerta.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleViewAlerta(alerta)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog de detalhes do alerta */}
      <Dialog open={!!selectedAlerta} onOpenChange={() => setSelectedAlerta(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Detalhes do Alerta
            </DialogTitle>
          </DialogHeader>
          {selectedAlerta && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Termo Encontrado</Label>
                  <p className="font-medium">{selectedAlerta.termo_encontrado}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Prioridade</Label>
                  <Badge variant={getPrioridadeColor(selectedAlerta.prioridade)}>
                    {PRIORIDADES.find(p => p.value === selectedAlerta.prioridade)?.label}
                  </Badge>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground">Processo</Label>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{selectedAlerta.processo?.numero}</p>
                  <Link to={`/processos/${selectedAlerta.processo_id}`}>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
                {selectedAlerta.processo?.polo_ativo && (
                  <p className="text-sm text-muted-foreground">
                    {selectedAlerta.processo.polo_ativo} x {selectedAlerta.processo.polo_passivo}
                  </p>
                )}
              </div>

              {selectedAlerta.contexto && (
                <div>
                  <Label className="text-muted-foreground">Contexto</Label>
                  <p className="text-sm bg-muted p-3 rounded-md mt-1">
                    {selectedAlerta.contexto}
                  </p>
                </div>
              )}

              {selectedAlerta.movimentacao && (
                <div>
                  <Label className="text-muted-foreground">Movimentação</Label>
                  <p className="text-sm">{selectedAlerta.movimentacao.descricao}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(selectedAlerta.movimentacao.data_movimentacao), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </p>
                </div>
              )}

              <div>
                <Label className="text-muted-foreground">Observações</Label>
                <Textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Adicione observações sobre o tratamento deste alerta..."
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => handleTratarAlerta('ignorado')}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Ignorar
                </Button>
                <Button onClick={() => handleTratarAlerta('tratado')}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Marcar como Tratado
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
