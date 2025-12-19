import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useMonitoramentosDjen, MonitoramentoDjen } from "@/hooks/useMonitoramentosDjen";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  const [selectedUfs, setSelectedUfs] = useState<string[]>([]);
  const [todasRegioes, setTodasRegioes] = useState(false);

  useEffect(() => {
    if (monitoramento?.uf) {
      if (monitoramento.uf === 'TODAS') {
        setTodasRegioes(true);
        setSelectedUfs([]);
      } else {
        setTodasRegioes(false);
        setSelectedUfs(monitoramento.uf.split(','));
      }
    }
  }, [monitoramento]);

  const handleToggleUf = (uf: string) => {
    setSelectedUfs(prev => 
      prev.includes(uf) 
        ? prev.filter(u => u !== uf)
        : [...prev, uf]
    );
  };

  const handleTodasRegioes = (checked: boolean) => {
    setTodasRegioes(checked);
    if (checked) {
      setSelectedUfs([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const ufValue = tipo === 'advogado' 
      ? (todasRegioes ? 'TODAS' : selectedUfs.join(','))
      : undefined;

    const dados = {
      tipo,
      termo_busca: termoBusca,
      oab: tipo === 'advogado' ? oab : undefined,
      uf: ufValue,
    };

    if (monitoramento) {
      await atualizarMonitoramento.mutateAsync({ id: monitoramento.id, ...dados });
    } else {
      await criarMonitoramento.mutateAsync(dados);
    }
    
    onOpenChange(false);
    setTermoBusca('');
    setOab('');
    setSelectedUfs([]);
    setTodasRegioes(false);
  };

  const isUfValid = tipo !== 'advogado' || todasRegioes || selectedUfs.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
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
            <div className="space-y-4">
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
                  <Label htmlFor="termo">Nome (referência)</Label>
                  <Input
                    id="termo"
                    value={termoBusca}
                    onChange={(e) => setTermoBusca(e.target.value)}
                    placeholder="Nome para identificação"
                    required
                  />
                </div>
              </div>
              
              <div className="space-y-3">
                <Label>Regiões (UFs)</Label>
                <div className="flex items-center space-x-2 pb-2 border-b">
                  <Checkbox 
                    id="todas-regioes"
                    checked={todasRegioes}
                    onCheckedChange={handleTodasRegioes}
                  />
                  <label htmlFor="todas-regioes" className="text-sm font-medium cursor-pointer">
                    Todas as regiões
                  </label>
                </div>
                
                {!todasRegioes && (
                  <ScrollArea className="h-32 border rounded-md p-2">
                    <div className="grid grid-cols-5 gap-2">
                      {UFS.map((uf) => (
                        <div key={uf} className="flex items-center space-x-1">
                          <Checkbox 
                            id={`uf-${uf}`}
                            checked={selectedUfs.includes(uf)}
                            onCheckedChange={() => handleToggleUf(uf)}
                          />
                          <label htmlFor={`uf-${uf}`} className="text-xs cursor-pointer">
                            {uf}
                          </label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
                
                {!todasRegioes && selectedUfs.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Selecionadas: {selectedUfs.join(', ')}
                  </p>
                )}
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
            <Button 
              type="submit" 
              disabled={criarMonitoramento.isPending || atualizarMonitoramento.isPending || !isUfValid}
            >
              {monitoramento ? 'Salvar' : 'Criar Monitoramento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
