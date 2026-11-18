import { supabase } from "@/integrations/supabase/client";
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
  rotulosPartes?: { ativo: string; passivo: string };
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
  rotulosPartes = { ativo: "Reclamante", passivo: "Reclamada" },
  corHeader,
  children,
  className,
}: ItemDrawerProps) {
  const colorido = Boolean(corHeader);
  const [idResolvido, setIdResolvido] = useState<string | null>(null);
  useEffect(() => {
    setIdResolvido(null);
    if (processoId || !processoNumero || !open) return;
    const digitos = processoNumero.replace(/\D/g, "");
    let vivo = true;
    supabase.from("processos").select("id").in("numero", Array.from(new Set([processoNumero, digitos]))).limit(1)
      .then(({ data }) => { if (vivo && data?.[0]?.id) setIdResolvido(data[0].id); });
    return () => { vivo = false; };
  }, [processoId, processoNumero, open]);
  processoId = processoId || idResolvido;
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
                    className="inline-flex h-8 min-w-0 items-center gap-1.5 rounded-md border border-current/25 bg-background/40 px-2.5 text-xs font-normal underline-offset-4 transition-colors hover:bg-background/70 hover:underline"
                    title="Abrir processo em uma nova aba"
                    aria-label={`Abrir processo ${processoNumero || ""} em uma nova aba`}
                  >
                    <span className="break-all">{processoNumero || "Abrir processo"}</span>
                    <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                  </a>
                ) : (
                  <span className="inline-flex h-8 items-center break-all rounded-md border border-current/25 bg-background/40 px-2.5 text-xs font-normal">
                    {processoNumero}
                  </span>
                )}
                {processoNumero && (
                  <button
                    type="button"
                    onClick={copiarProcesso}
                    className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-current/25 bg-background/40 transition-colors hover:bg-background/70"
                    title="Copiar número do processo"
                    aria-label="Copiar número do processo"
                  >
                    {copiado ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                )}
                {processoId && (
                  <a
                    href={`/processos/${encodeURIComponent(processoId)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-normal underline-offset-4 hover:underline"
                  >
                    Abrir processo
                  </a>
                )}
              </div>
            )}
            {(partes?.ativo || partes?.passivo) && (
              <div className={cn("mt-1 space-y-0.5 text-[11px] leading-snug", colorido ? "opacity-80" : "text-primary-foreground/80")}>
                {partes.ativo && (
                  <p className="break-words"><strong>{rotulosPartes.ativo}:</strong> {partes.ativo}</p>
                )}
                {partes.passivo && (
                  <p className="break-words"><strong>{rotulosPartes.passivo}:</strong> {partes.passivo}</p>
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
