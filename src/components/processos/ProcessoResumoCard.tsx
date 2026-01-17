import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Info, 
  ExternalLink, 
  Copy, 
  Bell, 
  BellOff, 
  Scale 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Responsavel {
  id: string;
  nome: string;
}

interface ProcessoResumoCardProps {
  processo: {
    id: string;
    numero: string;
    status: string;
    area: string;
    assunto?: string | null;
    polo_ativo?: string | null;
    polo_passivo?: string | null;
    terceiro_envolvido?: string | null;
    tribunal?: string | null;
    vara?: string | null;
    comarca?: string | null;
    orgao_julgador?: string | null;
    data_distribuicao?: string | null;
    fase?: string | null;
    sistema?: string | null;
    valor_causa?: number | null;
    pasta_fisica?: string | null;
    pasta_cliente?: string | null;
    descricao?: string | null;
    monitorar_andamentos?: boolean | null;
    advogado_responsavel?: { id: string; nome: string } | null;
    cliente?: { id: string; nome: string; tipo: string } | null;
    pasta?: { id: string; nome: string } | null;
  };
  responsaveis: Responsavel[];
  onMaisInformacoes: () => void;
  onExpandirEnvolvidos?: () => void;
  onAbrirProcessoExterno?: () => void;
}

const statusLabels: Record<string, string> = {
  ativo: "Ativo",
  pendente: "Pendente",
  urgente: "Urgente",
  encerrado: "Encerrado",
  arquivado: "Arquivado",
};

const areaLabels: Record<string, string> = {
  civil: "Cível",
  trabalhista: "Trabalhista",
  empresarial: "Empresarial",
};

