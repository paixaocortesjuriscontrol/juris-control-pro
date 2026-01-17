import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  ArrowLeft,
  ListTodo,
  Activity,
  Paperclip,
  Users,
  DollarSign,
  Download,
  Clock,
  Scale,
  Calendar,
  FileText,
  Gavel,
  AlertCircle,
  FileBox,
  Newspaper,
  Shuffle,
  Radar,
  CalendarDays,
  Globe,
  User,
  Save,
  X,
  Edit
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { SelecionarResponsaveisProcesso } from "./SelecionarResponsaveisProcesso";

interface ProcessoEditarCompletoProps {
  processo: any;
  formData: Record<string, any>;
  responsaveis: any[];
  coordenacoes: any[];
  clientes: any[];
  salvando: boolean;
  onInputChange: (field: string, value: any) => void;
  onResponsaveisChange: (responsaveis: any[]) => void;
  onSalvar: () => void;
  onCancelar: () => void;
}

const statusOptions = ["ativo", "pendente", "urgente", "encerrado", "arquivado"];
const statusLabels: Record<string, string> = {
  ativo: "Ativo",
  pendente: "Pendente",
  urgente: "Urgente",
  encerrado: "Encerrado",
  arquivado: "Arquivado",
};

const areaOptions = ["civil", "trabalhista", "empresarial"];
const areaLabels: Record<string, string> = {
  civil: "Cível",
  trabalhista: "Trabalhista",
  empresarial: "Empresarial",
};

