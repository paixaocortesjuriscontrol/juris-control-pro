import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AtividadeAgenda } from "@/lib/atividadesDaAgenda";

interface Props {
  opcoes: AtividadeAgenda[];
  selecionadas: string[];
  onChange: (v: string[]) => void;
  compacto?: boolean;
}

/** Chips com as atividades que existem na agenda carregada (com quantidade). */
export function AtividadesDaAgendaChips({ opcoes, selecionadas, onChange, compacto }: Props) {
  const [busca, setBusca] = useState("");
  const b = busca.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const visiveis = b ? opcoes.filter((o) => o.chave.includes(b)) : opcoes;
  const toggle = (k: string) =>
    onChange(selecionadas.includes(k) ? selecionadas.filter((x) => x !== k) : [...selecionadas, k]);
  if (opcoes.length === 0)
    return <p className="text-xs text-muted-foreground">Nenhuma tarefa ou prazo na agenda deste período.</p>;
  return (
    <div className="space-y-2">
      {opcoes.length > 8 && (
        <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar atividade…" className="h-7 text-xs" />
      )}
      <div className={cn("flex flex-wrap gap-1.5 overflow-y-auto", compacto ? "max-h-20" : "max-h-48")}>
        {visiveis.map((o) => {
          const ativo = selecionadas.includes(o.chave);
          return (
            <button
              key={o.chave}
              type="button"
              onClick={() => toggle(o.chave)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                ativo ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-muted",
              )}
            >
              {o.cor && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: o.cor }} />}
              {o.nome}
              <span className={cn("font-semibold", ativo ? "" : "text-muted-foreground")}>({o.quantidade})</span>
            </button>
          );
        })}
        {selecionadas.length > 0 && (
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => onChange([])}>Limpar</Button>
        )}
      </div>
    </div>
  );
}
