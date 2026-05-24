import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  useTurmasTst,
  useRelatoresTst,
  useUpsertTurmaTst,
  useUpsertRelatorTst,
  type ClassificacaoTst,
} from "@/hooks/useClassificacaoTst";

type Tipo = "relator" | "turma";

interface Props {
  tipo: Tipo;
  value: string | null | undefined;
  onChange: (v: string) => void;
  className?: string;
}

/** Combobox com pesquisa + opção "Cadastrar novo" para Relator/Turma TST.
 *  Lista vem das tabelas `classificacao_relatores_tst` / `classificacao_turmas_tst`.
 *  Permite cadastrar entradas novas direto pela tela. */
export function RelatorTurmaCombo({ tipo, value, onChange, className }: Props) {
  const turmas = useTurmasTst();
  const relatores = useRelatoresTst();
  const upsertTurma = useUpsertTurmaTst();
  const upsertRelator = useUpsertRelatorTst();

  const lista = tipo === "turma" ? (turmas.data ?? []) : (relatores.data ?? []);
  const options = useMemo(
    () =>
      lista
        .map((x: any) => ({ id: x.id as string, nome: String(x.nome || "") }))
        .filter((x) => x.nome.trim().length > 0)
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [lista],
  );

  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novaClass, setNovaClass] = useState<ClassificacaoTst>("POSITIVO");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    const nome = novoNome.trim();
    if (!nome) return;
    setSaving(true);
    try {
      if (tipo === "turma") {
        await upsertTurma.mutateAsync({ nome, classificacao: novaClass });
      } else {
        await upsertRelator.mutateAsync({ nome, classificacao: novaClass });
      }
      onChange(nome);
      setCreateOpen(false);
      setNovoNome("");
      setNovaClass("POSITIVO");
    } finally {
      setSaving(false);
    }
  };

  const label = tipo === "turma" ? "turma" : "relator";

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            className={cn("w-full justify-between font-normal", !value && "text-muted-foreground", className)}
          >
            <span className="truncate">{value || `Selecione ${label}…`}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder={`Pesquisar ${label}…`} />
            <CommandList>
              <CommandEmpty>Nenhum resultado.</CommandEmpty>
              <CommandGroup>
                {options.map((opt) => (
                  <CommandItem
                    key={opt.id}
                    value={opt.nome}
                    onSelect={() => {
                      onChange(opt.nome);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === opt.nome ? "opacity-100" : "opacity-0")} />
                    {opt.nome}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandGroup heading="">
                <CommandItem
                  value="__novo__"
                  onSelect={() => {
                    setOpen(false);
                    setCreateOpen(true);
                  }}
                  className="text-primary"
                >
                  <Plus className="mr-2 h-4 w-4" /> Cadastrar novo {label}
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastrar {tipo === "turma" ? "nova turma" : "novo relator"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Classificação</Label>
              <Select value={novaClass} onValueChange={(v) => setNovaClass(v as ClassificacaoTst)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="POSITIVO">POSITIVO</SelectItem>
                  <SelectItem value="NEGATIVO">NEGATIVO</SelectItem>
                  <SelectItem value="IMPEDIDA">IMPEDIDA</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={saving || !novoNome.trim()}>
              Cadastrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
