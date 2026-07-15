import { useState } from "react";
import { Users2, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useProcessoTestemunhas, Testemunha } from "@/hooks/useProcessoTestemunhas";
import { cn } from "@/lib/utils";

interface Props {
  processoId: string;
}

const inputCls = "h-8 text-sm";

function TestemunhaRow({ t }: { t: Testemunha }) {
  const { update, remove } = useProcessoTestemunhas(t.processo_id);
  const [local, setLocal] = useState(t);

  const commit = (field: keyof Testemunha, value: string) => {
    if ((t as any)[field] === value || ((t as any)[field] == null && value === "")) return;
    update.mutate({ id: t.id, patch: { [field]: value } as any });
  };

  return (
    <div className="grid grid-cols-12 gap-2 items-start p-2 rounded-md border border-border/50 bg-background/50">
      <div className="col-span-12 md:col-span-3">
        <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Nome *</label>
        <Input
          className={inputCls}
          value={local.nome || ""}
          onChange={(e) => setLocal({ ...local, nome: e.target.value })}
          onBlur={(e) => commit("nome", e.target.value)}
          maxLength={200}
        />
      </div>
      <div className="col-span-6 md:col-span-2">
        <label className="text-[10px] uppercase tracking-wide text-muted-foreground">CPF/RG</label>
        <Input
          className={inputCls}
          value={local.cpf_rg || ""}
          onChange={(e) => setLocal({ ...local, cpf_rg: e.target.value })}
          onBlur={(e) => commit("cpf_rg", e.target.value)}
          maxLength={20}
        />
      </div>
      <div className="col-span-6 md:col-span-2">
        <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Telefone</label>
        <Input
          className={inputCls}
          value={local.telefone || ""}
          onChange={(e) => setLocal({ ...local, telefone: e.target.value })}
          onBlur={(e) => commit("telefone", e.target.value)}
          maxLength={30}
        />
      </div>
      <div className="col-span-8 md:col-span-2">
        <label className="text-[10px] uppercase tracking-wide text-muted-foreground">E-mail</label>
        <Input
          className={inputCls}
          value={local.email || ""}
          onChange={(e) => setLocal({ ...local, email: e.target.value })}
          onBlur={(e) => commit("email", e.target.value)}
          maxLength={255}
        />
      </div>
      <div className="col-span-4 md:col-span-2">
        <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Arrolada por</label>
        <Input
          className={inputCls}
          value={local.arrolada_por || ""}
          placeholder="Reclamante / Reclamada"
          onChange={(e) => setLocal({ ...local, arrolada_por: e.target.value })}
          onBlur={(e) => commit("arrolada_por", e.target.value)}
          maxLength={100}
        />
      </div>
      <div className="col-span-12 md:col-span-12">
        <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Observações</label>
        <Textarea
          className="text-sm min-h-[50px]"
          value={local.observacoes || ""}
          onChange={(e) => setLocal({ ...local, observacoes: e.target.value })}
          onBlur={(e) => commit("observacoes", e.target.value)}
          maxLength={1000}
        />
      </div>
      <div className="col-span-12 flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-destructive hover:text-destructive"
          onClick={() => {
            if (confirm(`Remover testemunha "${t.nome}"?`)) remove.mutate(t.id);
          }}
        >
          <Trash2 className="w-3.5 h-3.5 mr-1" /> Remover
        </Button>
      </div>
    </div>
  );
}

export function TestemunhasSection({ processoId }: Props) {
  const { testemunhas, isLoading, create } = useProcessoTestemunhas(processoId);
  const [novoNome, setNovoNome] = useState("");

  const adicionar = () => {
    const nome = novoNome.trim();
    if (!nome) return;
    create.mutate({ nome });
    setNovoNome("");
  };

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Users2 className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">Testemunhas</h3>
        <span className="text-xs text-muted-foreground">
          {testemunhas.length > 0 && `(${testemunhas.length})`}
        </span>
      </div>

      <div className="space-y-2">
        {isLoading && (
          <p className="text-xs text-muted-foreground">Carregando…</p>
        )}
        {!isLoading && testemunhas.length === 0 && (
          <p className="text-xs text-muted-foreground italic">Nenhuma testemunha cadastrada.</p>
        )}
        {testemunhas.map((t) => (
          <TestemunhaRow key={t.id} t={t} />
        ))}
      </div>

      <div className="flex gap-2 mt-3">
        <Input
          className={cn(inputCls, "flex-1")}
          placeholder="Nome da nova testemunha…"
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              adicionar();
            }
          }}
          maxLength={200}
        />
        <Button
          type="button"
          size="sm"
          onClick={adicionar}
          disabled={!novoNome.trim() || create.isPending}
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar
        </Button>
      </div>
    </section>
  );
}
