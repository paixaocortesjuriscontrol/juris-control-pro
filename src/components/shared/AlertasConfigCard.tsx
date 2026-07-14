import { Bell } from "lucide-react";

/**
 * Card informativo mostrado nos formulários de Tarefa, Prazo, Evento e Audiência,
 * no lugar dos antigos campos "alerta X dias/horas antes".
 *
 * A configuração de quando e como receber lembretes é feita centralmente
 * pelo botão "Notificações" do Painel de Controle.
 */
export function AlertasConfigCard() {
  return (
    <div className="rounded-md border border-primary/20 bg-primary/5 p-3 flex items-start gap-3">
      <Bell className="h-4 w-4 text-primary mt-0.5 shrink-0" />
      <div className="text-xs text-muted-foreground leading-relaxed">
        <div className="font-medium text-foreground mb-0.5">Alertas configuráveis</div>
        Configure quando e como receber os lembretes deste item no botão{" "}
        <strong>Notificações</strong> do Painel de Controle.
      </div>
    </div>
  );
}