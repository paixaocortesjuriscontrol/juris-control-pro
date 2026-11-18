import { useEffect, useState } from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { Check, Copy, ExternalLink, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ItemDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titulo: string;
  subtitulo?: string | null;
  processoId?: string | null;
  processoNumero?: string | null;
  partes?: { ativo: string; passivo: string } | null;
  /** Fundo do cabeçalho na cor do tipo (prazo vermelho, audiência amarelo...). */
  corHeader?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Painel sobreposto que desliza da direita, mantendo a lista/calendário
 * visíveis ao fundo. Fecha por X, Esc ou clique fora.
 */
// Clicar no aviso do canto ("Confirmar e salvar") não pode fechar o painel.
const ignorarCliqueEmAviso = (e: Event) => {
  const alvo = e.target as HTMLElement | null;
  if (alvo?.closest?.("[data-sonner-toaster], [data-sonner-toast]")) e.preventDefault();
};

export function ItemDrawer({
  open,
  onOpenChange,
  titulo,
  subtitulo,
  processoId,
  processoNumero,
  partes,
  corHeader,
  children,
  className,
}: ItemDrawerProps) {
  const colorido = Boolean(corHeader);
  const temProcesso = Boolean(processoId || processoNumero);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => setCopiado(false), [processoId, processoNumero]);

  const copiarProcesso = async () => {
    if (!processoNumero) return;
    try {
      await navigator.clipboard.writeText(processoNumero);
      setCopiado(true);
      toast.success("Número do processo copiado");
      window.setTimeout(() => setCopiado(false), 1500);
    } catch {
      toast.error("Não foi possível copiar o número do processo");
    }
  };

  return (
    <SheetPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <SheetPrimitive.Portal>
        <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/40 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <SheetPrimitive.Content
          onInteractOutside={ignorarCliqueEmAviso}
          onPointerDownOutside={ignorarCliqueEmAviso}
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex h-full w-full flex-col bg-background shadow-2xl outline-none",
            "sm:w-[min(720px,94vw)] lg:w-[720px]",
            "transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-200 data-[state=open]:duration-300 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
            className,
          )}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className={cn("relative flex-shrink-0 px-4 py-3 pr-14", colorido ? corHeader : "bg-primary text-primary-foreground")}>
            <SheetPrimitive.Title className="truncate text-base font-bold leading-tight">
              {titulo}
            </SheetPrimitive.Title>
            {temProcesso ? (
              <SheetPrimitive.Description className="sr-only">
                Processo {processoNumero || "vinculado"}
              </SheetPrimitive.Description>
            ) : subtitulo ? (
              <SheetPrimitive.Description className={cn("mt-0.5 truncate font-mono text-[11px]", colorido ? "opacity-75" : "text-primary-foreground/70")}>
                {subtitulo}
              </SheetPrimitive.Description>
            ) : (
              <SheetPrimitive.Description className="sr-only">Detalhes do item</SheetPrimitive.Description>
            )}
            {temProcesso && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {processoId ? (
                  <a
                    href={`/processos/${encodeURIComponent(processoId)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-w-0 items-center gap-2 rounded-md border border-current/25 bg-background/40 px-2.5 py-1.5 font-mono text-sm font-bold tracking-wide underline-offset-4 transition-colors hover:bg-background/70 hover:underline sm:text-base"
                    title="Abrir processo em uma nova aba"
                    aria-label={`Abrir processo ${processoNumero || ""} em uma nova aba`}
                  >
                    <span className="break-all">{processoNumero || "Abrir processo"}</span>
                    <ExternalLink className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                  </a>
                ) : (
                  <span className="break-all rounded-md border border-current/25 bg-background/40 px-2.5 py-1.5 font-mono text-sm font-bold tracking-wide sm:text-base">
                    {processoNumero}
                  </span>
                )}
                {processoNumero && (
                  <button
                    type="button"
                    onClick={copiarProcesso}
                    className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md border border-current/25 bg-background/40 transition-colors hover:bg-background/70"
                    title="Copiar número do processo"
                    aria-label="Copiar número do processo"
                  >
                    {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </button>
                )}
                {processoId && <span className="text-xs font-medium opacity-80">Abrir processo em nova aba</span>}
              </div>
            )}
            {(partes?.ativo || partes?.passivo) && (
              <div className={cn("mt-1 space-y-0.5 text-[11px] leading-snug", colorido ? "opacity-80" : "text-primary-foreground/80")}>
                {partes.ativo && (
                  <p className="break-words"><strong>Reclamante:</strong> {partes.ativo}</p>
                )}
                {partes.passivo && (
                  <p className="break-words"><strong>Reclamada:</strong> {partes.passivo}</p>
                )}
              </div>
            )}
            <SheetPrimitive.Close
              className={cn("absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-md transition-colors", colorido ? "bg-foreground/10 hover:bg-foreground/20" : "bg-primary-foreground/15 hover:bg-primary-foreground/25")}
              title="Fechar"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Fechar</span>
            </SheetPrimitive.Close>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
        </SheetPrimitive.Content>
      </SheetPrimitive.Portal>
    </SheetPrimitive.Root>
  );
}
