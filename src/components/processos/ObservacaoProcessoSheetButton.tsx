import { useState } from "react";
import { MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ObservacaoProcessoEditor } from "./ObservacaoProcessoEditor";

interface Props {
  processoId: string;
  processoNumero?: string | null;
}

/** Ação da Análise DJEN: edita o processo sem alterar a leitura da publicação. */
export function ObservacaoProcessoSheetButton({ processoId, processoNumero }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-auto flex-shrink-0 gap-1 px-1 py-0 text-[10px] text-muted-foreground hover:text-primary md:text-xs"
        title="Inserir ou editar a observação do processo"
        aria-label={`Observação do processo ${processoNumero || ""}`.trim()}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
      >
        <MessageSquareText className="h-3 w-3" />
        <span className="hidden sm:inline">Observação</span>
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
          <SheetHeader className="border-b border-border px-5 py-4 pr-12 text-left">
            <SheetTitle className="flex items-center gap-2">
              <MessageSquareText className="h-5 w-5" /> Observação do advogado
            </SheetTitle>
            <SheetDescription>
              {processoNumero ? `Processo ${processoNumero}. ` : ""}
              Insira ou edite a observação sem alterar a publicação.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {open && (
              <ObservacaoProcessoEditor
                key={processoId}
                processoId={processoId}
                autoFocus
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
