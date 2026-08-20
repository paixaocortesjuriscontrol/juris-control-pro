import { AudienciaDetectada } from "@/hooks/useAudienciasDetectadas";
import { differenceInDays, parseISO, isValid, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, FileText, MapPin, Building, Eye, Pencil, CheckCircle, XCircle, ListChecks, MoreVertical } from "lucide-react";
import { TratadoCheck, isItemTratado } from "@/components/shared/TratadoCheck";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AudienciaVinculoBadges } from "./AudienciaVinculoBadges";

interface Props {
  audiencia: AudienciaDetectada;
  onDetalhes: (a: AudienciaDetectada) => void;
  onEditar: (a: AudienciaDetectada) => void;
  onCriarTarefa: (a: AudienciaDetectada) => void;
  onMarcarTratado: (id: string) => void;
  onIgnorar: (id: string) => void;
  isPending: boolean;
}

export function AudienciaKanbanCard({ audiencia, onDetalhes, onEditar, onCriarTarefa, onMarcarTratado, onIgnorar, isPending }: Props) {
  const daysUntil = getDaysUntil(audiencia.data_audiencia);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "S/D";
    try {
      const date = parseISO(dateStr);
      if (!isValid(date)) return "S/D";
      return format(date, "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pendente':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 text-[10px] px-1.5 py-0">⏳</Badge>;
      case 'confirmado':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-[10px] px-1.5 py-0">✅</Badge>;
      case 'tratado':
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 text-[10px] px-1.5 py-0">✔️</Badge>;
      case 'cancelado':
        return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20 text-[10px] px-1.5 py-0">❌</Badge>;
      case 'ignorado':
        return <Badge variant="outline" className="bg-muted text-muted-foreground text-[10px] px-1.5 py-0">🚫</Badge>;
      default:
        return null;
    }
  };

  const tratado = isItemTratado(audiencia);

  return (
    <div className={`rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow space-y-2 ${tratado ? 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800' : 'bg-card border border-border'}`}>
      {/* Header: processo + urgency badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <TratadoCheck tratado={isItemTratado(audiencia)} />
          <p className="text-xs font-mono font-semibold text-foreground truncate">
            {audiencia.processo_numero || "Sem nº"}
          </p>
        </div>
        {getStatusBadge(audiencia.status)}
      </div>

      {/* Date, time and urgency badge — sempre visíveis */}
      <div className="flex items-center gap-1.5 text-xs flex-wrap bg-muted/40 rounded px-1.5 py-1">
        <Calendar className="w-3.5 h-3.5 text-primary" />
        <span className="font-semibold text-foreground">{formatDate(audiencia.data_audiencia)}</span>
        {audiencia.hora && <span className="font-medium text-foreground">às {audiencia.hora}</span>}
        <Badge variant={daysUntil !== null && daysUntil <= 1 ? "destructive" : "secondary"} className="text-[10px] px-1.5 py-0 leading-tight ml-auto">
          {daysUntil === null ? "S/D" : daysUntil <= 0 ? "VENCIDO" : `${daysUntil}d`}
        </Badge>
      </div>

      {/* Modalidade + Type */}
      <div className="flex items-center gap-1 flex-wrap">
        {audiencia.modalidade && (
          <Badge variant={audiencia.modalidade === "Presencial" ? "destructive" : "secondary"} className="text-[10px]">
            {audiencia.modalidade}
          </Badge>
        )}
        {audiencia.tipo_audiencia && (
          <Badge variant="secondary" className="text-[10px]">{audiencia.tipo_audiencia}</Badge>
        )}
      </div>

      {/* Vínculo com audiência anterior / nova audiência designada */}
      <AudienciaVinculoBadges
        audienciaId={audiencia.id}
        originadaDe={(audiencia as any).originada_de ?? null}
        compact
      />

      {/* Cliente */}
      {audiencia.cliente && (
        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
          <Building className="w-3 h-3 shrink-0" /> {audiencia.cliente}
        </p>
      )}

      {/* Vara/Comarca */}
      {(audiencia.vara_camara || audiencia.comarca) && (
        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
          <MapPin className="w-3 h-3 shrink-0" /> {[audiencia.vara_camara, audiencia.comarca].filter(Boolean).join(' - ')}
        </p>
      )}

      {/* Advogado */}
      {audiencia.advogado && (
        <p className="text-[10px] text-muted-foreground truncate">Adv: {audiencia.advogado}</p>
      )}

      {/* Actions */}
      <div className="pt-1 border-t border-border" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-full text-[10px] text-primary">
              <MoreVertical className="w-3 h-3 mr-1" /> Ações
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onDetalhes(audiencia)}>
              <Eye className="h-4 w-4 mr-2" /> Detalhes
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onEditar(audiencia)}>
              <Pencil className="h-4 w-4 mr-2" /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onCriarTarefa(audiencia)}>
              <ListChecks className="h-4 w-4 mr-2" /> Criar Tarefa
            </DropdownMenuItem>
            {audiencia.status === 'pendente' && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => onMarcarTratado(audiencia.id)} disabled={isPending}>
                  <CheckCircle className="h-4 w-4 mr-2 text-green-600" /> Marcar Tratado
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onIgnorar(audiencia.id)} disabled={isPending}>
                  <XCircle className="h-4 w-4 mr-2 text-muted-foreground" /> Ignorar
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export function getDaysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  try {
    const date = parseISO(dateStr);
    if (!isValid(date)) return null;
    return differenceInDays(date, new Date());
  } catch {
    return null;
  }
}
