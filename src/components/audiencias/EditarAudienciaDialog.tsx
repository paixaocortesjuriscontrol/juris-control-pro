import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save } from "lucide-react";
import { AudienciaDetectada } from "@/hooks/useAudienciasDetectadas";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, parseISO, isValid } from "date-fns";
import { SelecionarAdvogadosAudiencia } from "./SelecionarAdvogadosAudiencia";

interface Props {
  audiencia: AudienciaDetectada | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditarAudienciaDialog({ audiencia, open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAdvogados, setSelectedAdvogados] = useState<string[]>([]);
  const [formData, setFormData] = useState({
    data_audiencia: "",
    hora: "",
    hora_local: "",
    hora_brasilia: "",
    processo_numero: "",
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
    providencias_tomadas: "",
    modalidade: "",
    equipe: "",
    nucleo_origem: "",
    dossie: "",
  });

  // Buscar advogados vinculados à audiência
  const { data: advogadosVinculados = [] } = useQuery({
    queryKey: ["audiencia-advogados", audiencia?.id],
    queryFn: async () => {
      if (!audiencia?.id) return [];
      const { data, error } = await supabase
        .from("audiencias_advogados")
        .select("advogado_id")
        .eq("audiencia_id", audiencia.id);

      if (error) throw error;
      return data.map(a => a.advogado_id);
    },
    enabled: !!audiencia?.id && open,
  });

  useEffect(() => {
    if (audiencia) {
      let dataFormatted = "";
      if (audiencia.data_audiencia) {
        try {
          const date = parseISO(audiencia.data_audiencia);
          if (isValid(date)) {
            dataFormatted = format(date, "yyyy-MM-dd");
          }
        } catch {
          dataFormatted = "";
        }
      }

      setFormData({
        data_audiencia: dataFormatted,
        hora: audiencia.hora || "",
        hora_local: audiencia.hora_local || "",
        hora_brasilia: audiencia.hora_brasilia || "",
        processo_numero: audiencia.processo_numero || "",
        tipo_audiencia: audiencia.tipo_audiencia || "",
        vara_camara: audiencia.vara_camara || "",
        comarca: audiencia.comarca || "",
        polo_ativo: audiencia.polo_ativo || "",
        cliente: audiencia.cliente || "",
        terceirizado: audiencia.terceirizado || "",
        resumo_objeto: audiencia.resumo_objeto || "",
        funcao: audiencia.funcao || "",
        preposto: audiencia.preposto || "",
        testemunhas: audiencia.testemunhas || "",
        advogado: audiencia.advogado || "",
        observacoes: audiencia.observacoes || "",
        status: audiencia.status || "pendente",
        providencias_tomadas: audiencia.providencias_tomadas || "",
        modalidade: audiencia.modalidade || "",
        equipe: audiencia.equipe || "",
        nucleo_origem: audiencia.nucleo_origem || "",
        dossie: audiencia.dossie || "",
      });
    }
  }, [audiencia]);

  // Atualizar advogados selecionados quando carregar os vinculados
  useEffect(() => {
    if (advogadosVinculados.length > 0) {
      setSelectedAdvogados(advogadosVinculados);
    } else if (audiencia) {
      setSelectedAdvogados([]);
    }
  }, [advogadosVinculados, audiencia]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!audiencia) return;

    setIsLoading(true);
    try {
      // Converter data para formato ISO completo (timestamp with time zone)
      let dataAudienciaISO: string | null = null;
      if (formData.data_audiencia) {
        // Criar data com hora 12:00 para evitar problemas de timezone
        dataAudienciaISO = `${formData.data_audiencia}T12:00:00.000Z`;
      }

      const updateData: Record<string, any> = {
        data_audiencia: dataAudienciaISO,
        hora: formData.hora || null,
        hora_local: formData.hora_local || null,
        hora_brasilia: formData.hora_brasilia || null,
        processo_numero: formData.processo_numero || null,
        tipo_audiencia: formData.tipo_audiencia || null,
        vara_camara: formData.vara_camara || null,
        comarca: formData.comarca || null,
        polo_ativo: formData.polo_ativo || null,
        cliente: formData.cliente || null,
        terceirizado: formData.terceirizado || null,
        resumo_objeto: formData.resumo_objeto || null,
        funcao: formData.funcao || null,
        preposto: formData.preposto || null,
        testemunhas: formData.testemunhas || null,
        advogado: formData.advogado || null,
        observacoes: formData.observacoes || null,
        status: formData.status,
        providencias_tomadas: formData.providencias_tomadas || null,
        modalidade: formData.modalidade || null,
        equipe: formData.equipe || null,
        nucleo_origem: formData.nucleo_origem || null,
        dossie: formData.dossie || null,
      };

      // Se marcando como tratado, registrar quem e quando
      if (formData.status === "tratado" && audiencia.status !== "tratado") {
        const { data: { user } } = await supabase.auth.getUser();
        updateData.tratado_por = user?.id;
        updateData.tratado_em = new Date().toISOString();
      }

      const { error } = await supabase
        .from('audiencias_detectadas')
        .update(updateData)
        .eq('id', audiencia.id);

      if (error) throw error;

      // Atualizar advogados vinculados
      // Primeiro remove todos os existentes
      await supabase
        .from('audiencias_advogados')
        .delete()
        .eq('audiencia_id', audiencia.id);

      // Depois insere os novos
      if (selectedAdvogados.length > 0) {
        const advogadosInsert = selectedAdvogados.map(advogadoId => ({
          audiencia_id: audiencia.id,
          advogado_id: advogadoId,
        }));

        const { error: advError } = await supabase
          .from('audiencias_advogados')
          .insert(advogadosInsert);

        if (advError) {
          console.error('Erro ao vincular advogados:', advError);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['audiencias-detectadas'] });
      queryClient.invalidateQueries({ queryKey: ['audiencia-advogados', audiencia.id] });
      toast.success('Audiência atualizada com sucesso!');
      onOpenChange(false);
    } catch (error: any) {
      toast.error(`Erro ao atualizar: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Audiência</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Dados Principais */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="data_audiencia">Data</Label>
              <Input
                id="data_audiencia"
                type="date"
                value={formData.data_audiencia}
                onChange={(e) => handleChange("data_audiencia", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="processo_numero">Número do Processo</Label>
              <Input
                id="processo_numero"
                placeholder="0000000-00.0000.0.00.0000"
                value={formData.processo_numero}
                onChange={(e) => handleChange("processo_numero", e.target.value)}
              />
            </div>
          </div>

          {/* Horários */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="hora">Hora (original)</Label>
              <Input
                id="hora"
                placeholder="Ex: 14:00"
                value={formData.hora}
                onChange={(e) => handleChange("hora", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hora_local">Hora Local (Comarca)</Label>
              <Input
                id="hora_local"
                placeholder="Ex: 14:00"
                value={formData.hora_local}
                onChange={(e) => handleChange("hora_local", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hora_brasilia">Hora Brasília (DF)</Label>
              <Input
                id="hora_brasilia"
                placeholder="Ex: 15:00"
                value={formData.hora_brasilia}
                onChange={(e) => handleChange("hora_brasilia", e.target.value)}
              />
            </div>
          </div>

          {/* Tribunal, Local e Modalidade */}
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="modalidade">Modalidade</Label>
              <Select 
                value={formData.modalidade || ""} 
                onValueChange={(value) => handleChange("modalidade", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Virtual">Virtual</SelectItem>
                  <SelectItem value="Presencial">Presencial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="vara_camara">Órgão / Turma</Label>
              <Input
                id="vara_camara"
                placeholder="Ex: 1ª Turma"
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

          {/* Equipe, Origem e Dossiê */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="equipe">Equipe</Label>
              <Input
                id="equipe"
                placeholder="Ex: Núcleo de Terceiros"
                value={formData.equipe}
                onChange={(e) => handleChange("equipe", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nucleo_origem">Núcleo de Origem</Label>
              <Input
                id="nucleo_origem"
                placeholder="Ex: Núcleo Sudeste"
                value={formData.nucleo_origem}
                onChange={(e) => handleChange("nucleo_origem", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dossie">Dossiê</Label>
              <Input
                id="dossie"
                placeholder="Ex: 07.02.033.0001889121/14"
                value={formData.dossie}
                onChange={(e) => handleChange("dossie", e.target.value)}
              />
            </div>
          </div>

          {/* Partes */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="polo_ativo">Polo Ativo</Label>
              <Input
                id="polo_ativo"
                value={formData.polo_ativo}
                onChange={(e) => handleChange("polo_ativo", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cliente">Cliente</Label>
              <Input
                id="cliente"
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
                value={formData.terceirizado}
                onChange={(e) => handleChange("terceirizado", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="funcao">Função</Label>
              <Input
                id="funcao"
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
              value={formData.resumo_objeto}
              onChange={(e) => handleChange("resumo_objeto", e.target.value)}
              rows={3}
            />
          </div>

          {/* Advogados Responsáveis */}
          <SelecionarAdvogadosAudiencia
            selectedAdvogados={selectedAdvogados}
            onSelectionChange={setSelectedAdvogados}
          />

          {/* Participantes */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="preposto">Preposto</Label>
              <Input
                id="preposto"
                value={formData.preposto}
                onChange={(e) => handleChange("preposto", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="testemunhas">Testemunhas</Label>
              <Input
                id="testemunhas"
                value={formData.testemunhas}
                onChange={(e) => handleChange("testemunhas", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="advogado">Advogado (texto)</Label>
              <Input
                id="advogado"
                value={formData.advogado}
                onChange={(e) => handleChange("advogado", e.target.value)}
                placeholder="Advogado externo ou referência"
              />
            </div>
          </div>

          {/* Status e Providências */}
          <div className="border-t pt-4 mt-4">
            <h3 className="text-sm font-medium mb-3">Status e Providências</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="status">Situação</Label>
                <Select value={formData.status} onValueChange={(value) => handleChange("status", value)}>
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
                <Input
                  id="observacoes"
                  value={formData.observacoes}
                  onChange={(e) => handleChange("observacoes", e.target.value)}
                  placeholder="Observações gerais"
                />
              </div>
            </div>
            
            <div className="space-y-2 mt-4">
              <Label htmlFor="providencias_tomadas">Providências Tomadas</Label>
              <Textarea
                id="providencias_tomadas"
                value={formData.providencias_tomadas}
                onChange={(e) => handleChange("providencias_tomadas", e.target.value)}
                rows={3}
                placeholder="Descreva as providências tomadas (preposto confirmado, documentos enviados, etc.)"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Alterações
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}