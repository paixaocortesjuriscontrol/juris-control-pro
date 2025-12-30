import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Loader2, Plus } from "lucide-react";
import { useAudienciasDetectadas, NovaAudiencia } from "@/hooks/useAudienciasDetectadas";

export function CadastroAudienciaForm() {
  const { criarAudiencia } = useAudienciasDetectadas();
  const [formData, setFormData] = useState<NovaAudiencia>({
    processo_numero: "",
    data_audiencia: "",
    hora: "",
    tipo_audiencia: "",
    vara_camara: "",
    comarca: "",
    polo_ativo: "",
    cliente: "",
    terceirizado: "",
    resumo_objeto: "",
    funcao: "",
    preposto: "",
    testemunhas: "",
    advogado: "",
    observacoes: "",
    status: "pendente",
  });

  const handleChange = (field: keyof NovaAudiencia, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.processo_numero || !formData.data_audiencia) {
      return;
    }

    await criarAudiencia.mutateAsync(formData);
    
    // Limpar formulário
    setFormData({
      processo_numero: "",
      data_audiencia: "",
      hora: "",
      tipo_audiencia: "",
      vara_camara: "",
      comarca: "",
      polo_ativo: "",
      cliente: "",
      terceirizado: "",
      resumo_objeto: "",
      funcao: "",
      preposto: "",
      testemunhas: "",
      advogado: "",
      observacoes: "",
      status: "pendente",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Cadastrar Nova Audiência
        </CardTitle>
        <CardDescription>
          Preencha os dados da audiência conforme a pauta semanal
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Dados Principais */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="data_audiencia">Data *</Label>
              <Input
                id="data_audiencia"
                type="date"
                value={formData.data_audiencia}
                onChange={(e) => handleChange("data_audiencia", e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hora">Hora</Label>
              <Input
                id="hora"
                type="text"
                placeholder="Ex: 14:00"
                value={formData.hora}
                onChange={(e) => handleChange("hora", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="processo_numero">Número do Processo *</Label>
              <Input
                id="processo_numero"
                placeholder="0000000-00.0000.0.00.0000"
                value={formData.processo_numero}
                onChange={(e) => handleChange("processo_numero", e.target.value)}
                required
              />
            </div>
          </div>

          {/* Tribunal e Local */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="vara_camara">VT / Câmara</Label>
              <Input
                id="vara_camara"
                placeholder="Ex: 22ª VT"
                value={formData.vara_camara}
                onChange={(e) => handleChange("vara_camara", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="comarca">Comarca</Label>
              <Input
                id="comarca"
                placeholder="Ex: Brasília"
                value={formData.comarca}
                onChange={(e) => handleChange("comarca", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tipo_audiencia">Tipo de Audiência</Label>
              <Input
                id="tipo_audiencia"
                placeholder="Ex: Inicial Presencial"
                value={formData.tipo_audiencia}
                onChange={(e) => handleChange("tipo_audiencia", e.target.value)}
              />
            </div>
          </div>

          {/* Partes */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="polo_ativo">Polo Ativo (Reclamante)</Label>
              <Input
                id="polo_ativo"
                placeholder="Nome do reclamante"
                value={formData.polo_ativo}
                onChange={(e) => handleChange("polo_ativo", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cliente">Cliente (Reclamado)</Label>
              <Input
                id="cliente"
                placeholder="Nome do cliente"
                value={formData.cliente}
                onChange={(e) => handleChange("cliente", e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="terceirizado">Terceirizado</Label>
              <Input
                id="terceirizado"
                placeholder="Empresa terceirizada (se houver)"
                value={formData.terceirizado}
                onChange={(e) => handleChange("terceirizado", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="funcao">Função do Reclamante</Label>
              <Input
                id="funcao"
                placeholder="Ex: Técnico em Enfermagem"
                value={formData.funcao}
                onChange={(e) => handleChange("funcao", e.target.value)}
              />
            </div>
          </div>

          {/* Resumo */}
          <div className="space-y-2">
            <Label htmlFor="resumo_objeto">Resumo do Objeto</Label>
            <Textarea
              id="resumo_objeto"
              placeholder="Descreva o objeto da audiência..."
              value={formData.resumo_objeto}
              onChange={(e) => handleChange("resumo_objeto", e.target.value)}
              rows={3}
            />
          </div>

          {/* Participantes */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="preposto">Preposto</Label>
              <Input
                id="preposto"
                placeholder="Nome e contato do preposto"
                value={formData.preposto}
                onChange={(e) => handleChange("preposto", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="testemunhas">Testemunhas</Label>
              <Input
                id="testemunhas"
                placeholder="Nomes das testemunhas"
                value={formData.testemunhas}
                onChange={(e) => handleChange("testemunhas", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="advogado">Advogado Responsável</Label>
              <Input
                id="advogado"
                placeholder="Nome do advogado"
                value={formData.advogado}
                onChange={(e) => handleChange("advogado", e.target.value)}
              />
            </div>
          </div>

          {/* Status e Observações */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select 
                value={formData.status || "pendente"} 
                onValueChange={(value) => handleChange("status", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">⏳ Pendente</SelectItem>
                  <SelectItem value="confirmado">✅ Confirmado</SelectItem>
                  <SelectItem value="reagendado">🔄 Reagendado</SelectItem>
                  <SelectItem value="tratado">✔️ Tratado</SelectItem>
                  <SelectItem value="cancelado">❌ Cancelado</SelectItem>
                  <SelectItem value="ignorado">🚫 Ignorado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                placeholder="Observações adicionais..."
                value={formData.observacoes}
                onChange={(e) => handleChange("observacoes", e.target.value)}
                rows={2}
              />
            </div>
          </div>

          <Button type="submit" className="w-full md:w-auto" disabled={criarAudiencia.isPending}>
            {criarAudiencia.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Cadastrando...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar Audiência
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}