import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMonitoramentosDjen, MonitoramentoDjen } from "@/hooks/useMonitoramentosDjen";

const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 
  'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 
  'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'
];

interface MonitoramentoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  monitoramento?: MonitoramentoDjen | null;
}

export function MonitoramentoDialog({ open, onOpenChange, monitoramento }: MonitoramentoDialogProps) {
  const { criarMonitoramento, atualizarMonitoramento } = useMonitoramentosDjen();
  
  const [tipo, setTipo] = useState<'palavra-chave' | 'advogado' | 'processo'>(
    monitoramento?.tipo || 'palavra-chave'
  );
  const [termoBusca, setTermoBusca] = useState(monitoramento?.termo_busca || '');
  const [oab, setOab] = useState(monitoramento?.oab || '');
  const [uf, setUf] = useState(monitoramento?.uf || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const dados = {
      tipo,
      termo_busca: termoBusca,
      oab: tipo === 'advogado' ? oab : undefined,
      uf: tipo === 'advogado' ? uf : undefined,
    };

    if (monitoramento) {
      await atualizarMonitoramento.mutateAsync({ id: monitoramento.id, ...dados });
    } else {
      await criarMonitoramento.mutateAsync(dados);
    }
    
    onOpenChange(false);
    setTermoBusca('');
    setOab('');
    setUf('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {monitoramento ? 'Editar Monitoramento' : 'Novo Monitoramento'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo de Busca</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="palavra-chave">Palavra-chave</SelectItem>
                <SelectItem value="advogado">Advogado (OAB)</SelectItem>
                <SelectItem value="processo">Número do Processo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {tipo === 'advogado' ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="oab">Número OAB</Label>
                <Input
                  id="oab"
                  value={oab}
                  onChange={(e) => setOab(e.target.value)}
                  placeholder="Ex: 12345"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="uf">UF</Label>
                <Select value={uf} onValueChange={setUf} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {UFS.map((estado) => (
                      <SelectItem key={estado} value={estado}>{estado}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="termo">Nome do Advogado (para referência)</Label>
                <Input
                  id="termo"
                  value={termoBusca}
                  onChange={(e) => setTermoBusca(e.target.value)}
                  placeholder="Nome para identificação"
                  required
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="termo">
                {tipo === 'processo' ? 'Número do Processo' : 'Palavra-chave'}
              </Label>
              <Input
                id="termo"
                value={termoBusca}
                onChange={(e) => setTermoBusca(e.target.value)}
                placeholder={tipo === 'processo' 
                  ? 'Ex: 0001234-12.2024.5.10.0001' 
                  : 'Ex: Paixão Cortes'}
                required
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={criarMonitoramento.isPending || atualizarMonitoramento.isPending}>
              {monitoramento ? 'Salvar' : 'Criar Monitoramento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
