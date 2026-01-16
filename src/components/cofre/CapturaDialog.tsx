import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Radio, Clock, Calendar, Settings } from "lucide-react";
import { CofreSenha, CapturaIntimacao } from "@/hooks/useCofreSenhas";
import { Badge } from "@/components/ui/badge";

interface CapturaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  captura?: CapturaIntimacao | null;
  credenciais: CofreSenha[];
  onSave: (dados: any) => void;
  saving?: boolean;
}

const UFS = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT",
  "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"
];

const JUSTICAS = [
  { value: "Estadual", label: "Justiça Estadual" },
  { value: "Federal", label: "Justiça Federal" },
  { value: "Trabalhista", label: "Justiça do Trabalho" },
  { value: "Eleitoral", label: "Justiça Eleitoral" },
  { value: "Militar", label: "Justiça Militar" },
];

const INSTANCIAS = [
  { value: "1º Grau", label: "1º Grau" },
  { value: "2º Grau", label: "2º Grau" },
  { value: "Superior", label: "Tribunais Superiores" },
];

const DIAS_SEMANA = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
];

const HORARIOS_SUGERIDOS = ["06:00", "08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00"];

export function CapturaDialog({ open, onOpenChange, captura, credenciais, onSave, saving }: CapturaDialogProps) {
  const [formData, setFormData] = useState({
    cofre_senha_id: "",
    oab_numero: "",
    oab_uf: "",
    justica: "",
    orgao: "",
    instancia: "",
    ativo: true,
    status: "aguardando_cadastro",
    mensagem_status: null as string | null,
    // Campos de agendamento
    modo_captura: "agendado" as "agendado" | "intervalo" | "manual",
    horarios_execucao: ["09:00", "14:00", "18:00"] as string[],
    dias_semana: [1, 2, 3, 4, 5] as number[],
    intervalo_minutos: 60,
  });

  const [novoHorario, setNovoHorario] = useState("");

  useEffect(() => {
    if (captura) {
      setFormData({
        cofre_senha_id: captura.cofre_senha_id,
        oab_numero: captura.oab_numero,
        oab_uf: captura.oab_uf,
        justica: captura.justica,
        orgao: captura.orgao,
        instancia: captura.instancia,
        ativo: captura.ativo,
        status: captura.status,
        mensagem_status: captura.mensagem_status,
        modo_captura: (captura as any).modo_captura || "agendado",
        horarios_execucao: (captura as any).horarios_execucao || ["08:00", "14:00", "18:00"],
        dias_semana: (captura as any).dias_semana || [1, 2, 3, 4, 5],
        intervalo_minutos: (captura as any).intervalo_minutos || 60,
      });
    } else {
      setFormData({
        cofre_senha_id: credenciais[0]?.id || "",
        oab_numero: "",
        oab_uf: "",
        justica: "",
        orgao: "",
        instancia: "",
        ativo: true,
        status: "aguardando_cadastro",
        mensagem_status: null,
        modo_captura: "agendado",
        horarios_execucao: ["08:00", "14:00", "18:00"],
        dias_semana: [1, 2, 3, 4, 5],
        intervalo_minutos: 60,
      });
    }
  }, [captura, credenciais, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const toggleDia = (dia: number) => {
    if (formData.dias_semana.includes(dia)) {
      setFormData({ ...formData, dias_semana: formData.dias_semana.filter(d => d !== dia) });
    } else {
      setFormData({ ...formData, dias_semana: [...formData.dias_semana, dia].sort() });
    }
  };

  const addHorario = (horario: string) => {
    if (horario && !formData.horarios_execucao.includes(horario)) {
      const novosHorarios = [...formData.horarios_execucao, horario].sort();
      setFormData({ ...formData, horarios_execucao: novosHorarios });
    }
    setNovoHorario("");
  };

  const removeHorario = (horario: string) => {
    setFormData({ 
      ...formData, 
      horarios_execucao: formData.horarios_execucao.filter(h => h !== horario) 
    });
  };

  const isEditing = !!captura;
  const credencialSelecionada = credenciais.find(c => c.id === formData.cofre_senha_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-primary" />
            {isEditing ? "Editar Captura" : "Configurar Captura de Intimações"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {credenciais.length === 0 ? (
            <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200">
              Você precisa cadastrar uma credencial no Cofre de Senhas antes de configurar capturas.
            </div>
          ) : (
            <>
              {/* Credencial */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Settings className="h-4 w-4" />
                  Dados da Captura
                </div>

                <div>
                  <Label>Credencial do Cofre *</Label>
                  <Select
                    value={formData.cofre_senha_id}
                    onValueChange={(v) => setFormData({ ...formData, cofre_senha_id: v })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a credencial..." />
                    </SelectTrigger>
                    <SelectContent>
                      {credenciais.filter(c => c.ativo).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome} ({c.tribunal})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {credencialSelecionada && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Sistema: {credencialSelecionada.sistema} | Login: {credencialSelecionada.login}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Número OAB *</Label>
                    <Input
                      value={formData.oab_numero}
                      onChange={(e) => setFormData({ ...formData, oab_numero: e.target.value })}
                      placeholder="Ex: 12345"
                      required
                    />
                  </div>

                  <div>
                    <Label>UF da OAB *</Label>
                    <Select
                      value={formData.oab_uf}
                      onValueChange={(v) => setFormData({ ...formData, oab_uf: v })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="UF" />
                      </SelectTrigger>
                      <SelectContent>
                        {UFS.map((uf) => (
                          <SelectItem key={uf} value={uf}>
                            {uf}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Justiça *</Label>
                    <Select
                      value={formData.justica}
                      onValueChange={(v) => setFormData({ ...formData, justica: v })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {JUSTICAS.map((j) => (
                          <SelectItem key={j.value} value={j.value}>
                            {j.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Instância *</Label>
                    <Select
                      value={formData.instancia}
                      onValueChange={(v) => setFormData({ ...formData, instancia: v })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {INSTANCIAS.map((i) => (
                          <SelectItem key={i.value} value={i.value}>
                            {i.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Órgão / Tribunal *</Label>
                  <Input
                    value={formData.orgao}
                    onChange={(e) => setFormData({ ...formData, orgao: e.target.value })}
                    placeholder="Ex: TJDFT, TRT10, TRF1..."
                    required
                  />
                </div>
              </div>

              {/* Agendamento */}
              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  Agendamento de Execução
                </div>

                <div>
                  <Label>Modo de Captura</Label>
                  <Select
                    value={formData.modo_captura}
                    onValueChange={(v: "agendado" | "intervalo" | "manual") => 
                      setFormData({ ...formData, modo_captura: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="agendado">Horários Fixos</SelectItem>
                      <SelectItem value="intervalo">Intervalo Regular</SelectItem>
                      <SelectItem value="manual">Apenas Manual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formData.modo_captura === "agendado" && (
                  <>
                    {/* Dias da Semana */}
                    <div>
                      <Label className="mb-2 block">Dias da Semana</Label>
                      <div className="flex flex-wrap gap-2">
                        {DIAS_SEMANA.map((dia) => (
                          <button
                            key={dia.value}
                            type="button"
                            onClick={() => toggleDia(dia.value)}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                              formData.dias_semana.includes(dia.value)
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground hover:bg-muted/80"
                            }`}
                          >
                            {dia.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Horários */}
                    <div>
                      <Label className="mb-2 block">Horários de Execução</Label>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {formData.horarios_execucao.map((horario) => (
                          <Badge 
                            key={horario} 
                            variant="secondary"
                            className="px-2 py-1 cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                            onClick={() => removeHorario(horario)}
                          >
                            {horario} ×
                          </Badge>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          type="time"
                          value={novoHorario}
                          onChange={(e) => setNovoHorario(e.target.value)}
                          className="w-32"
                        />
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm"
                          onClick={() => addHorario(novoHorario)}
                          disabled={!novoHorario}
                        >
                          Adicionar
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {HORARIOS_SUGERIDOS.filter(h => !formData.horarios_execucao.includes(h)).map((h) => (
                          <button
                            key={h}
                            type="button"
                            onClick={() => addHorario(h)}
                            className="text-xs text-muted-foreground hover:text-foreground underline"
                          >
                            {h}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {formData.modo_captura === "intervalo" && (
                  <div>
                    <Label>Intervalo entre capturas (minutos)</Label>
                    <Select
                      value={String(formData.intervalo_minutos)}
                      onValueChange={(v) => setFormData({ ...formData, intervalo_minutos: Number(v) })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">A cada 30 minutos</SelectItem>
                        <SelectItem value="60">A cada 1 hora</SelectItem>
                        <SelectItem value="120">A cada 2 horas</SelectItem>
                        <SelectItem value="180">A cada 3 horas</SelectItem>
                        <SelectItem value="360">A cada 6 horas</SelectItem>
                        <SelectItem value="720">A cada 12 horas</SelectItem>
                        <SelectItem value="1440">A cada 24 horas</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      A captura será executada automaticamente no intervalo definido
                    </p>
                  </div>
                )}

                {formData.modo_captura === "manual" && (
                  <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                    A captura só será executada manualmente através do botão "Executar".
                  </div>
                )}
              </div>

              {/* Status */}
              <div className="flex items-center justify-between border-t pt-4">
                <Label>Captura ativa</Label>
                <Switch
                  checked={formData.ativo}
                  onCheckedChange={(v) => setFormData({ ...formData, ativo: v })}
                />
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving || credenciais.length === 0}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditing ? "Atualizar" : "Configurar Captura"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
