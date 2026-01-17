import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Copy } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  ArrowLeft,
  Activity,
  Users,
  DollarSign,
  Clock,
  Scale,
  FileText,
  FileBox,
  Save,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
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

// Navigation items for sidebar - same as details view
const navItems = [
  { id: "detalhes", label: "Detalhes", icon: FileText },
];

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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
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
          <p className="text-xs font-medium text-blue-600 dark:text-blue-400">{label}</p>
          <Select 
            value={value || "__none__"} 
            onValueChange={(v) => onInputChange(field, v === "__none__" ? "" : v)}
          >
            <SelectTrigger className="h-8 mt-0.5">
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
          <p className="text-xs font-medium text-blue-600 dark:text-blue-400">{label}</p>
          <Textarea
            value={value}
            onChange={(e) => onInputChange(field, e.target.value)}
            className="min-h-[60px] mt-0.5"
          />
        </div>
      );
    }

    return (
      <div className={className}>
        <p className="text-xs font-medium text-blue-600 dark:text-blue-400">{label}</p>
        <Input
          type={type}
          value={value}
          onChange={(e) => onInputChange(field, e.target.value)}
          className="h-8 mt-0.5"
        />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header compacto - igual ao de detalhes */}
      <div className="border-b bg-card">
        <div className="flex items-center gap-3 px-2 sm:px-4 py-2">
          <Button variant="ghost" size="sm" onClick={onCancelar}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Voltar</span>
          </Button>
          
          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
            {formData.polo_passivo && (
              <div className="flex items-center gap-1">
                <span className="font-medium text-sm truncate max-w-[120px] sm:max-w-[200px]">{formData.polo_passivo}</span>
                <Badge className="text-[9px] px-1 py-0 bg-emerald-100 text-emerald-700">Req.</Badge>
              </div>
            )}
            {formData.polo_ativo && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground text-sm">×</span>
                <span className="font-medium text-sm truncate max-w-[120px] sm:max-w-[200px]">{formData.polo_ativo}</span>
                <Badge className="text-[9px] px-1 py-0 bg-zinc-100 text-zinc-700">Reqte.</Badge>
              </div>
            )}
          </div>

          <Badge className="bg-blue-600 text-white text-xs hidden sm:inline-flex">Judicial</Badge>
          <Button variant="outline" size="sm" onClick={onCancelar} disabled={salvando} className="hidden sm:inline-flex">
            <X className="w-4 h-4 mr-1" />
            Cancelar
          </Button>
          <Button size="sm" onClick={onSalvar} disabled={salvando} className="hidden sm:inline-flex">
            <Save className="w-4 h-4 mr-1" />
            {salvando ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      {/* Subheader compacto - Número e Assunto */}
      <div className="border-b bg-muted/30 px-2 sm:px-4 py-2">
        <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-6">
          {/* Número + Botões mobile */}
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Número</p>
              <div className="flex items-center gap-1">
                <p className="text-xs sm:text-sm font-mono">{formData.numero}</p>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-5 w-5"
                  onClick={() => copyToClipboard(formData.numero)}
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>
            {/* Botões Detalhes, Cancelar, Salvar - visíveis apenas no mobile */}
            <div className="flex items-center gap-1 sm:hidden">
              <Button variant="secondary" size="sm" onClick={onCancelar}>
                <FileText className="w-4 h-4 mr-1" />
                Detalhes
              </Button>
              <Button variant="outline" size="sm" onClick={onCancelar} disabled={salvando}>
                <X className="w-4 h-4" />
                <span className="hidden">Cancelar</span>
              </Button>
              <Button size="sm" onClick={onSalvar} disabled={salvando}>
                <Save className="w-4 h-4 mr-1" />
                {salvando ? "..." : "Salvar"}
              </Button>
            </div>
          </div>
          
          {/* Assunto - abaixo no mobile, ao lado no desktop */}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-muted-foreground uppercase">Assunto</p>
            <Textarea
              value={formData.assunto || ""}
              onChange={(e) => onInputChange("assunto", e.target.value)}
              className="min-h-[100px] text-xs sm:text-sm resize-none"
              placeholder="Digite o assunto..."
            />
          </div>
        </div>
      </div>

      {/* Main Content - Sidebar + Content (igual ao de detalhes) */}
      <div className="flex flex-col sm:flex-row min-w-0">
        {/* Sidebar Navigation */}
        <aside className="w-full sm:w-36 md:w-44 border-b sm:border-b-0 sm:border-r bg-muted/20 flex-shrink-0">
          {/* Mobile: horizontal scroll */}
          <div className="sm:hidden overflow-x-auto pb-1">
            <nav className="flex gap-1 px-2 py-2 min-w-max">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  className="flex items-center gap-1 px-2 py-1.5 text-[11px] rounded-md whitespace-nowrap bg-primary text-primary-foreground font-medium"
                >
                  <item.icon className="w-3 h-3 flex-shrink-0" />
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </div>
          {/* Desktop: vertical sidebar */}
          <ScrollArea className="hidden sm:block h-[calc(100vh-120px)]">
            <nav className="py-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-left bg-primary/10 text-primary border-r-2 border-primary font-medium"
                >
                  <item.icon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              ))}
            </nav>
          </ScrollArea>
        </aside>

        {/* Content Area */}
        <div className="flex-1 min-w-0">
          <ScrollArea className="h-[calc(100vh-120px)]">
            <div className="p-3 sm:p-4 space-y-6">
              {/* MONITORAMENTO E PARTES - Card destacado (igual ao de detalhes) */}
              <Card className="border-l-4 border-l-primary">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Activity className="w-4 h-4" />
                    Monitoramento e Partes
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-3 px-4 space-y-4">
                  {/* Monitoramento */}
                  <div className="flex items-center gap-6 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="monitorar_andamentos"
                        checked={formData.monitorar_andamentos || false}
                        onCheckedChange={(checked) => onInputChange("monitorar_andamentos", checked)}
                      />
                      <Label htmlFor="monitorar_andamentos" className="text-xs">Monitorar Andamentos</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="monitorar_djen"
                        checked={formData.monitorar_djen || false}
                        onCheckedChange={(checked) => onInputChange("monitorar_djen", checked)}
                      />
                      <Label htmlFor="monitorar_djen" className="text-xs">Monitorar DJEN</Label>
                    </div>
                    <div>
                      <EditableField 
                        label="Status" 
                        field="status" 
                        type="select"
                        options={statusOptions.map(s => ({ value: s, label: statusLabels[s] }))}
                      />
                    </div>
                  </div>

                  {/* Envolvidos - edição direta dos polos */}
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase mb-2">Envolvidos</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Polo Passivo (Requerido)</p>
                        <Input
                          value={formData.polo_passivo || ""}
                          onChange={(e) => onInputChange("polo_passivo", e.target.value)}
                          className="h-8 mt-0.5"
                          placeholder="Nome do requerido..."
                        />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Polo Ativo (Requerente)</p>
                        <Input
                          value={formData.polo_ativo || ""}
                          onChange={(e) => onInputChange("polo_ativo", e.target.value)}
                          className="h-8 mt-0.5"
                          placeholder="Nome do requerente..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* Responsáveis */}
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase mb-2">Responsáveis</p>
                    <SelecionarResponsaveisProcesso
                      value={responsaveis}
                      onChange={onResponsaveisChange}
                    />
                  </div>

                  {/* Valor da Ação e Pasta */}
                  <div className="grid grid-cols-2 gap-4">
                    <EditableField label="Valor da Ação" field="valor_causa" type="number" />
                    <EditableField label="Pasta do Cliente" field="pasta_cliente" />
                  </div>
                </CardContent>
              </Card>

              {/* DADOS BÁSICOS */}
              <Card>
                <CardHeader className="py-3 px-4 bg-muted/30">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Dados Básicos
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-3 px-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
                      label="Situação" 
                      field="status" 
                      type="select"
                      options={statusOptions.map(s => ({ value: s, label: statusLabels[s] }))}
                    />
                    <EditableField label="Assunto" field="assunto" className="col-span-2" />
                    <EditableField label="Classe CNJ" field="classe" />
                    <EditableField label="Natureza" field="natureza" />
                    <EditableField label="Data Distribuição" field="data_distribuicao" type="date" />
                    <EditableField label="Data Recebimento" field="data_recebimento" type="date" />
                    <EditableField label="Data Citação" field="data_citacao" type="date" />
                    <div>
                      <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Cliente</p>
                      <Select 
                        value={formData.cliente_id || "__none__"} 
                        onValueChange={(v) => onInputChange("cliente_id", v === "__none__" ? "" : v)}
                      >
                        <SelectTrigger className="h-8 mt-0.5">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Não informado</SelectItem>
                          {clientes.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <EditableField label="Pasta Física" field="pasta_fisica" />
                    <div>
                      <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Coordenação</p>
                      <Select 
                        value={formData.coordenacao_id || "__none__"} 
                        onValueChange={(v) => onInputChange("coordenacao_id", v === "__none__" ? "" : v)}
                      >
                        <SelectTrigger className="h-8 mt-0.5">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Não informado</SelectItem>
                          {coordenacoes.map((c) => (
                            <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="mt-4">
                    <EditableField label="Descrição" field="descricao" type="textarea" />
                  </div>
                </CardContent>
              </Card>

              {/* TRIBUNAL / ÓRGÃO JULGADOR */}
              <Card>
                <CardHeader className="py-3 px-4 bg-muted/30">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Scale className="w-4 h-4" />
                    Tribunal / Órgão Julgador
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-3 px-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    <EditableField label="Tribunal" field="tribunal" />
                    <EditableField label="Justiça" field="justica" />
                    <EditableField label="Vara / Câmara" field="vara" />
                    <EditableField label="Instância" field="instancia" />
                    <EditableField label="Comarca" field="comarca" />
                    <EditableField label="UF" field="uf" />
                    <EditableField label="Fase Processual" field="fase" />
                    <EditableField label="Esfera" field="esfera" />
                    <EditableField label="Sistema" field="sistema" />
                    <EditableField label="Órgão Julgador" field="orgao_julgador" />
                    <EditableField label="Matéria" field="materia" />
                  </div>
                </CardContent>
              </Card>

              {/* PARTES DO PROCESSO */}
              <Card>
                <CardHeader className="py-3 px-4 bg-muted/30">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Partes do Processo
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-3 px-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <EditableField label="Polo Ativo (Autor / Requerente)" field="polo_ativo" type="textarea" />
                    <EditableField label="Polo Passivo (Réu / Requerido)" field="polo_passivo" type="textarea" />
                    <EditableField label="Terceiros Envolvidos" field="terceiro_envolvido" type="textarea" />
                    <EditableField label="Reclamante" field="reclamante" />
                    <EditableField label="Reclamados" field="reclamados" type="textarea" className="md:col-span-2" />
                  </div>
                  <div className="mt-4 pt-4 border-t">
                    <div>
                      <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Pedidos</p>
                      <Textarea
                        value={formData.pedidos || ""}
                        onChange={(e) => onInputChange("pedidos", e.target.value)}
                        className="min-h-[150px] mt-0.5"
                        placeholder="Liste os pedidos do processo..."
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* DADOS ADMINISTRATIVOS */}
              <Card className="border-orange-200 dark:border-orange-900/50">
                <CardHeader className="py-3 px-4 bg-orange-50 dark:bg-orange-900/20">
                  <CardTitle className="text-sm flex items-center gap-2 text-orange-700 dark:text-orange-400">
                    <FileBox className="w-4 h-4" />
                    Dados Administrativos
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-3 px-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    <EditableField label="Auto de Infração" field="auto_infracao" />
                    <EditableField label="Órgão de Origem" field="orgao_origem" />
                    <EditableField label="CNPJ Fiscalizado" field="cnpj_fiscalizado" />
                    <EditableField label="NIT / PIS" field="nit_fiscalizado" />
                    <EditableField label="Valor da Multa" field="valor_multa" type="number" />
                    <EditableField label="Data Lavratura" field="data_lavratura" type="date" />
                    <EditableField label="Fiscal Responsável" field="fiscal_responsavel" />
                  </div>
                </CardContent>
              </Card>

              {/* DADOS CONTINGENCIAIS */}
              <Card className="border-purple-200 dark:border-purple-900/50">
                <CardHeader className="py-3 px-4 bg-purple-50 dark:bg-purple-900/20">
                  <CardTitle className="text-sm flex items-center gap-2 text-purple-700 dark:text-purple-400">
                    <DollarSign className="w-4 h-4" />
                    Dados Contingenciais
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-3 px-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    <EditableField label="Posição do Cliente" field="ativo_passivo" />
                    <EditableField label="Tipo de Responsabilidade" field="responsabilidade_tipo" />
                    <EditableField label="Risco Atual" field="risco_atual" />
                    <EditableField label="Probabilidade" field="probabilidade" />
                    <EditableField label="Valor da Causa" field="valor_causa" type="number" />
                    <EditableField label="Valor da Condenação" field="valor_condenacao" type="number" />
                    <EditableField label="Valor Provisionado" field="valor_provisionado" type="number" />
                    <EditableField label="Função/Cargo" field="funcao" />
                    <EditableField label="Advogado Externo" field="advogado_externo" />
                    <EditableField label="Risco" field="risco" />
                  </div>
                </CardContent>
              </Card>

              {/* Informações do Sistema */}
              <Card className="border-muted">
                <CardHeader className="py-2 px-4 bg-muted/20">
                  <CardTitle className="text-xs text-muted-foreground flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    Informações do Sistema
                  </CardTitle>
                </CardHeader>
                <CardContent className="py-2 px-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-muted-foreground">Criado em:</span>
                      <span className="ml-1">{processo.created_at ? new Date(processo.created_at).toLocaleString("pt-BR") : "-"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Atualizado em:</span>
                      <span className="ml-1">{processo.updated_at ? new Date(processo.updated_at).toLocaleString("pt-BR") : "-"}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}
