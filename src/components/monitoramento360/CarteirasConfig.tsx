import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Filter, Plus, Edit2, Trash2, FolderOpen, Eye } from "lucide-react";
import { useMonitoramento360, CarteiraProcessos } from "@/hooks/useMonitoramento360";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const CORES = [
  { value: '#3B82F6', label: 'Azul' },
  { value: '#10B981', label: 'Verde' },
  { value: '#F59E0B', label: 'Amarelo' },
  { value: '#EF4444', label: 'Vermelho' },
  { value: '#8B5CF6', label: 'Roxo' },
  { value: '#EC4899', label: 'Rosa' },
  { value: '#6B7280', label: 'Cinza' },
];

const STATUS_OPTIONS = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'pendente', label: 'Pendente' },
  { value: 'urgente', label: 'Urgente' },
  { value: 'encerrado', label: 'Encerrado' },
  { value: 'arquivado', label: 'Arquivado' },
];

const AREA_OPTIONS = [
  { value: 'civil', label: 'Civil' },
  { value: 'trabalhista', label: 'Trabalhista' },
  { value: 'empresarial', label: 'Empresarial' },
];

interface CarteiraFormData {
  nome: string;
  descricao: string;
  cor: string;
  criterios: {
    status?: string[];
    area?: string[];
    coordenacao_id?: string;
    cliente_id?: string;
    tribunal?: string;
    termo_busca?: string;
  };
}

