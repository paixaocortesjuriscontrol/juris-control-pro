import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ProcessoTstImport } from "@/hooks/usePrazosTst";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Coordenacao {
  id: string;
  nome: string;
}

interface Membro {
  id: string;
  nome: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (data: ProcessoTstImport) => Promise<any>;
  coordenacaoId: string | null;
  isSaving: boolean;
}

export function TstPrazoFormDialog({ open, onClose, onSave, coordenacaoId: externalCoordId, isSaving }: Props) {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();

  const [form, setForm] = useState({
    numero: "",
    dossie_tst: "",
    polo_passivo: "",
    polo_ativo: "",
    equipe_tst: "",
    decisao_tst: "",
    formulario_tst: "",
    providencias_tst: "",
    deposito_judicial_tst: "",
    preparo_tst: "",
    multa_custas_tst: "",
    responsavel_tst: "",
  });
  const [dataFatal, setDataFatal] = useState<Date>();
  const [selectedCoordId, setSelectedCoordId] = useState<string>("");
  const [selectedMembroId, setSelectedMembroId] = useState<string>("");

  // Fetch coordenações based on user role
  const { data: coordenacoes = [] } = useQuery<Coordenacao[]>({
    queryKey: ["tst-form-coordenacoes", user?.id, isAdmin],
    queryFn: async () => {
      if (!user?.id) return [];

      if (isAdmin) {
        const { data } = await supabase.from("coordenacoes").select("id, nome").order("nome");
        return data ?? [];
      }

      // Non-admin: fetch coordenações where user is member or coordinator
      const { data: membros } = await supabase
        .from("membros_coordenacao")
        .select("coordenacao_id")
        .eq("usuario_id", user.id);
      const membroIds = membros?.map((m) => m.coordenacao_id) ?? [];

      const { data: coordenadas } = await supabase
        .from("coordenacoes")
        .select("id")
        .eq("coordenador_id", user.id);
      const coordIds = coordenadas?.map((c) => c.id) ?? [];

      const allIds = [...new Set([...membroIds, ...coordIds])];
      if (allIds.length === 0) return [];

      const { data } = await supabase
        .from("coordenacoes")
        .select("id, nome")
        .in("id", allIds)
        .order("nome");
      return data ?? [];
    },
    enabled: open && !!user?.id,
  });

  // Fetch membros for selected coordenação
  const { data: membros = [] } = useQuery<Membro[]>({
    queryKey: ["tst-form-membros", selectedCoordId],
    queryFn: async () => {
      if (!selectedCoordId) return [];

      const { data } = await supabase
        .from("membros_coordenacao")
        .select("usuario_id, usuario:profiles_basic!membros_coordenacao_usuario_id_fkey(id, nome)")
        .eq("coordenacao_id", selectedCoordId);

      return (data ?? [])
        .map((m: any) => ({
          id: m.usuario?.id ?? m.usuario_id,
          nome: m.usuario?.nome ?? "Sem nome",
        }))
        .filter((m) => m.id);
    },
    enabled: open && !!selectedCoordId,
  });

  // Auto-select coordenação when dialog opens
  useEffect(() => {
    if (open) {
      if (externalCoordId && externalCoordId !== "todas") {
        setSelectedCoordId(externalCoordId);
      } else if (coordenacoes.length === 1) {
        setSelectedCoordId(coordenacoes[0].id);
      } else {
        setSelectedCoordId("");
      }
      setSelectedMembroId("");
    }
  }, [open, externalCoordId, coordenacoes]);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async () => {
    if (!dataFatal || !selectedCoordId) return;

    await onSave({
      numero: form.numero || "SEM-NUMERO",
      coordenacao_id: selectedCoordId,
      polo_ativo: form.polo_ativo || null,
      polo_passivo: form.polo_passivo || null,
      dossie_tst: form.dossie_tst || null,
      equipe_tst: form.equipe_tst || null,
      decisao_tst: form.decisao_tst || null,
      formulario_tst: form.formulario_tst || null,
      providencias_tst: form.providencias_tst || null,
      deposito_judicial_tst: form.deposito_judicial_tst || null,
      preparo_tst: form.preparo_tst || null,
      multa_custas_tst: form.multa_custas_tst || null,
      responsavel_tst: form.responsavel_tst || null,
      data_fatal: format(dataFatal, "yyyy-MM-dd"),
      area: "trabalhista",
      status: "ativo",
      criado_por_tst: user?.id || null,
      responsavel_tst_id: selectedMembroId || null,
    });

    setForm({
      numero: "", dossie_tst: "", polo_passivo: "", polo_ativo: "", equipe_tst: "",
      decisao_tst: "", formulario_tst: "", providencias_tst: "", deposito_judicial_tst: "",
      preparo_tst: "", multa_custas_tst: "", responsavel_tst: "",
    });
    setDataFatal(undefined);
    setSelectedCoordId("");
    setSelectedMembroId("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Processo TST</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Coordenação selector */}
          <div className="space-y-1">
            <Label>Coordenação *</Label>
            <Select value={selectedCoordId} onValueChange={setSelectedCoordId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a coordenação" />
              </SelectTrigger>
              <SelectContent>
                {coordenacoes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Membro responsável selector */}
          <div className="space-y-1">
            <Label>Responsável (Membro) *</Label>
            <Select value={selectedMembroId} onValueChange={setSelectedMembroId} disabled={!selectedCoordId}>
              <SelectTrigger>
                <SelectValue placeholder={selectedCoordId ? "Selecione o responsável" : "Selecione a coordenação primeiro"} />
              </SelectTrigger>
              <SelectContent>
                {membros.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Nº Processo</Label>
            <Input value={form.numero} onChange={set("numero")} placeholder="0000000-00.0000.0.00.0000" />
          </div>
          <div className="space-y-1">
            <Label>Dossiê</Label>
            <Input value={form.dossie_tst} onChange={set("dossie_tst")} />
          </div>
          <div className="space-y-1">
            <Label>Réu</Label>
            <Input value={form.polo_passivo} onChange={set("polo_passivo")} />
          </div>
          <div className="space-y-1">
            <Label>Autor</Label>
            <Input value={form.polo_ativo} onChange={set("polo_ativo")} />
          </div>
          <div className="space-y-1">
            <Label>Equipe</Label>
            <Input value={form.equipe_tst} onChange={set("equipe_tst")} />
          </div>
          <div className="space-y-1">
            <Label>Responsável (Texto)</Label>
            <Input value={form.responsavel_tst} onChange={set("responsavel_tst")} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Decisão</Label>
            <Textarea value={form.decisao_tst} onChange={set("decisao_tst")} rows={2} />
          </div>
          <div className="space-y-1">
            <Label>Formulário</Label>
            <Input value={form.formulario_tst} onChange={set("formulario_tst")} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Providências</Label>
            <Textarea value={form.providencias_tst} onChange={set("providencias_tst")} rows={2} />
          </div>
          <div className="space-y-1">
            <Label>Depósito Judicial</Label>
            <Input value={form.deposito_judicial_tst} onChange={set("deposito_judicial_tst")} />
          </div>
          <div className="space-y-1">
            <Label>Preparo</Label>
            <Input value={form.preparo_tst} onChange={set("preparo_tst")} />
          </div>
          <div className="space-y-1">
            <Label>Multa/Custas</Label>
            <Input value={form.multa_custas_tst} onChange={set("multa_custas_tst")} />
          </div>
          <div className="space-y-1">
            <Label>Data Fatal *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left", !dataFatal && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataFatal ? format(dataFatal, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dataFatal} onSelect={setDataFatal} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!dataFatal || !selectedCoordId || isSaving}>
            {isSaving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
