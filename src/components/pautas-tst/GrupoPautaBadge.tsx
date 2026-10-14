import { cn } from "@/lib/utils";
import { grupoDaPauta, ROTULO_GRUPO } from "@/lib/pautasGrupo";

export function GrupoPautaBadge({ equipe, processo, className }: { equipe?: string | null; processo?: string | null; className?: string }) {
  const g = grupoDaPauta(equipe, processo);
  return (
    <span
      title={equipe ? `Equipe: ${equipe}` : "Sem equipe"}
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap",
        g === "tatiana" && "bg-grupo-tatiana/15 text-grupo-tatiana",
        g === "renata" && "bg-grupo-renata/15 text-grupo-renata",
        !g && "bg-muted text-muted-foreground",
        className,
      )}
    >
      {g ? ROTULO_GRUPO[g] : "Sem grupo"}
    </span>
  );
}
