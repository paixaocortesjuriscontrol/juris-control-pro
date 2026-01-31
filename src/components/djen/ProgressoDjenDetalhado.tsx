import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Check, Circle, Loader2, AlertCircle, ChevronDown, ChevronRight, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

export type TipoTermo = 'advogado' | 'palavra-chave' | 'processo';
export type StatusFase = 'pendente' | 'executando' | 'concluido' | 'erro';

export interface FaseTermo {
  total: number;
  processados: number;
  status: StatusFase;
  termoAtual?: string;
}

export interface ProgressoCoordenacao {
  coordenacaoId: string;
  coordenacaoNome: string;
  status: StatusFase;
  advogados: FaseTermo;
  palavrasChave: FaseTermo;
  processos: FaseTermo;
  novas: number;
  duplicadas: number;
}

export interface ProgressoDetalhadoProps {
  coordenacoes: ProgressoCoordenacao[];
  coordenacaoAtualId?: string;
  tipoAtual?: TipoTermo;
  termoAtual?: string;
  totalNovas: number;
  totalDuplicadas: number;
  totalDescartadas?: number;
  tempoDecorrido: number;
  percentualGeral: number;
  executando: boolean;
}

const StatusIcon = ({ status }: { status: StatusFase }) => {
  switch (status) {
    case 'concluido':
      return <Check className="h-4 w-4 text-emerald-500" />;
    case 'executando':
      return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
    case 'erro':
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    default:
      return <Circle className="h-4 w-4 text-muted-foreground/40" />;
  }
};

const FaseProgress = ({ 
  label, 
  fase, 
  isActive 
}: { 
  label: string; 
  fase: FaseTermo; 
  isActive: boolean;
}) => {
  const percent = fase.total > 0 ? Math.round((fase.processados / fase.total) * 100) : 0;
  
  if (fase.total === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <StatusIcon status="concluido" />
        <span>{label}: 0</span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <StatusIcon status={fase.status} />
          <span className={cn(isActive && "font-medium text-primary")}>
            {label}: {fase.processados}/{fase.total}
          </span>
        </div>
        {fase.status === 'executando' && fase.termoAtual && (
          <span className="text-muted-foreground truncate max-w-[120px]" title={fase.termoAtual}>
            "{fase.termoAtual}"
          </span>
        )}
      </div>
      {fase.status === 'executando' && (
        <Progress value={percent} className="h-1" />
      )}
    </div>
  );
};

