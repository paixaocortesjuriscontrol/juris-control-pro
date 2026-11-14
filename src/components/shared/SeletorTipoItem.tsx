import { cn } from "@/lib/utils";
import type { NovoItemTipo } from "@/components/shared/NovoItemPanel";

const OPCOES: { v: NovoItemTipo; l: string }[] = [
  { v: "tarefa", l: "Tarefa" },
  { v: "prazo", l: "Prazo" },
  { v: "evento", l: "Evento" },
  { v: "audiencia", l: "Audiência" },
  { v: "ata", l: "Ata" },
  { v: "parcelamento", l: "Parcelamento" },
];

/** Troca o tipo do item, com opções restritas quando a edição usa a mesma tabela. */
export function SeletorTipoItem({
  tipo,
  onChange,
  tipos,
}: {
  tipo: NovoItemTipo;
  onChange: (t: NovoItemTipo) => void;
  tipos?: NovoItemTipo[];
}) {
  const opcoes = tipos ? OPCOES.filter((o) => tipos.includes(o.v)) : OPCOES;
  return (
    <div className="flex flex-wrap items-center gap-1 px-3 py-2 border-b bg-muted/30 flex-shrink-0">
      <span className="text-xs text-muted-foreground mr-1">Tipo:</span>
      {opcoes.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={cn(
            "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
            tipo === o.v ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent",
          )}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}
