import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMonitoramentosPje, MonitoramentoPje } from "@/hooks/useMonitoramentosPje";

const UFS = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT",
  "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"
];

interface MonitoramentoPjeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  monitoramento?: MonitoramentoPje;
}

export function MonitoramentoPjeDialog({ open, onOpenChange, monitoramento }: MonitoramentoPjeDialogProps) {
  const [tipo, setTipo] = useState<'palavra-chave' | 'advogado' | 'processo'>('palavra-chave');
  const [termoBusca, setTermoBusca] = useState('');
  const [oab, setOab] = useState('');
  const [uf, setUf] = useState('');

  const { criarMonitoramento, atualizarMonitoramento } = useMonitoramentosPje();

  useEffect(() => {
    if (monitoramento) {
      setTipo(monitoramento.tipo);
      setTermoBusca(monitoramento.termo_busca);
      setOab(monitoramento.oab || '');
      setUf(monitoramento.uf || '');
    } else {
      setTipo('palavra-chave');
      setTermoBusca('');
      setOab('');
      setUf('');
    }
  }, [monitoramento, open]);

  const handleSubmit = () => {
    const dados = {
      tipo,
      termo_busca: tipo === 'advogado' ? `${oab}/${uf}` : termoBusca,
      oab: tipo === 'advogado' ? oab : undefined,
      uf: tipo === 'advogado' ? uf : undefined,
    };

    if (monitoramento) {
      atualizarMonitoramento.mutate({ id: monitoramento.id, ...dados });
    } else {
      criarMonitoramento.mutate(dados);
    }
    
    onOpenChange(false);
  };

  const isValid = tipo === 'advogado' ? (oab && uf) : termoBusca.length >= 3;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {monitoramento ? 'Editar Monitoramento PJE' : 'Novo Monitoramento PJE'}
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Tipo de Busca</Label>
            <Select value={tipo} onValueChange={(v: any) => setTipo(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="palavra-chave">Palavra-chave</SelectItem>
                <SelectItem value="advogado">OAB/Advogado</SelectItem>
                <SelectItem value="processo">Número do Processo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {tipo === 'advogado' ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="oab">Número OAB</Label>
                <Input
                  id="oab"
                  value={oab}
                  onChange={(e) => setOab(e.target.value)}
                  placeholder="Ex: 123456"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="uf">Estado (UF)</Label>
                <Select value={uf} onValueChange={setUf}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o estado" />
                  </SelectTrigger>
                  <SelectContent>
                    {UFS.map((estado) => (
                      <SelectItem key={estado} value={estado}>
                        {estado}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="termoBusca">
                {tipo === 'processo' ? 'Número do Processo' : 'Palavra-chave'}
              </Label>
              <Input
                id="termoBusca"
                value={termoBusca}
                onChange={(e) => setTermoBusca(e.target.value)}
                placeholder={tipo === 'processo' ? 'Ex: 0000123-45.2024.5.10.0001' : 'Ex: nome da parte, empresa'}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid}>
            {monitoramento ? 'Salvar' : 'Criar Monitoramento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
