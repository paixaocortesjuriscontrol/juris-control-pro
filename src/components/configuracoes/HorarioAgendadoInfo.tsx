import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Props {
  horariosExecucao?: string[] | null;
  frequencia?: string;
}

/**
 * Os horários são armazenados em UTC no banco de dados (cron do Supabase usa UTC).
 * Este componente converte para BRT (UTC-3) para exibição.
 * 
 * Exemplo: 02:00 UTC = 23:00 BRT (do dia anterior)
 *          09:00 UTC = 06:00 BRT
 */
export function HorarioAgendadoInfo({ horariosExecucao, frequencia }: Props) {
  if (!horariosExecucao || horariosExecucao.length === 0) {
    return null;
  }

  // Converte horário UTC para BRT (UTC-3)
  // BRT = UTC - 3 horas
  const converterParaBRT = (horarioUtc: string): string => {
    const [horas, minutos] = horarioUtc.split(':').map(Number);
    let horasBrt = horas - 3;
    if (horasBrt < 0) {
      horasBrt += 24;
    }
    return `${String(horasBrt).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;
  };

  const horariosBrt = horariosExecucao.map(converterParaBRT);

  const getFrequenciaLabel = () => {
    switch (frequencia) {
      case 'diario':
        return 'Diário';
      case '2x_dia':
        return '2x/dia';
      case 'semanal':
        return 'Semanal';
      default:
        return '';
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm p-3 rounded-lg bg-muted/50 border">
      <Clock className="h-4 w-4 text-primary" />
      <span className="text-muted-foreground">Próximo agendamento:</span>
      {horariosBrt.map((h, i) => (
        <Badge key={i} variant="secondary" className="font-mono text-primary font-semibold">
          {h} BRT
        </Badge>
      ))}
      {frequencia && (
        <span className="text-xs text-muted-foreground">({getFrequenciaLabel()})</span>
      )}
    </div>
  );
}
