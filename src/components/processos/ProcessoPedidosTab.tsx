import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, 
  Shield, 
  AlertTriangle, 
  Gavel, 
  DollarSign,
  Heart,
  FileText,
  CheckCircle,
  XCircle,
  Briefcase
} from "lucide-react";
import { PedidosEditableTable } from "./PedidosEditableTable";

interface ProcessoPedidosTabProps {
  processo: any;
}

// Helper to check if a value is truthy or contains meaningful content
const hasValue = (val: any): boolean => {
  if (val === null || val === undefined || val === "" || val === false) return false;
  if (typeof val === "string") {
    const lower = val.toLowerCase().trim();
    return lower !== "não" && lower !== "n" && lower !== "nao" && lower !== "-" && lower.length > 0;
  }
  return true;
};

// Helper to render field value with appropriate icon
const renderFieldValue = (val: any): React.ReactNode => {
  if (!hasValue(val)) return null;
  
  if (typeof val === "boolean") {
    return val ? (
      <Badge variant="default" className="bg-green-600">
        <CheckCircle className="w-3 h-3 mr-1" /> Sim
      </Badge>
    ) : null;
  }
  
  const strVal = String(val).trim();
  const lower = strVal.toLowerCase();
  
  if (lower === "sim" || lower === "s" || lower === "true" || lower === "x") {
    return (
      <Badge variant="default" className="bg-green-600">
        <CheckCircle className="w-3 h-3 mr-1" /> Sim
      </Badge>
    );
  }
  
  return <span className="text-sm text-foreground">{strVal}</span>;
};

interface PedidoFieldProps {
  label: string;
  value: any;
}

const PedidoField = ({ label, value }: PedidoFieldProps) => {
  if (!hasValue(value)) return null;
  
  return (
    <div className="flex items-start justify-between py-2 border-b last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="text-right ml-4">{renderFieldValue(value)}</div>
    </div>
  );
};

interface PedidoSectionProps {
  title: string;
  icon: React.ReactNode;
  fields: { label: string; value: any }[];
}

const PedidoSection = ({ title, icon, fields }: PedidoSectionProps) => {
  const activeFields = fields.filter(f => hasValue(f.value));
  if (activeFields.length === 0) return null;
  
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          {icon}
          {title}
          <Badge variant="secondary" className="ml-auto">{activeFields.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {activeFields.map((field, idx) => (
          <PedidoField key={idx} label={field.label} value={field.value} />
        ))}
      </CardContent>
    </Card>
  );
};

