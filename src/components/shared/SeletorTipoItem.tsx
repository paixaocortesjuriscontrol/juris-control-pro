import type { ReactNode } from "react";
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
  descricao,
  compacto = false,
}: {
  tipo: NovoItemTipo;
  onChange: (t: NovoItemTipo) => void;
  tipos?: NovoItemTipo[];
  /** Aviso exibido na mesma linha, à direita dos botões. */
  descricao?: ReactNode;
  /** Integra o seletor ao cabeçalho do formulário, sem criar uma faixa própria. */
  compacto?: boolean;
}) {
  const opcoes = tipos ? OPCOES.filter((o) => tipos.includes(o.v)) : OPCOES;
  return (
    <div className={cn(
      "flex flex-wrap items-center gap-1",
      compacto ? "min-w-0 flex-1" : "flex-shrink-0 border-b bg-muted/30 px-3 py-2",
    )}>
      <span className="mr-1 shrink-0 text-xs text-muted-foreground">{compacto ? "Alterar para:" : "Tipo:"}</span>
      {opcoes.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={cn(
            "shrink-0 rounded-full border px-2.5 py-0.5 text-xs transition-colors",
            tipo === o.v ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent",
          )}
        >
          {o.l}
        </button>
      ))}
      {descricao && (
        <span className={cn(
          "min-w-0 truncate text-muted-foreground",
          compacto ? "ml-2 flex-1 text-left text-[11px]" : "ml-auto pl-3 text-right text-xs",
        )}>
          {descricao}
        </span>
      )}
    </div>
  );
}