export function ProcessoResumoCard({ processo, responsaveis, onMaisInformacoes, onExpandirEnvolvidos, onAbrirProcessoExterno }: ProcessoResumoCardProps) {
  const formatCurrency = (value: number | null | undefined) => {
    if (!value) return "Não informado";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return "Não informado";
    return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const clienteNome = processo.cliente?.nome || processo.polo_passivo || "Cliente não identificado";

  return (
    <div className="space-y-4">
      {/* Header com nome do cliente */}
      <div className="border-b pb-3">
        <h1 className="text-xl md:text-2xl font-bold text-foreground">{clienteNome}</h1>
      </div>

      {/* Botões de ação */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button onClick={onMaisInformacoes} className="bg-zinc-700 hover:bg-zinc-800 text-white">
          <Info className="w-4 h-4 mr-2" />
          Mais informações do processo
        </Button>
      </div>

      {/* Resumo do processo */}
      <Card className="border">
        <CardContent className="p-4 md:p-6">
          <h2 className="text-lg font-semibold mb-4 text-foreground">Resumo do processo</h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-3">
            {/* Coluna Esquerda */}
            <div className="space-y-3">
              {/* Situação */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Situação</p>
                <p className="text-sm font-medium text-foreground">{statusLabels[processo.status] || processo.status}</p>
              </div>

              {/* Assunto */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Assunto</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-foreground">{processo.assunto || "Não informado"}</p>
                  {processo.assunto && (
                    <Badge className="bg-amber-400 text-amber-900 hover:bg-amber-500">
                      <Scale className="w-3 h-3" />
                    </Badge>
                  )}
                </div>
              </div>

              {/* Órgão */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Órgão</p>
                <p className="text-sm text-foreground">
                  {processo.tribunal || processo.vara || "Não informado"}
                  {processo.comarca && ` - ${processo.comarca}`}
                </p>
              </div>

              {/* Número do Processo */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Número do Processo</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-mono text-foreground">{processo.numero}</p>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6"
                    onClick={() => copyToClipboard(processo.numero)}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>

              {/* Monitoramento (Push) */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Monitoramento (Push)</p>
                <div className="flex items-center gap-2">
                  <Badge className={cn(
                    "text-xs",
                    processo.monitorar_andamentos 
                      ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" 
                      : "bg-zinc-100 text-zinc-600"
                  )}>
                    {processo.monitorar_andamentos ? (
                      <>
                        <Bell className="w-3 h-3 mr-1" />
                        Habilitado
                      </>
                    ) : (
                      <>
                        <BellOff className="w-3 h-3 mr-1" />
                        Desabilitado
                      </>
                    )}
                  </Badge>
                  <Badge className={cn(
                    "text-xs",
                    processo.status === "ativo" 
                      ? "bg-amber-100 text-amber-700" 
                      : "bg-zinc-100 text-zinc-600"
                  )}>
                    {processo.status === "ativo" ? "Em andamento" : statusLabels[processo.status] || processo.status}
                  </Badge>
                </div>
              </div>

              {/* Envolvidos */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Envolvidos</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {processo.polo_passivo && (
                    <Badge variant="outline" className="bg-emerald-50 border-emerald-300 text-emerald-700">
                      {processo.polo_passivo}
                      <span className="ml-2 text-xs bg-emerald-600 text-white px-1.5 py-0.5 rounded text-[10px]">
                        Requerido
                      </span>
                    </Badge>
                  )}
                  {processo.polo_ativo && (
                    <Badge variant="outline" className="bg-zinc-50 border-zinc-300 text-zinc-700">
                      {processo.polo_ativo}
                      <span className="ml-2 text-xs bg-zinc-500 text-white px-1.5 py-0.5 rounded text-[10px]">
                        Requerente
                      </span>
                    </Badge>
                  )}
                </div>
                {onExpandirEnvolvidos && (
                  <button 
                    onClick={onExpandirEnvolvidos}
                    className="text-xs text-blue-600 hover:underline mt-1"
                  >
                    Expandir
                  </button>
                )}
              </div>

              {/* Responsáveis */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Responsáveis</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {responsaveis.length > 0 ? (
                    responsaveis.map((r) => (
                      <div key={r.id} className="flex items-center gap-2 bg-muted/50 rounded-md px-2 py-1">
                        <Avatar className="w-6 h-6 border border-background">
                          <AvatarFallback className="text-[10px] bg-primary/20 text-primary font-semibold">
                            {r.nome.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">{r.nome}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">Não atribuído</p>
                  )}
                </div>
              </div>

              {/* Valor da ação */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Valor da ação</p>
                <p className="text-sm font-medium text-foreground">{formatCurrency(processo.valor_causa)}</p>
              </div>

              {/* Pasta do cliente */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pasta do cliente</p>
                <p className="text-sm text-foreground">{processo.pasta_cliente || processo.pasta?.nome || "Não informado"}</p>
              </div>

              {/* Descrição */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Descrição</p>
                <p className="text-sm text-foreground">{processo.descricao || "Não informado"}</p>
              </div>
            </div>

            {/* Coluna Direita */}
            <div className="space-y-3">
              {/* Data de distribuição */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Data de distribuição</p>
                <p className="text-sm text-foreground">{formatDate(processo.data_distribuicao)}</p>
              </div>

              {/* Órgão julgador */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Órgão julgador</p>
                <p className="text-sm text-foreground">{processo.orgao_julgador || "Não informado"}</p>
              </div>

              {/* Área */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Área</p>
                <p className="text-sm text-foreground">{areaLabels[processo.area] || processo.area || "Não informado"}</p>
              </div>

              {/* Fase */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fase</p>
                <p className="text-sm text-foreground">{processo.fase || "Não informado"}</p>
              </div>

              {/* Sistema */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Sistema</p>
                <p className="text-sm text-foreground">{processo.sistema || "Não informado"}</p>
              </div>

              {/* Grupos de trabalho */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Grupos de trabalho</p>
                <p className="text-sm text-muted-foreground">Não informado</p>
              </div>

              {/* Pasta física */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pasta física</p>
                <p className="text-sm text-foreground">{processo.pasta_fisica || "Não informado"}</p>
              </div>

              {/* Marcadores */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Marcadores</p>
                <div className="flex gap-1 mt-1">
                  <Badge className="bg-zinc-700 text-white text-xs">CAPTURA</Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
