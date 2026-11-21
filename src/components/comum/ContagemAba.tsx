import { cn } from "@/lib/utils";
import { rotuloContagemAba, rotuloParcialAba } from "@/lib/contagensFichaItem";

function Pill({ texto, className }: { texto: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-[18px] shrink-0 items-center justify-center rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary",
        className,
      )}
    >
      {texto}
    </span>
  );
}

/** Total de itens de uma aba. Não aparece quando o total é zero. */
export function ContagemAba({ valor, className }: { valor: number | null | undefined; className?: string }) {
  const texto = rotuloContagemAba(valor);
  if (!texto) return null;
  return <Pill texto={texto} className={className} />;
}

/** Contagem "feitos/total" (ex.: 2/5). Não aparece quando não há itens. */
export function ContagemParcialAba({
  feitos,
  total,
  className,
}: {
  feitos: number | null | undefined;
  total: number | null | undefined;
  className?: string;
}) {
  const texto = rotuloParcialAba(feitos, total);
  if (!texto) return null;
  return <Pill texto={texto} className={className} />;
}