const CoordenacaoItem = ({ 
  coord, 
  isActive,
  tipoAtual 
}: { 
  coord: ProgressoCoordenacao; 
  isActive: boolean;
  tipoAtual?: TipoTermo;
}) => {
  const [open, setOpen] = useState(isActive);
  
  const totalTermos = coord.advogados.total + coord.palavrasChave.total + coord.processos.total;
  const processadosTermos = coord.advogados.processados + coord.palavrasChave.processados + coord.processos.processados;
  const percentCoord = totalTermos > 0 ? Math.round((processadosTermos / totalTermos) * 100) : 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full">
        <div className={cn(
          "flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors",
          isActive && "bg-primary/5 border border-primary/20"
        )}>
          <div className="flex items-center gap-2">
            <StatusIcon status={coord.status} />
            <span className={cn(
              "font-medium text-sm",
              coord.status === 'pendente' && "text-muted-foreground"
            )}>
              {coord.coordenacaoNome}
            </span>
            {isActive && (
              <Badge variant="secondary" className="text-[10px] py-0">
                Atual
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {coord.status !== 'pendente' && (
              <span className="text-xs text-muted-foreground">
                {coord.novas > 0 && (
                  <span className="text-emerald-600 mr-1">{coord.novas} novas</span>
                )}
                {coord.duplicadas > 0 && (
                  <span className="text-amber-600">{coord.duplicadas} dup.</span>
                )}
              </span>
            )}
            {open ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </CollapsibleTrigger>
      
      <CollapsibleContent>
        <div className="pl-6 pr-2 py-2 space-y-2 border-l-2 border-muted ml-2">
          <FaseProgress 
            label="Advogados" 
            fase={coord.advogados}
            isActive={isActive && tipoAtual === 'advogado'}
          />
          <FaseProgress 
            label="Palavras-chave" 
            fase={coord.palavrasChave}
            isActive={isActive && tipoAtual === 'palavra-chave'}
          />
          <FaseProgress 
            label="Processos" 
            fase={coord.processos}
            isActive={isActive && tipoAtual === 'processo'}
          />
          
          {coord.status === 'concluido' && (
            <div className="pt-1 border-t border-muted">
              <div className="flex items-center gap-4 text-xs">
                <span>Adv: {coord.advogados.total}</span>
                <span>Termos: {coord.palavrasChave.total}</span>
                <span>Proc: {coord.processos.total}</span>
              </div>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

const formatTempo = (segundos: number): string => {
  const mins = Math.floor(segundos / 60);
  const secs = segundos % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export function ProgressoDjenDetalhado({
  coordenacoes,
  coordenacaoAtualId,
  tipoAtual,
  termoAtual,
  totalNovas,
  totalDuplicadas,
  totalDescartadas = 0,
  tempoDecorrido,
  percentualGeral,
  executando,
}: ProgressoDetalhadoProps) {
  if (!executando && coordenacoes.length === 0) {
    return null;
  }

  const concluidas = coordenacoes.filter(c => c.status === 'concluido').length;
  const comNovas = coordenacoes.filter(c => c.novas > 0).length;

  return (
    <div className="space-y-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
      {/* Header com progresso geral */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {executando ? (
            <Loader2 className="h-4 w-4 text-primary animate-spin" />
          ) : (
            <Check className="h-4 w-4 text-emerald-500" />
          )}
          <span className="font-medium text-sm">
            {executando 
              ? `Processando ${coordenacaoAtualId ? 'coordenações' : ''}...`
              : `Concluído em ${formatTempo(tempoDecorrido)}`
            }
          </span>
        </div>
        <Badge variant="secondary" className="text-xs">
          {concluidas}/{coordenacoes.length} coordenações
        </Badge>
      </div>

      {/* Barra de progresso geral */}
      <Progress value={percentualGeral} className="h-2" />

      {/* Indicador de termo atual */}
      {executando && termoAtual && (
        <div className="flex items-center gap-2 text-xs bg-muted/50 p-2 rounded">
          <Loader2 className="h-3 w-3 animate-spin text-primary" />
          <span className="text-muted-foreground">Buscando:</span>
          <span className="font-medium truncate">{termoAtual}</span>
          {tipoAtual && (
            <Badge variant="outline" className="text-[10px] py-0 ml-auto">
              {tipoAtual === 'advogado' ? 'OAB' : tipoAtual === 'palavra-chave' ? 'Termo' : 'Processo'}
            </Badge>
          )}
        </div>
      )}

      {/* Lista de coordenações */}
      <ScrollArea className={cn(
        "pr-2",
        coordenacoes.length > 4 ? "h-[200px]" : ""
      )}>
        <div className="space-y-1">
          {coordenacoes.map(coord => (
            <CoordenacaoItem
              key={coord.coordenacaoId}
              coord={coord}
              isActive={coord.coordenacaoId === coordenacaoAtualId}
              tipoAtual={coord.coordenacaoId === coordenacaoAtualId ? tipoAtual : undefined}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Footer com estatísticas */}
      <div className="flex items-center justify-between pt-2 border-t border-primary/10">
        <div className="flex items-center gap-4 text-xs">
          <span className="text-emerald-600 font-medium">✓ {totalNovas} novas</span>
          <span className="text-amber-600">↔ {totalDuplicadas} duplicadas</span>
          {totalDescartadas > 0 && (
            <span className="text-red-500">✗ {totalDescartadas} descartadas</span>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{formatTempo(tempoDecorrido)}</span>
        </div>
      </div>
    </div>
  );
}
