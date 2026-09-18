import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  CobrancaBadge,
  SIMBOLOS_COBRANCA,
  getSimboloCobrancaPreferido,
  setSimboloCobrancaPreferido,
} from "@/components/comum/CobrancaBadge";
import { useRegistrarCobranca, type InfoCobranca, tituloCobranca } from "@/hooks/useCobrancasItens";

interface Props {
  itemId: string;
  tipoItem: string;
  info?: InfoCobranca | null;
  /** Compacto: só a bolinha (para linhas de lista). */
  compacto?: boolean;
  className?: string;
}

/**
 * Botão de um clique para marcar "já cobrei" no item. Clicar de novo desfaz a
 * cobrança de hoje. O símbolo é escolhido no menu (seta ao lado).
 */
export function CobrancaBotao({ itemId, tipoItem, info, compacto = false, className }: Props) {
  const { registrar, desfazerHoje } = useRegistrarCobranca();
  const [simbolo, setSimbolo] = useState(getSimboloCobrancaPreferido());
  const [aberto, setAberto] = useState(false);
  const ocupado = registrar.isPending || desfazerHoje.isPending;

  const alternar = async (simboloEscolhido?: string) => {
    try {
      if (info?.minhaHoje && !simboloEscolhido) {
        await desfazerHoje.mutateAsync({ itemId });
        toast.success("Cobrança de hoje desfeita");
        return;
      }
      const s = simboloEscolhido || simbolo;
      await registrar.mutateAsync({ itemId, tipoItem, simbolo: s });
      toast.success("Cobrança registrada");
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível registrar a cobrança");
    }
  };

  const titulo = info ? tituloCobranca(info) : "Marcar que você já cobrou este item";

  if (compacto) {
    return (
      <button
        type="button"
        title={titulo}
        disabled={ocupado}
        className={cn("shrink-0", className)}
        onClick={(e) => {
          e.stopPropagation();
          void alternar();
        }}
      >
        {info ? (
          <CobrancaBadge simbolo={info.simbolo} hoje={info.hoje} title={titulo} />
        ) : (
          <CobrancaBadge simbolo={simbolo} title={titulo} className="opacity-30" />
        )}
      </button>
    );
  }

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Button
        type="button"
        size="sm"
        variant={info?.minhaHoje ? "default" : "outline"}
        disabled={ocupado}
        onClick={(e) => {
          e.stopPropagation();
          void alternar();
        }}
        title={titulo}
        className="h-7 gap-1.5 text-xs"
      >
        <CobrancaBadge simbolo={info?.simbolo ?? simbolo} hoje={!!info?.hoje} />
        {info?.minhaHoje ? "Cobrado hoje" : "Cobrei"}
      </Button>
      <Popover open={aberto} onOpenChange={setAberto}>
        <PopoverTrigger asChild>
          <Button type="button" size="sm" variant="ghost" className="h-7 px-1.5 text-xs" title="Escolher símbolo">
            ▾
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <p className="text-[11px] text-muted-foreground mb-1.5">Símbolo da cobrança</p>
          <div className="flex flex-wrap gap-1 max-w-[180px]">
            {SIMBOLOS_COBRANCA.map((s) => (
              <Button
                key={s}
                type="button"
                size="sm"
                variant={s === simbolo ? "default" : "outline"}
                className="h-7 w-7 p-0 text-xs"
                onClick={() => {
                  setSimbolo(s);
                  setSimboloCobrancaPreferido(s);
                  setAberto(false);
                  void alternar(s);
                }}
              >
                {s}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
