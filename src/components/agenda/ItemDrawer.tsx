import * as SheetPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ItemDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titulo: string;
  subtitulo?: string | null;
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
  partes,
  corHeader,
  children,
  className,
}: ItemDrawerProps) {
  const colorido = Boolean(corHeader);
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
            {subtitulo ? (
              <SheetPrimitive.Description className={cn("mt-0.5 truncate font-mono text-[11px]", colorido ? "opacity-75" : "text-primary-foreground/70")}>
                {subtitulo}
              </SheetPrimitive.Description>
            ) : (
              <SheetPrimitive.Description className="sr-only">Detalhes do item</SheetPrimitive.Description>
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
