import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CAMPOS_MODELO, type CampoModelo } from "@/constants/camposModeloTitulo";
import { MODOS_DATA, montarExprData, parseExprData, resolverData } from "@/lib/aplicarPadroesModelo";
import type { TipoModelo } from "@/hooks/useModelosTitulo";

interface Props {
  tipo: TipoModelo;
  padroes: Record<string, any>;
  onChange: (padroes: Record<string, any>) => void;
}

/** Editor dos preenchimentos padrão sugeridos por um modelo de título. */
export function PadroesModeloEditor({ tipo, padroes, onChange }: Props) {
  const campos = CAMPOS_MODELO[tipo] ?? [];

  const set = (key: string, valor: any) => {
    const next = { ...padroes };
    if (valor === "" || valor === undefined || valor === null) delete next[key];
    else next[key] = valor;
    onChange(next);
  };

  const renderCampo = (campo: CampoModelo) => {
    const valor = padroes?.[campo.key];

    if (campo.kind === "date") {
      const { modo, n } = parseExprData(valor);
      const precisaN = MODOS_DATA.find((m) => m.value === modo)?.precisaN;
      const previa = resolverData(valor);
      return (
        <div className="flex flex-col gap-1">
          <div className="flex gap-2">
            <Select
              value={modo || "__none__"}
              onValueChange={(v) => set(campo.key, v === "__none__" ? "" : montarExprData(v, n))}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Não sugerir" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Não sugerir</SelectItem>
                {MODOS_DATA.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {precisaN && (
              <Input
                type="number"
                min={0}
                className="w-20"
                value={n}
                onChange={(e) => set(campo.key, montarExprData(modo, Number(e.target.value)))}
              />
            )}
          </div>
          {previa && (
            <span className="text-[11px] text-muted-foreground">
              Hoje resultaria em {previa.split("-").reverse().join("/")}
            </span>
          )}
        </div>
      );
    }

    if (campo.kind === "select") {
      return (
        <Select
          value={valor ? String(valor) : "__none__"}
          onValueChange={(v) => set(campo.key, v === "__none__" ? "" : v)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Não sugerir" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Não sugerir</SelectItem>
            {(campo.options ?? []).map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (campo.kind === "bool") {
      return (
        <div className="flex h-10 items-center">
          <Switch checked={valor === true || valor === "true"} onCheckedChange={(c) => set(campo.key, c ? "true" : "")} />
        </div>
      );
    }

    if (campo.kind === "textarea") {
      return (
        <Textarea
          rows={2}
          value={valor ?? ""}
          placeholder={campo.placeholder ?? "Não sugerir"}
          onChange={(e) => set(campo.key, e.target.value)}
        />
      );
    }

    return (
      <Input
        type={campo.kind === "time" ? "time" : campo.kind === "number" ? "number" : "text"}
        value={valor ?? ""}
        placeholder={campo.placeholder ?? "Não sugerir"}
        onChange={(e) => set(campo.key, e.target.value)}
      />
    );
  };

  if (campos.length === 0) return null;

  return (
    <div className="rounded-md border p-3 space-y-3">
      <div>
        <p className="text-sm font-medium">Preenchimentos padrão</p>
        <p className="text-xs text-muted-foreground">
          Opcional. Os campos preenchidos aqui são sugeridos automaticamente ao escolher este modelo no formulário.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {campos.map((campo) => (
          <div key={campo.key} className={campo.kind === "textarea" ? "md:col-span-2" : undefined}>
            <label className="text-xs text-muted-foreground">{campo.label}</label>
            {renderCampo(campo)}
          </div>
        ))}
      </div>
    </div>
  );
}