export function ProcessoEditarCompleto({
  processo,
  formData,
  responsaveis,
  coordenacoes,
  clientes,
  salvando,
  onInputChange,
  onResponsaveisChange,
  onSalvar,
  onCancelar,
}: ProcessoEditarCompletoProps) {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<string>("detalhes");

  const formatDate = (date: string | null | undefined) => {
    if (!date) return "";
    try {
      return format(new Date(date), "yyyy-MM-dd");
    } catch {
      return date;
    }
  };

  const EditableField = ({ 
    label, 
    field, 
    type = "text",
    className,
    options
  }: { 
    label: string; 
    field: string; 
    type?: "text" | "textarea" | "date" | "number" | "select";
    className?: string;
    options?: { value: string; label: string }[];
  }) => {
    const value = formData[field] ?? "";

    if (type === "select" && options) {
      return (
        <div className={className}>
          <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">{label}</p>
          <Select 
            value={value || "__none__"} 
            onValueChange={(v) => onInputChange(field, v === "__none__" ? "" : v)}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Não informado</SelectItem>
              {options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (type === "textarea") {
      return (
        <div className={className}>
          <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">{label}</p>
          <Textarea
            value={value}
            onChange={(e) => onInputChange(field, e.target.value)}
            className="min-h-[80px]"
          />
        </div>
      );
    }

    return (
      <div className={className}>
        <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">{label}</p>
        <Input
          type={type}
          value={value}
          onChange={(e) => onInputChange(field, e.target.value)}
          className="h-9"
        />
      </div>
    );
  };

  // Navigation items for sidebar
  const navItems = [
    { id: "detalhes", label: "Dados Básicos", icon: FileText },
    { id: "tribunal", label: "Tribunal", icon: Scale },
    { id: "partes", label: "Partes", icon: Users },
    { id: "administrativo", label: "Administrativo", icon: FileBox },
    { id: "contingencial", label: "Contingencial", icon: DollarSign },
    { id: "responsaveis", label: "Responsáveis", icon: User },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      {/* Top header bar - Fixed */}
      <div className="bg-background border-b px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onCancelar} className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <p className="text-xs text-muted-foreground">Editando Processo</p>
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-primary" />
              <h1 className="text-lg font-bold">{processo.numero}</h1>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onCancelar} disabled={salvando}>
            <X className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
          <Button size="sm" onClick={onSalvar} disabled={salvando}>
            <Save className="w-4 h-4 mr-2" />
            {salvando ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      {/* Content area with sidebar navigation */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar Navigation - Vertical on Desktop, Horizontal scroll on Mobile */}
        <div className="hidden md:flex flex-col w-48 bg-muted/30 border-r py-2 shrink-0">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-sm transition-colors text-left",
                  activeSection === item.id
                    ? "bg-primary/10 text-primary border-l-2 border-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Mobile Navigation - Horizontal */}
        <div className="md:hidden border-b bg-muted/30 overflow-x-auto shrink-0">
          <div className="flex">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 text-xs whitespace-nowrap transition-colors",
                    activeSection === item.id
                      ? "text-primary border-b-2 border-primary font-medium"
                      : "text-muted-foreground"
                  )}
                >
                  <Icon className="w-3 h-3" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <ScrollArea className="h-[calc(100vh-180px)]">
            <div className="p-4 sm:p-6 space-y-6">
              {/* DADOS BÁSICOS */}
              {activeSection === "detalhes" && (
                <div className="space-y-6">
                  <Card>
                    <CardHeader className="py-3 px-4 bg-muted/30">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Dados Básicos
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="py-4 px-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <EditableField 
                          label="Tipo de Processo" 
                          field="tipo_processo" 
                          type="select"
                          options={[
                            { value: "judicial", label: "Judicial" },
                            { value: "administrativo", label: "Administrativo" }
                          ]}
                        />
                        <EditableField label="Número" field="numero" />
                        <EditableField 
                          label="Área" 
                          field="area" 
                          type="select"
                          options={areaOptions.map(a => ({ value: a, label: areaLabels[a] }))}
                        />
                        <EditableField 
                          label="Status" 
                          field="status" 
                          type="select"
                          options={statusOptions.map(s => ({ value: s, label: statusLabels[s] }))}
                        />
                        <EditableField label="Assunto" field="assunto" className="md:col-span-2" />
                        <EditableField label="Classe CNJ" field="classe" />
                        <EditableField label="Natureza" field="natureza" />
                        <EditableField label="Matéria" field="materia" />
                        <EditableField label="Fase Processual" field="fase" />
                        <EditableField label="Data Distribuição" field="data_distribuicao" type="date" />
                        <EditableField label="Data Recebimento" field="data_recebimento" type="date" />
                        <EditableField label="Data Citação" field="data_citacao" type="date" />
                      </div>
                      <div className="grid grid-cols-1 gap-4 mt-4">
                        <EditableField label="Andamento Atual" field="andamento_atual" />
                        <EditableField label="Descrição" field="descricao" type="textarea" />
                        <EditableField label="Observações" field="observacoes_processo" type="textarea" />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Cliente e Pasta */}
                  <Card>
                    <CardHeader className="py-3 px-4 bg-muted/30">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        Cliente e Pasta
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="py-4 px-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                          <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">Cliente</p>
                          <Select 
                            value={formData.cliente_id || "__none__"} 
                            onValueChange={(v) => onInputChange("cliente_id", v === "__none__" ? "" : v)}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Selecione um cliente..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Nenhum cliente</SelectItem>
                              {clientes.map((c) => (
                                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">Coordenação</p>
                          <Select 
                            value={formData.coordenacao_id || "__none__"} 
                            onValueChange={(v) => onInputChange("coordenacao_id", v === "__none__" ? "" : v)}
                          >
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Selecione uma coordenação..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Nenhuma coordenação</SelectItem>
                              {coordenacoes.map((c) => (
                                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <EditableField label="Pasta do Cliente" field="pasta_cliente" />
                        <EditableField label="Pasta Física" field="pasta_fisica" />
                        <EditableField label="Unidade Cliente" field="unidade_cliente" />
                        <EditableField label="Sigla Unidade" field="sigla_unidade" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* TRIBUNAL / ÓRGÃO JULGADOR */}
              {activeSection === "tribunal" && (
                <Card>
                  <CardHeader className="py-3 px-4 bg-muted/30">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Scale className="w-4 h-4" />
                      Tribunal / Órgão Julgador
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-4 px-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <EditableField label="Tribunal" field="tribunal" />
                      <EditableField label="Justiça" field="justica" />
                      <EditableField label="Vara / Câmara" field="vara" />
                      <EditableField label="Instância" field="instancia" />
                      <EditableField label="Comarca" field="comarca" />
                      <EditableField label="UF" field="uf" />
                      <EditableField label="Esfera" field="esfera" />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* PARTES */}
              {activeSection === "partes" && (
                <Card>
                  <CardHeader className="py-3 px-4 bg-muted/30">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Partes do Processo
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-4 px-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <EditableField label="Polo Ativo (Autor / Requerente)" field="polo_ativo" type="textarea" />
                      <EditableField label="Polo Passivo (Réu / Requerido)" field="polo_passivo" type="textarea" />
                      <EditableField label="Terceiros Envolvidos" field="terceiro_envolvido" type="textarea" />
                      <EditableField label="Função da Parte Contrária" field="funcao_parte_contraria" />
                      <EditableField label="CPF/CNPJ Parte Contrária" field="cpf_cnpj_parte_contraria" />
                      <EditableField label="Reclamante" field="reclamante" />
                      <EditableField label="Reclamados" field="reclamados" type="textarea" className="md:col-span-2" />
                    </div>
                    <div className="mt-6 pt-4 border-t">
                      <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-2">Pedidos</p>
                      <Textarea
                        value={formData.pedidos || ""}
                        onChange={(e) => onInputChange("pedidos", e.target.value)}
                        className="min-h-[120px]"
                        placeholder="Liste os pedidos do processo..."
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* ADMINISTRATIVO */}
              {activeSection === "administrativo" && (
                <Card className="border-orange-200 dark:border-orange-900/50">
                  <CardHeader className="py-3 px-4 bg-orange-50 dark:bg-orange-900/20">
                    <CardTitle className="text-sm flex items-center gap-2 text-orange-700 dark:text-orange-400">
                      <FileBox className="w-4 h-4" />
                      Dados Administrativos (e-Processo)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-4 px-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <EditableField label="Auto de Infração" field="auto_infracao" />
                      <EditableField label="Órgão de Origem" field="orgao_origem" />
                      <EditableField label="CNPJ Fiscalizado" field="cnpj_fiscalizado" />
                      <EditableField label="NIT / PIS" field="nit_fiscalizado" />
                      <EditableField label="Valor da Multa" field="valor_multa" type="number" />
                      <EditableField label="Data Lavratura" field="data_lavratura" type="date" />
                      <EditableField label="Fiscal Responsável" field="fiscal_responsavel" />
                      <EditableField label="Data Situação" field="data_situacao" type="date" />
                      <EditableField label="Cargo Reconhecimento Vínculo" field="cargo_reconhecimento_vinculo" />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* CONTINGENCIAL */}
              {activeSection === "contingencial" && (
                <div className="space-y-6">
                  <Card className="border-purple-200 dark:border-purple-900/50">
                    <CardHeader className="py-3 px-4 bg-purple-50 dark:bg-purple-900/20">
                      <CardTitle className="text-sm flex items-center gap-2 text-purple-700 dark:text-purple-400">
                        <DollarSign className="w-4 h-4" />
                        Dados Contingenciais
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="py-4 px-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <EditableField 
                          label="Posição do Cliente" 
                          field="ativo_passivo" 
                          type="select"
                          options={[
                            { value: "ativo", label: "Ativo (Autor)" },
                            { value: "passivo", label: "Passivo (Réu)" }
                          ]}
                        />
                        <EditableField label="Tipo de Responsabilidade" field="responsabilidade_tipo" />
                        <EditableField 
                          label="Risco Atual" 
                          field="risco_atual" 
                          type="select"
                          options={[
                            { value: "provável", label: "Provável" },
                            { value: "possível", label: "Possível" },
                            { value: "remoto", label: "Remoto" }
                          ]}
                        />
                        <EditableField 
                          label="Probabilidade" 
                          field="probabilidade" 
                          type="select"
                          options={[
                            { value: "alta", label: "Alta" },
                            { value: "media", label: "Média" },
                            { value: "baixa", label: "Baixa" }
                          ]}
                        />
                        <EditableField label="Valor da Causa" field="valor_causa" type="number" />
                        <EditableField label="Valor Condenação" field="valor_condenacao" type="number" />
                        <EditableField label="Valor Provisionado" field="valor_provisionado" type="number" />
                        <EditableField label="Depósito Judicial" field="deposito_judicial" type="number" />
                        <EditableField label="Valor Pago" field="valor_pago" type="number" />
                        <EditableField label="Função/Cargo" field="funcao" />
                        <EditableField label="Advogado Externo" field="advogado_externo" />
                        <EditableField label="Data Fato Gerador" field="data_fato_gerador" type="date" />
                        <EditableField label="Data Desligamento" field="data_desligamento" type="date" />
                        <EditableField label="Período Laborado" field="periodo_laborado" />
                        <EditableField label="Período Condenação" field="periodo_condenacao" />
                      </div>
                      <div className="grid grid-cols-1 gap-4 mt-4">
                        <EditableField label="Justificativa de Risco" field="justificativa_risco" type="textarea" />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Encerramento */}
                  <Card>
                    <CardHeader className="py-3 px-4 bg-muted/30">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Dados de Encerramento
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="py-4 px-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <EditableField label="Data Encerramento" field="data_encerramento" type="date" />
                        <EditableField label="Data Arquivamento" field="data_arquivamento" type="date" />
                        <EditableField label="Motivo Encerramento" field="motivo_encerramento" />
                        <EditableField label="Custo Encerramento" field="custo_encerramento" type="number" />
                        <EditableField label="Resultado" field="resultado" />
                        <div className="flex items-center gap-3 pt-6">
                          <Switch 
                            checked={formData.transitado_julgado || false}
                            onCheckedChange={(checked) => onInputChange("transitado_julgado", checked)}
                          />
                          <span className="text-sm">Transitado em Julgado</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* RESPONSÁVEIS */}
              {activeSection === "responsaveis" && (
                <Card>
                  <CardHeader className="py-3 px-4 bg-muted/30">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Responsáveis pelo Processo
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="py-4 px-4">
                    <SelecionarResponsaveisProcesso
                      processoId={processo.id}
                      value={responsaveis}
                      onChange={onResponsaveisChange}
                    />
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