export default function CarteirasConfig() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { carteiras, loadingCarteiras, criarCarteira, atualizarCarteira, excluirCarteira } = useMonitoramento360();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCarteira, setEditingCarteira] = useState<CarteiraProcessos | null>(null);
  const [expandedCarteira, setExpandedCarteira] = useState<string | null>(null);

  const [formData, setFormData] = useState<CarteiraFormData>({
    nome: '',
    descricao: '',
    cor: '#3B82F6',
    criterios: {},
  });

  // Buscar coordenações
  const { data: coordenacoes = [] } = useQuery({
    queryKey: ['coordenacoes-select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('coordenacoes')
        .select('id, nome')
        .order('nome');
      if (error) throw error;
      return data;
    },
  });

  // Buscar clientes
  const { data: clientes = [] } = useQuery({
    queryKey: ['clientes-select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome')
        .order('nome')
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const resetForm = () => {
    setFormData({
      nome: '',
      descricao: '',
      cor: '#3B82F6',
      criterios: {},
    });
    setEditingCarteira(null);
  };

  const handleOpenDialog = (carteira?: CarteiraProcessos) => {
    if (carteira) {
      setEditingCarteira(carteira);
      setFormData({
        nome: carteira.nome,
        descricao: carteira.descricao || '',
        cor: carteira.cor || '#3B82F6',
        criterios: carteira.criterios || {},
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.nome.trim()) return;

    if (editingCarteira) {
      await atualizarCarteira.mutateAsync({
        id: editingCarteira.id,
        nome: formData.nome,
        descricao: formData.descricao || null,
        cor: formData.cor,
        criterios: formData.criterios,
      });
    } else {
      await criarCarteira.mutateAsync({
        nome: formData.nome,
        descricao: formData.descricao || undefined,
        tipo: 'automatica',
        cor: formData.cor,
        criterios: formData.criterios,
        criado_por: user?.id || '',
      });
    }

    setDialogOpen(false);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    await excluirCarteira.mutateAsync(id);
  };

  const toggleStatus = (status: string) => {
    const currentStatus = formData.criterios.status || [];
    if (currentStatus.includes(status)) {
      setFormData({
        ...formData,
        criterios: {
          ...formData.criterios,
          status: currentStatus.filter((s: string) => s !== status),
        },
      });
    } else {
      setFormData({
        ...formData,
        criterios: {
          ...formData.criterios,
          status: [...currentStatus, status],
        },
      });
    }
  };

  const toggleArea = (area: string) => {
    const currentAreas = formData.criterios.area || [];
    if (currentAreas.includes(area)) {
      setFormData({
        ...formData,
        criterios: {
          ...formData.criterios,
          area: currentAreas.filter((a: string) => a !== area),
        },
      });
    } else {
      setFormData({
        ...formData,
        criterios: {
          ...formData.criterios,
          area: [...currentAreas, area],
        },
      });
    }
  };

  const getCriteriosLabel = (criterios: Record<string, any>) => {
    const labels: string[] = [];
    if (criterios.status?.length) labels.push(`Status: ${criterios.status.join(', ')}`);
    if (criterios.area?.length) labels.push(`Área: ${criterios.area.join(', ')}`);
    if (criterios.coordenacao_id) {
      const coord = coordenacoes.find(c => c.id === criterios.coordenacao_id);
      if (coord) labels.push(`Coord: ${coord.nome}`);
    }
    if (criterios.cliente_id) {
      const cliente = clientes.find(c => c.id === criterios.cliente_id);
      if (cliente) labels.push(`Cliente: ${cliente.nome}`);
    }
    if (criterios.tribunal) labels.push(`Tribunal: ${criterios.tribunal}`);
    if (criterios.termo_busca) labels.push(`Termo: ${criterios.termo_busca}`);
    return labels.length > 0 ? labels : ['Todos os processos'];
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Carteiras de Processos
            </CardTitle>
            <CardDescription>
              Organize processos em carteiras automáticas por critérios
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Carteira
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {editingCarteira ? 'Editar Carteira' : 'Nova Carteira'}
                </DialogTitle>
                <DialogDescription>
                  Configure os critérios para agrupar processos automaticamente
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Nome da Carteira *</Label>
                  <Input
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Ex: Processos Urgentes Civil"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea
                    value={formData.descricao}
                    onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                    placeholder="Descrição opcional da carteira..."
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Cor</Label>
                  <div className="flex gap-2">
                    {CORES.map((cor) => (
                      <button
                        key={cor.value}
                        type="button"
                        className={`w-8 h-8 rounded-full border-2 transition-all ${
                          formData.cor === cor.value ? 'border-foreground scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: cor.value }}
                        onClick={() => setFormData({ ...formData, cor: cor.value })}
                        title={cor.label}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Filtrar por Status</Label>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.map((status) => (
                      <Badge
                        key={status.value}
                        variant={formData.criterios.status?.includes(status.value) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => toggleStatus(status.value)}
                      >
                        {status.label}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Filtrar por Área</Label>
                  <div className="flex flex-wrap gap-2">
                    {AREA_OPTIONS.map((area) => (
                      <Badge
                        key={area.value}
                        variant={formData.criterios.area?.includes(area.value) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => toggleArea(area.value)}
                      >
                        {area.label}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Filtrar por Coordenação</Label>
                  <Select
                    value={formData.criterios.coordenacao_id || ''}
                    onValueChange={(value) => setFormData({
                      ...formData,
                      criterios: { ...formData.criterios, coordenacao_id: value || undefined },
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as coordenações" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todas as coordenações</SelectItem>
                      {coordenacoes.map((coord) => (
                        <SelectItem key={coord.id} value={coord.id}>
                          {coord.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Filtrar por Cliente</Label>
                  <Select
                    value={formData.criterios.cliente_id || ''}
                    onValueChange={(value) => setFormData({
                      ...formData,
                      criterios: { ...formData.criterios, cliente_id: value || undefined },
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os clientes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todos os clientes</SelectItem>
                      {clientes.map((cliente) => (
                        <SelectItem key={cliente.id} value={cliente.id}>
                          {cliente.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Filtrar por Tribunal</Label>
                  <Input
                    value={formData.criterios.tribunal || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      criterios: { ...formData.criterios, tribunal: e.target.value || undefined },
                    })}
                    placeholder="Ex: TJSP, TRT10, etc."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Buscar por Termo (número, parte, etc.)</Label>
                  <Input
                    value={formData.criterios.termo_busca || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      criterios: { ...formData.criterios, termo_busca: e.target.value || undefined },
                    })}
                    placeholder="Ex: nome da parte, número parcial..."
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleSave} 
                  disabled={!formData.nome.trim() || criarCarteira.isPending || atualizarCarteira.isPending}
                >
                  {editingCarteira ? 'Salvar' : 'Criar Carteira'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loadingCarteiras ? (
          <div className="text-center py-8 text-muted-foreground">
            Carregando carteiras...
          </div>
        ) : carteiras.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FolderOpen className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma carteira criada</h3>
            <p className="text-muted-foreground max-w-md mb-4">
              Crie carteiras para organizar seus processos automaticamente com base em critérios como área, 
              status, coordenação, cliente e outros filtros.
            </p>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Primeira Carteira
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {carteiras.map((carteira) => (
              <CarteiraCard
                key={carteira.id}
                carteira={carteira}
                criteriosLabels={getCriteriosLabel(carteira.criterios)}
                expanded={expandedCarteira === carteira.id}
                onToggleExpand={() => setExpandedCarteira(expandedCarteira === carteira.id ? null : carteira.id)}
                onEdit={() => handleOpenDialog(carteira)}
                onDelete={() => handleDelete(carteira.id)}
                onToggleAtivo={(ativo) => atualizarCarteira.mutate({ id: carteira.id, ativo })}
                coordenacoes={coordenacoes}
                clientes={clientes}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface CarteiraCardProps {
  carteira: CarteiraProcessos;
  criteriosLabels: string[];
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleAtivo: (ativo: boolean) => void;
  coordenacoes: Array<{ id: string; nome: string }>;
  clientes: Array<{ id: string; nome: string }>;
}

function CarteiraCard({ 
  carteira, 
  criteriosLabels, 
  expanded, 
  onToggleExpand, 
  onEdit, 
  onDelete, 
  onToggleAtivo,
  coordenacoes,
  clientes,
}: CarteiraCardProps) {
  const navigate = useNavigate();

  // Buscar processos que correspondem aos critérios
  const { data: processosCount = 0 } = useQuery({
    queryKey: ['carteira-processos-count', carteira.id, carteira.criterios],
    queryFn: async () => {
      let query = supabase
        .from('processos')
        .select('id', { count: 'exact', head: true });

      const criterios = carteira.criterios;

      if (criterios.status?.length) {
        query = query.in('status', criterios.status);
      }
      if (criterios.area?.length) {
        query = query.in('area', criterios.area);
      }
      if (criterios.coordenacao_id) {
        query = query.eq('coordenacao_id', criterios.coordenacao_id);
      }
      if (criterios.cliente_id) {
        query = query.eq('cliente_id', criterios.cliente_id);
      }
      if (criterios.tribunal) {
        query = query.ilike('tribunal', `%${criterios.tribunal}%`);
      }
      if (criterios.termo_busca) {
        query = query.or(`numero.ilike.%${criterios.termo_busca}%,polo_ativo.ilike.%${criterios.termo_busca}%,polo_passivo.ilike.%${criterios.termo_busca}%`);
      }

      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
    enabled: carteira.ativo,
  });

  const handleViewProcessos = () => {
    // Navegar para a página de processos com os filtros aplicados
    const params = new URLSearchParams();
    
    if (carteira.criterios.status?.length) {
      params.set('status', carteira.criterios.status.join(','));
    }
    if (carteira.criterios.area?.length) {
      params.set('area', carteira.criterios.area.join(','));
    }
    if (carteira.criterios.coordenacao_id) {
      params.set('coordenacao', carteira.criterios.coordenacao_id);
    }
    if (carteira.criterios.cliente_id) {
      params.set('cliente', carteira.criterios.cliente_id);
    }
    if (carteira.criterios.termo_busca) {
      params.set('busca', carteira.criterios.termo_busca);
    }

    navigate(`/processos?${params.toString()}`);
  };

  return (
    <div 
      className="border rounded-lg p-4 transition-all hover:shadow-sm"
      style={{ borderLeftWidth: '4px', borderLeftColor: carteira.cor }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div 
            className="w-3 h-3 rounded-full" 
            style={{ backgroundColor: carteira.cor }}
          />
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-medium">{carteira.nome}</h4>
              {!carteira.ativo && (
                <Badge variant="secondary">Inativa</Badge>
              )}
              <Badge variant="outline" className="font-mono">
                {processosCount} processos
              </Badge>
            </div>
            {carteira.descricao && (
              <p className="text-sm text-muted-foreground">{carteira.descricao}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            checked={carteira.ativo}
            onCheckedChange={onToggleAtivo}
          />
          <Button variant="ghost" size="sm" onClick={handleViewProcessos}>
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Edit2 className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir carteira?</AlertDialogTitle>
                <AlertDialogDescription>
                  A carteira "{carteira.nome}" será excluída permanentemente. 
                  Os processos não serão afetados.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete}>
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {criteriosLabels.map((label, i) => (
          <Badge key={i} variant="secondary" className="text-xs">
            {label}
          </Badge>
        ))}
      </div>
    </div>
  );
}