export function ProcessoPedidosTab({ processo }: ProcessoPedidosTabProps) {
  // Count total pedidos with values
  const pedidosFields = [
    processo.pedido_excesso_jornada,
    processo.pedido_plantoes_extras,
    processo.pedido_dobras,
    processo.pedido_intervalo_intrajornada,
    processo.pedido_intervalo_interjornada,
    processo.pedido_descaract_jornada_12_36,
    processo.pedido_domingos_feriados,
    processo.pedido_insalubridade_periculosidade,
    processo.pedido_diferencas_salariais,
    processo.pedido_adicional_noturno,
    processo.pedido_sobrecarga_trabalho,
    processo.pedido_reconhecimento_vinculo,
    processo.pedido_danos_morais_assedio,
    processo.pedido_danos_morais_outros,
    processo.pedido_acidente_doenca,
    processo.pedido_danos_materiais,
    processo.pedido_pensao_vitalicia,
    processo.pedido_danos_morais_acidente,
    processo.pedido_limbo_previdenciario,
    processo.pedido_estabilidade,
    processo.pedido_indenizacao_substitutiva,
    processo.pedido_reversao_justa_causa,
    processo.pedido_rescisao_indireta,
    processo.pedido_reversao_pedido_demissao,
    processo.pedido_multas_clt,
    processo.pedido_multas_ccts,
  ];
  
  const totalPedidos = pedidosFields.filter(hasValue).length;
  
  // Check if there's any data
  const hasAnyPedido = totalPedidos > 0 || 
    hasValue(processo.pedido_valor) || 
    hasValue(processo.pedidos) ||
    hasValue(processo.periodo_contratacao) ||
    hasValue(processo.lei_13467_2017) ||
    hasValue(processo.responsabilidade_subsidiaria);
  
  return (
    <div className="space-y-6">
      {/* Tabela Editável de Pedidos */}
      <PedidosEditableTable processoId={processo.id} />

      {/* Dados Importados da Planilha - só mostra se houver dados */}
      {hasAnyPedido && (
        <>
          {/* Summary Card */}
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
        <CardContent className="py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Gavel className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Pedidos</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{totalPedidos}</p>
              </div>
            </div>
            {hasValue(processo.pedido_valor) && (
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                  <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Valor dos Pedidos</p>
                  <p className="text-xl font-bold text-green-600 dark:text-green-400">{processo.pedido_valor}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Contract & Subsidiary Info */}
      <PedidoSection
        title="Contrato de Trabalho"
        icon={<Briefcase className="w-4 h-4" />}
        fields={[
          { label: "Período de Contratação", value: processo.periodo_contratacao },
          { label: "Lei 13.467/2017 (Reforma)", value: processo.lei_13467_2017 },
          { label: "Responsabilidade Subsidiária", value: processo.responsabilidade_subsidiaria },
          { label: "Obs. Resp. Subsidiária", value: processo.observacao_resp_subsidiaria },
        ]}
      />

      {/* Horas Extras */}
      <PedidoSection
        title="Horas Extras / Jornada"
        icon={<Clock className="w-4 h-4" />}
        fields={[
          { label: "Excesso de Jornada", value: processo.pedido_excesso_jornada },
          { label: "Plantões Extras", value: processo.pedido_plantoes_extras },
          { label: "Dobras", value: processo.pedido_dobras },
          { label: "Intervalo Intrajornada", value: processo.pedido_intervalo_intrajornada },
          { label: "Intervalo Interjornada", value: processo.pedido_intervalo_interjornada },
          { label: "Descaract. Jornada 12x36", value: processo.pedido_descaract_jornada_12_36 },
          { label: "Domingos e Feriados", value: processo.pedido_domingos_feriados },
        ]}
      />

      {/* Adicionais */}
      <PedidoSection
        title="Adicionais e Diferenças"
        icon={<DollarSign className="w-4 h-4" />}
        fields={[
          { label: "Insalubridade/Periculosidade", value: processo.pedido_insalubridade_periculosidade },
          { label: "Diferenças Salariais", value: processo.pedido_diferencas_salariais },
          { label: "Adicional Noturno", value: processo.pedido_adicional_noturno },
          { label: "Sobrecarga de Trabalho", value: processo.pedido_sobrecarga_trabalho },
        ]}
      />

      {/* Vínculo e Estabilidade */}
      <PedidoSection
        title="Vínculo e Estabilidade"
        icon={<Shield className="w-4 h-4" />}
        fields={[
          { label: "Reconhecimento de Vínculo", value: processo.pedido_reconhecimento_vinculo },
          { label: "Cargo (Reconh. Vínculo)", value: processo.cargo_reconhecimento_vinculo },
          { label: "Estabilidade", value: processo.pedido_estabilidade },
          { label: "Tipo de Estabilidade", value: processo.tipo_estabilidade },
        ]}
      />

      {/* Danos Morais */}
      <PedidoSection
        title="Danos Morais"
        icon={<Heart className="w-4 h-4" />}
        fields={[
          { label: "Assédio Moral/Sexual", value: processo.pedido_danos_morais_assedio },
          { label: "Outros Danos Morais", value: processo.pedido_danos_morais_outros },
        ]}
      />

      {/* Acidente e Doença */}
      <PedidoSection
        title="Acidente / Doença Ocupacional"
        icon={<AlertTriangle className="w-4 h-4" />}
        fields={[
          { label: "Acidente/Doença", value: processo.pedido_acidente_doenca },
          { label: "Danos Materiais", value: processo.pedido_danos_materiais },
          { label: "Pensão Vitalícia", value: processo.pedido_pensao_vitalicia },
          { label: "Danos Morais (Acidente)", value: processo.pedido_danos_morais_acidente },
          { label: "Limbo Previdenciário", value: processo.pedido_limbo_previdenciario },
        ]}
      />

      {/* Rescisão e Indenização */}
      <PedidoSection
        title="Rescisão e Indenização"
        icon={<Gavel className="w-4 h-4" />}
        fields={[
          { label: "Indenização Substitutiva", value: processo.pedido_indenizacao_substitutiva },
          { label: "Reversão Justa Causa", value: processo.pedido_reversao_justa_causa },
          { label: "Rescisão Indireta", value: processo.pedido_rescisao_indireta },
          { label: "Reversão Pedido Demissão", value: processo.pedido_reversao_pedido_demissao },
        ]}
      />

      {/* Multas */}
      <PedidoSection
        title="Multas"
        icon={<FileText className="w-4 h-4" />}
        fields={[
          { label: "Multas CLT", value: processo.pedido_multas_clt },
          { label: "Multas CCTs", value: processo.pedido_multas_ccts },
        ]}
      />

      {/* Pedidos Gerais */}
      {hasValue(processo.pedidos) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Observações / Pedidos Gerais
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground whitespace-pre-wrap">{processo.pedidos}</p>
          </CardContent>
        </Card>
      )}
        </>
      )}
    </div>
  );
}
