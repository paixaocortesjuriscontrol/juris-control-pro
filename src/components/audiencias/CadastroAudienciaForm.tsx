import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Loader2, Plus, Search } from "lucide-react";
import { useAudienciasDetectadas, NovaAudiencia } from "@/hooks/useAudienciasDetectadas";
import { SelecionarAdvogadosAudiencia } from "./SelecionarAdvogadosAudiencia";
import { MultiUserSelect } from "@/components/shared/MultiUserSelect";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { formatProcessoNumero } from "@/lib/utils";

interface CadastroAudienciaFormProps {
  defaultProcessoNumero?: string;
}

export function CadastroAudienciaForm({ defaultProcessoNumero }: CadastroAudienciaFormProps = {}) {
  const { criarAudiencia } = useAudienciasDetectadas();
  const [advogadosSelecionados, setAdvogadosSelecionados] = useState<string[]>([]);
  const [envolvidosIds, setEnvolvidosIds] = useState<string[]>([]);
  const [buscandoProcesso, setBuscandoProcesso] = useState(false);
  const [formData, setFormData] = useState<Omit<NovaAudiencia, 'advogados_ids'>>({
    processo_numero: defaultProcessoNumero ?? "",
    data_audiencia: "",
    hora: "",
    hora_local: "",
    hora_brasilia: "",
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
    modalidade: "",
    equipe: "",
    nucleo_origem: "",
    dossie: "",
  });
  const autoBuscaRef = useRef(false);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleBuscarProcesso = async () => {
    const numero = formData.processo_numero?.trim();
    if (!numero) {
      toast({ title: "Informe o número do processo", variant: "destructive" });
      return;
    }
    return await buscarProcessoPorNumero(numero, true);
  };

  const buscarProcessoPorNumero = async (numero: string, showToast: boolean) => {
    setBuscandoProcesso(true);
    try {
      const numeroDigits = numero.replace(/\D/g, "");
      const numeroMasked = formatProcessoNumero(numero);
      const candidatos = Array.from(new Set([numeroMasked, numero, numeroDigits].filter(Boolean)));
      const orExpr = candidatos.map((c) => `numero.ilike.%${c}%`).join(",");
      const { data, error } = await supabase
        .from("processos")
        .select("numero, polo_ativo, polo_passivo, vara, comarca, tribunal")
        .or(orExpr)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        if (showToast) toast({ title: "Processo não encontrado", variant: "destructive" });
        return;
      }
      setFormData(prev => ({
        ...prev,
        processo_numero: data.numero ?? prev.processo_numero,
        polo_ativo: data.polo_ativo ?? prev.polo_ativo,
        cliente: data.polo_passivo ?? prev.cliente,
        vara_camara: data.vara ?? prev.vara_camara,
        comarca: data.comarca ?? prev.comarca,
      }));
      if (showToast) toast({ title: "Dados do processo carregados" });
    } catch (err: any) {
      if (showToast) toast({ title: "Erro ao buscar processo", description: err.message, variant: "destructive" });
    } finally {
      setBuscandoProcesso(false);
    }
  };

  // Auto-buscar quando recebermos defaultProcessoNumero (ex.: vindo da publicação DJEN)
  useEffect(() => {
    if (defaultProcessoNumero && !autoBuscaRef.current) {
      autoBuscaRef.current = true;
      buscarProcessoPorNumero(defaultProcessoNumero, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultProcessoNumero]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.processo_numero || !formData.data_audiencia) {
      return;
    }

    await criarAudiencia.mutateAsync({
      ...formData,
      advogados_ids: advogadosSelecionados,
      envolvidos_ids: envolvidosIds,
    });
    
    // Limpar formulário
    setFormData({
      processo_numero: "",
      data_audiencia: "",
      hora: "",
      hora_local: "",
      hora_brasilia: "",
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
      modalidade: "",
      equipe: "",
      nucleo_origem: "",
      dossie: "",
    });
    setAdvogadosSelecionados([]);
    setEnvolvidosIds([]);
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
          <div className="grid gap-4 md:grid-cols-2">
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
              <Label htmlFor="processo_numero">Número do Processo *</Label>
              <div className="flex gap-2">
                <Input
                  id="processo_numero"
                  placeholder="0000000-00.0000.0.00.0000"
                  value={formData.processo_numero}
                  onChange={(e) => handleChange("processo_numero", e.target.value)}
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBuscarProcesso}
                  disabled={buscandoProcesso}
                  title="Buscar dados do processo"
                >
                  {buscandoProcesso ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Horários */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="hora">Hora (original)</Label>
              <Input
                id="hora"
                type="text"
                placeholder="Ex: 14:00"
                value={formData.hora}
                onChange={(e) => handleChange("hora", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hora_local">Hora Local (Comarca)</Label>
              <Input
                id="hora_local"
                type="text"
                placeholder="Ex: 14:00"
                value={formData.hora_local}
                onChange={(e) => handleChange("hora_local", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hora_brasilia">Hora Brasília (DF)</Label>
              <Input
                id="hora_brasilia"
                type="text"
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
          <div className="grid gap-4 md:grid-cols-2">
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
          </div>

          {/* Seleção de Advogados */}
          <SelecionarAdvogadosAudiencia
            selectedAdvogados={advogadosSelecionados}
            onSelectionChange={setAdvogadosSelecionados}
          />

          {/* Envolvidos (apenas acompanham) */}
          <MultiUserSelect
            label="Envolvidos (acompanham)"
            helperText="Recebem a audiência apenas para acompanhamento"
            selectedIds={envolvidosIds}
            onChange={setEnvolvidosIds}
            height={180}
          />

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