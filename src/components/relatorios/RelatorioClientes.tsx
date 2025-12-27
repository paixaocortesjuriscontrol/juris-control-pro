import { 
  Building2,
  Gavel,
  Clock,
  FileText,
  CheckCircle,
  AlertTriangle,
  Users,
  RefreshCw,
  AlertCircle
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useRelatorioClientesData } from "@/hooks/useRelatorioClientesData";

interface RelatorioClientesProps {
  isActive: boolean;
}

export function RelatorioClientes({ isActive }: RelatorioClientesProps) {
  const { data, isLoading, isError, refetch, isFetching } = useRelatorioClientesData(isActive);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-80 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card className="animate-fade-in">
        <CardContent className="py-12">
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            <AlertCircle className="w-12 h-12 text-destructive" />
            <div>
              <p className="font-medium text-lg">Erro ao carregar relatório</p>
              <p className="text-sm text-muted-foreground mt-1">
                O relatório está demorando mais que o esperado. Tente novamente.
              </p>
            </div>
            <Button onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
              {isFetching ? 'Carregando...' : 'Tentar Novamente'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const {
    processosPorCliente,
    processosPorVara,
    duracaoClientes,
    atividadesPorTarefa,
    produtividadeAdvogados,
  } = data;

  return (
    <div className="space-y-6">
      {/* Processos por Cliente - Relatório Completo */}
      <Card className="animate-slide-up">
        <CardHeader>
          <CardTitle className="font-serif flex items-center gap-2">
            <Building2 className="w-5 h-5 text-gold" />
            Relatório de Processos por Cliente
          </CardTitle>
          <CardDescription>Estatísticas detalhadas de processos por cliente</CardDescription>
        </CardHeader>
        <CardContent>
          {processosPorCliente.length === 0 ? (
            <div className="h-32 flex items-center justify-center text-muted-foreground">
              Nenhum cliente com processos
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-4 rounded-lg bg-blue-500/10">
                  <p className="text-2xl font-bold text-blue-500">{processosPorCliente.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">Clientes Ativos</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-green-500/10">
                  <p className="text-2xl font-bold text-green-500">
                    {processosPorCliente.reduce((acc: number, c: any) => acc + c.ativos, 0)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Processos Ativos</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-purple-500/10">
                  <p className="text-2xl font-bold text-purple-500">
                    {processosPorCliente.reduce((acc: number, c: any) => acc + c.encerrados, 0)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Encerrados</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-amber-500/10">
                  <p className="text-2xl font-bold text-amber-500">
                    {processosPorCliente.reduce((acc: number, c: any) => acc + c.prazosPendentes, 0)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Prazos Pendentes</p>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Ativos</TableHead>
                    <TableHead className="text-right">Encerrados</TableHead>
                    <TableHead className="text-right">Prazos Pend.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processosPorCliente.map((cliente: any) => (
                    <TableRow key={cliente.nome}>
                      <TableCell className="font-medium truncate max-w-[200px]">{cliente.nome}</TableCell>
                      <TableCell>
                        <span className={cliente.tipo === "pessoa_fisica" ? "text-blue-500" : "text-purple-500"}>
                          {cliente.tipo === "pessoa_fisica" ? "PF" : "PJ"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium">{cliente.total}</TableCell>
                      <TableCell className="text-right text-green-500">{cliente.ativos}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{cliente.encerrados}</TableCell>
                      <TableCell className="text-right text-amber-500">{cliente.prazosPendentes}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Processos por Vara */}
        <Card className="animate-slide-up" style={{ animationDelay: "50ms" }}>
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2">
              <Gavel className="w-5 h-5 text-gold" />
              Processos por Vara
            </CardTitle>
            <CardDescription>Distribuição por vara/órgão julgador</CardDescription>
          </CardHeader>
          <CardContent>
            {processosPorVara.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-muted-foreground">
                Nenhum processo com vara informada
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vara</TableHead>
                    <TableHead className="text-right">Processos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processosPorVara.map((item: any) => (
                    <TableRow key={item.vara}>
                      <TableCell className="font-medium truncate max-w-[200px]">{item.vara}</TableCell>
                      <TableCell className="text-right">{item.total}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Duração por Cliente */}
        <Card className="animate-slide-up" style={{ animationDelay: "100ms" }}>
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2">
              <Clock className="w-5 h-5 text-gold" />
              Duração dos Processos por Cliente
            </CardTitle>
            <CardDescription>Média de dias por cliente principal</CardDescription>
          </CardHeader>
          <CardContent>
            {duracaoClientes.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-muted-foreground">
                Nenhum cliente com processos
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Processos</TableHead>
                    <TableHead className="text-right">Média (dias)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {duracaoClientes.map((cliente: any) => (
                    <TableRow key={cliente.nome}>
                      <TableCell className="font-medium truncate max-w-[150px]">{cliente.nome}</TableCell>
                      <TableCell className="text-right">{cliente.processos}</TableCell>
                      <TableCell className="text-right">{cliente.mediaDias}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Atividades por Tarefa */}
        <Card className="animate-slide-up" style={{ animationDelay: "150ms" }}>
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2">
              <FileText className="w-5 h-5 text-gold" />
              Quantidade de Atividades por Tarefa
            </CardTitle>
            <CardDescription>Top 10 tipos de tarefas</CardDescription>
          </CardHeader>
          <CardContent>
            {atividadesPorTarefa.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-muted-foreground">
                Nenhuma atividade cadastrada
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tarefa</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">
                      <CheckCircle className="w-4 h-4 inline text-green-500" />
                    </TableHead>
                    <TableHead className="text-right">
                      <AlertTriangle className="w-4 h-4 inline text-red-500" />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {atividadesPorTarefa.map((tarefa: any) => (
                    <TableRow key={tarefa.titulo}>
                      <TableCell className="font-medium truncate max-w-[150px]">{tarefa.titulo}</TableCell>
                      <TableCell className="text-right">{tarefa.total}</TableCell>
                      <TableCell className="text-right text-green-500">{tarefa.concluidas}</TableCell>
                      <TableCell className="text-right text-red-500">{tarefa.atrasadas}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Produtividade */}
        <Card className="animate-slide-up" style={{ animationDelay: "200ms" }}>
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2">
              <Users className="w-5 h-5 text-gold" />
              Produtividade da Equipe
            </CardTitle>
            <CardDescription>Top advogados por volume de processos</CardDescription>
          </CardHeader>
          <CardContent>
            {produtividadeAdvogados.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-muted-foreground">
                Nenhum advogado com processos atribuídos
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {produtividadeAdvogados.map((adv: any, index: number) => (
                  <div key={adv.nome} className="flex items-center gap-3 p-4 rounded-lg bg-muted/50">
                    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{adv.nome}</p>
                      <p className="text-xs text-muted-foreground">{adv.processos} processos</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
