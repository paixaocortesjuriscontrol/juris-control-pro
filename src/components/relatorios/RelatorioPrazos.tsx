import { Clock, RefreshCw, AlertCircle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useRelatorioPrazosData } from "@/hooks/useRelatorioPrazosData";

interface RelatorioPrazosProps {
  isActive: boolean;
}

export function RelatorioPrazos({ isActive }: RelatorioPrazosProps) {
  const { data, isLoading, isError, refetch, isFetching } = useRelatorioPrazosData(isActive);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 mb-4">
          <Progress value={50} className="h-2 flex-1 max-w-xs" />
          <span className="text-xs text-muted-foreground">Carregando prazos...</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
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
              <p className="font-medium text-lg">Erro ao carregar prazos</p>
              <p className="text-sm text-muted-foreground mt-1">
                Tente novamente.
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
    totalPrazos: rawTotal,
    prazosStatus = [],
    prazosCumpridos: rawCumpridos,
    prazosPendentes: rawPendentes,
    prazosAtrasados: rawAtrasados,
  } = data || {};

  const totalPrazos = Number(rawTotal) || 0;
  const prazosCumpridos = Number(rawCumpridos) || 0;
  const prazosPendentes = Number(rawPendentes) || 0;
  const prazosAtrasados = Number(rawAtrasados) || 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cards de Status */}
        <Card className="animate-slide-up">
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2">
              <Clock className="w-5 h-5 text-gold" />
              Controle de Prazos
            </CardTitle>
            <CardDescription>Visão geral dos prazos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 rounded-lg bg-green-500/10">
                <p className="text-2xl sm:text-3xl font-bold text-green-500">{prazosCumpridos}</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">Cumpridos</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-amber-500/10">
                <p className="text-2xl sm:text-3xl font-bold text-amber-500">{prazosPendentes}</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">Pendentes</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-red-500/10">
                <p className="text-2xl sm:text-3xl font-bold text-red-500">{prazosAtrasados}</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">Atrasados</p>
              </div>
            </div>
            <div className="h-4 rounded-full overflow-hidden bg-muted flex">
              {prazosStatus.map((status) => {
                const total = prazosStatus.reduce((acc, s) => acc + s.value, 0);
                const percentage = total > 0 ? (status.value / total) * 100 : 0;
                return (
                  <div 
                    key={status.name}
                    className="h-full"
                    style={{ 
                      width: `${percentage}%`,
                      backgroundColor: status.color,
                    }}
                  />
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Taxa de Conclusão */}
        <Card className="animate-slide-up" style={{ animationDelay: "50ms" }}>
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2">
              <Clock className="w-5 h-5 text-gold" />
              Taxa de Cumprimento
            </CardTitle>
            <CardDescription>Percentual de prazos cumpridos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center h-48">
              <div className="relative">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="none"
                    className="text-muted"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="#22C55E"
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={`${totalPrazos > 0 ? (prazosCumpridos / totalPrazos) * 352 : 0} 352`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-3xl font-bold">
                    {totalPrazos > 0 ? ((prazosCumpridos / totalPrazos) * 100).toFixed(0) : 0}%
                  </span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                {prazosCumpridos} de {totalPrazos} prazos cumpridos
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
