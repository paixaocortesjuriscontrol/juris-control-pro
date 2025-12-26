import { RefreshCw, Database, Cloud } from "lucide-react";
import { Button } from "./button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";
import { cn } from "@/lib/utils";

interface CacheIndicatorProps {
  isFetching: boolean;
  isStale: boolean;
  dataUpdatedAt: number;
  onRefresh: () => void;
  className?: string;
}

export function CacheIndicator({
  isFetching,
  isStale,
  dataUpdatedAt,
  onRefresh,
  className,
}: CacheIndicatorProps) {
  const isFromCache = !isFetching && dataUpdatedAt > 0;
  const lastUpdate = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {isFetching ? (
              <>
                <Cloud className="h-3.5 w-3.5 animate-pulse text-blue-500" />
                <span className="text-blue-500">Atualizando...</span>
              </>
            ) : isFromCache ? (
              <>
                <Database className={cn("h-3.5 w-3.5", isStale ? "text-amber-500" : "text-green-500")} />
                <span className={isStale ? "text-amber-500" : "text-green-500"}>
                  {isStale ? "Cache antigo" : "Cache"}
                </span>
              </>
            ) : null}
            {lastUpdate && !isFetching && (
              <span className="text-muted-foreground/70">({lastUpdate})</span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {isFetching
            ? "Buscando dados da API..."
            : isStale
            ? "Dados em cache podem estar desatualizados"
            : "Dados carregados do cache local"}
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onRefresh}
            disabled={isFetching}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Forçar atualização</TooltipContent>
      </Tooltip>
    </div>
  );
}
