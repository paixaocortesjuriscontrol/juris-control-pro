import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Radio } from "lucide-react";
import { CofreSenha, CapturaIntimacao } from "@/hooks/useCofreSenhas";

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
  });

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
      });
    }
  }, [captura, credenciais, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const isEditing = !!captura;
  const credencialSelecionada = credenciais.find(c => c.id === formData.cofre_senha_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-primary" />
            {isEditing ? "Editar Captura" : "Configurar Captura de Intimações"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {credenciais.length === 0 ? (
            <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200">
              Você precisa cadastrar uma credencial no Cofre de Senhas antes de configurar capturas.
            </div>
          ) : (
            <>
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

              <div>
                <Label>Justiça *</Label>
                <Select
                  value={formData.justica}
                  onValueChange={(v) => setFormData({ ...formData, justica: v })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a justiça..." />
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
                <Label>Órgão / Tribunal *</Label>
                <Input
                  value={formData.orgao}
                  onChange={(e) => setFormData({ ...formData, orgao: e.target.value })}
                  placeholder="Ex: TJDFT, TRT10, TRF1..."
                  required
                />
              </div>

              <div>
                <Label>Instância *</Label>
                <Select
                  value={formData.instancia}
                  onValueChange={(v) => setFormData({ ...formData, instancia: v })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a instância..." />
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

              <div className="flex items-center justify-between">
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
