import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AutoResizeTextarea } from "@/components/ui/auto-resize-textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Search, Tag } from "lucide-react";
import { toast } from "sonner";
import { useAudienciasDetectadas, NovaAudiencia } from "@/hooks/useAudienciasDetectadas";
import { PeoplePicker } from "@/components/shared/PeoplePicker";
import { supabase } from "@/integrations/supabase/client";
import { formatProcessoNumero } from "@/lib/utils";

type Props = {
  defaultProcessoNumero?: string;
  defaultProcessoId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  hideTitleHeader?: boolean;
  showProcessoField?: boolean;
  defaultTitulo?: string;
  defaultObservacoes?: string;
  defaultDataAudiencia?: string;
};

const empty = {
  titulo: "",
  data_audiencia: "",
  hora: "",
  hora_fim: "",
  alerta_valor: 0,
  alerta_unidade: "horas_antes",
  forum: "",
  sala_forum: "",
  local_audiencia: "",
  modalidade: "",
  observacoes: "",
  vara_camara: "",
  comarca: "",
  polo_ativo: "",
  cliente: "",
  terceirizado: "",
};

export function AudienciaFormSimplificado({
  defaultProcessoNumero,
  defaultProcessoId,
  onSuccess,
  onCancel,
  hideTitleHeader,
  showProcessoField = true,
  defaultTitulo,
  defaultObservacoes,
  defaultDataAudiencia,
}: Props) {
  const { criarAudiencia } = useAudienciasDetectadas();
  const [form, setForm] = useState({
    ...empty,
    titulo: defaultTitulo ?? "",
    observacoes: defaultObservacoes ?? "",
    data_audiencia: defaultDataAudiencia ?? "",
  });
  const [situacao, setSituacao] = useState<string>("pendente");
  const [processoNumero, setProcessoNumero] = useState(defaultProcessoNumero ?? "");
  const [processoId, setProcessoId] = useState<string | undefined>(defaultProcessoId);
  const [responsaveisIds, setResponsaveisIds] = useState<string[]>([]);
  const [envolvidosIds, setEnvolvidosIds] = useState<string[]>([]);
  const [mostrarEnvolvidos, setMostrarEnvolvidos] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const autoBuscaRef = useRef(false);

  const set = (field: keyof typeof empty, v: any) =>
    setForm((p) => ({ ...p, [field]: v }));

  const buscarProcesso = async (numero: string, withToast = true) => {
    setBuscando(true);
    try {
      const numeroDigits = numero.replace(/\D/g, "");
      const numeroMasked = formatProcessoNumero(numero);
      const candidatos = Array.from(
        new Set([numeroMasked, numero, numeroDigits].filter(Boolean))
      );
      const orExpr = candidatos.map((c) => `numero.ilike.%${c}%`).join(",");
      const { data } = await supabase
        .from("processos")
        .select("id, numero, vara, comarca")
        .or(orExpr)
        .limit(1)
        .maybeSingle();
      if (!data) {
        if (withToast) toast.error("Processo não encontrado");
        return;
      }
      setProcessoNumero(data.numero ?? numero);
      setProcessoId(data.id);
      if (withToast) toast.success("Processo encontrado");
    } finally {
      setBuscando(false);
    }
  };

  useEffect(() => {
    if (defaultProcessoNumero && !autoBuscaRef.current) {
      autoBuscaRef.current = true;
      buscarProcesso(defaultProcessoNumero, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultProcessoNumero]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim()) {
      toast.error("Informe o título da audiência");
      return;
    }
    if (!form.data_audiencia) {
      toast.error("Informe a data");
      return;
    }
    if (responsaveisIds.length === 0) {
      toast.error("Selecione ao menos um responsável");
      return;
    }

    const payload: NovaAudiencia = {
      processo_id: processoId,
      processo_numero: processoNumero || "",
      titulo: form.titulo.trim(),
      data_audiencia: form.data_audiencia,
      hora: form.hora || undefined,
      hora_fim: form.hora_fim || undefined,
      alerta_valor: form.alerta_valor > 0 ? Number(form.alerta_valor) : undefined,
      alerta_unidade: form.alerta_valor > 0 ? form.alerta_unidade : undefined,
      forum: form.forum || undefined,
      sala_forum: form.sala_forum || undefined,
      local_audiencia: form.local_audiencia || undefined,
      modalidade: form.modalidade || undefined,
      observacoes: form.observacoes || undefined,
      vara_camara: form.vara_camara || undefined,
      comarca: form.comarca || undefined,
      polo_ativo: form.polo_ativo || undefined,
      cliente: form.cliente || undefined,
      terceirizado: form.terceirizado || undefined,
      status: "pendente",
      advogados_ids: responsaveisIds,
      envolvidos_ids: envolvidosIds,
    };

    await criarAudiencia.mutateAsync(payload);
    setForm({ ...empty });
    setResponsaveisIds([]);
    setEnvolvidosIds([]);
    setMostrarEnvolvidos(false);
    onSuccess?.();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!hideTitleHeader && (
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wide text-foreground">
            Audiência
          </h3>
          <Tag className="h-4 w-4 text-muted-foreground" />
        </div>
      )}

      <div className="space-y-1.5">
        <Label className="text-sm">
          Título da audiência<span className="text-destructive">*</span>
        </Label>
        <AutoResizeTextarea
          value={form.titulo}
          onChange={(e) => set("titulo", e.target.value)}
          placeholder="Digite o título da audiência"
          autoFocus
        />
      </div>

      {showProcessoField && (
        <div className="space-y-1.5">
          <Label className="text-sm">Processo</Label>
          <div className="flex gap-2">
            <Input
              value={processoNumero}
              onChange={(e) => setProcessoNumero(e.target.value)}
              placeholder="0000000-00.0000.0.00.0000"
              className="h-10"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={() => processoNumero && buscarProcesso(processoNumero, true)}
              disabled={buscando}
              title="Buscar processo"
            >
              {buscando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-6 space-y-1.5">
          <Label className="text-sm">
            Data<span className="text-destructive">*</span>
          </Label>
          <Input
            type="date"
            value={form.data_audiencia}
            onChange={(e) => set("data_audiencia", e.target.value)}
            className="h-10"
          />
        </div>
        <div className="col-span-3 space-y-1.5">
          <Label className="text-sm">Início</Label>
          <Input
            type="time"
            value={form.hora}
            onChange={(e) => set("hora", e.target.value)}
            className="h-10"
          />
        </div>
        <div className="col-span-3 space-y-1.5">
          <Label className="text-sm">Até</Label>
          <Input
            type="time"
            value={form.hora_fim}
            onChange={(e) => set("hora_fim", e.target.value)}
            className="h-10"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm">Alertas internos de antecedência</Label>
        <div className="flex gap-2 max-w-xs">
          <Input
            type="number"
            min={0}
            value={form.alerta_valor}
            onChange={(e) => set("alerta_valor", parseInt(e.target.value || "0", 10))}
            className="h-10 w-20"
          />
          <Select
            value={form.alerta_unidade}
            onValueChange={(v) => set("alerta_unidade", v)}
          >
            <SelectTrigger className="h-10 flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="minutos_antes">Minuto(s) antes</SelectItem>
              <SelectItem value="horas_antes">Hora(s) antes</SelectItem>
              <SelectItem value="dias_antes">Dia(s) antes</SelectItem>
              <SelectItem value="dias_uteis_antes">Dia(s) úteis antes</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm">Fórum</Label>
          <Input
            value={form.forum}
            onChange={(e) => set("forum", e.target.value)}
            className="h-10"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Sala do fórum</Label>
          <Input
            value={form.sala_forum}
            onChange={(e) => set("sala_forum", e.target.value)}
            className="h-10"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm">Vara / Câmara / Turma</Label>
          <Input
            value={form.vara_camara}
            onChange={(e) => set("vara_camara", e.target.value)}
            className="h-10"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Comarca</Label>
          <Input
            value={form.comarca}
            onChange={(e) => set("comarca", e.target.value)}
            className="h-10"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label className="text-sm">Polo ativo</Label>
          <Input
            value={form.polo_ativo}
            onChange={(e) => set("polo_ativo", e.target.value)}
            className="h-10"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Cliente</Label>
          <Input
            value={form.cliente}
            onChange={(e) => set("cliente", e.target.value)}
            className="h-10"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-sm">Terceirizada</Label>
          <Input
            value={form.terceirizado}
            onChange={(e) => set("terceirizado", e.target.value)}
            className="h-10"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm">Endereço ou local</Label>
        <Input
          value={form.local_audiencia}
          onChange={(e) => set("local_audiencia", e.target.value)}
          className="h-10"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm">Modalidade</Label>
        <Select
          value={form.modalidade || ""}
          onValueChange={(v) => set("modalidade", v)}
        >
          <SelectTrigger className="h-10 max-w-xs">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Presencial">Presencial</SelectItem>
            <SelectItem value="Virtual">Virtual</SelectItem>
            <SelectItem value="Híbrida">Híbrida</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm">Observações</Label>
        <Textarea
          value={form.observacoes}
          onChange={(e) => set("observacoes", e.target.value)}
          placeholder="Digite observações sobre a audiência"
          rows={3}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm">
          Responsáveis<span className="text-destructive">*</span>
        </Label>
        <PeoplePicker
          selectedIds={responsaveisIds}
          onChange={setResponsaveisIds}
          placeholder="Adicionar responsável"
          emptyLabel="Nenhum responsável selecionado"
        />
        {!mostrarEnvolvidos && (
          <button
            type="button"
            onClick={() => setMostrarEnvolvidos(true)}
            className="text-xs text-primary hover:underline"
          >
            + Envolver mais pessoas
          </button>
        )}
      </div>

      {mostrarEnvolvidos && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Envolvidos (acompanham)</Label>
            <button
              type="button"
              onClick={() => {
                setMostrarEnvolvidos(false);
                setEnvolvidosIds([]);
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Ocultar
            </button>
          </div>
          <PeoplePicker
            selectedIds={envolvidosIds}
            onChange={setEnvolvidosIds}
            placeholder="Adicionar envolvido"
            emptyLabel="Apenas para acompanhamento"
            icon="users"
          />
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2 border-t">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" disabled={criarAudiencia.isPending}>
          {criarAudiencia.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Salvar
        </Button>
      </div>
    </form>
  );
}