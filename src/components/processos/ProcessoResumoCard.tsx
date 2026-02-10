import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Info, 
  Copy, 
  Bell, 
  BellOff, 
  Scale 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PendenciasProcessoCard } from "./PendenciasProcessoCard";
import { DepositosRecursaisCard } from "./DepositosRecursaisCard";
import { CustasProcessuaisCard } from "./CustasProcessuaisCard";

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
  audiencias?: any[];
  intimacoes?: any[];
  tarefas?: any[];
  movimentacoes?: any[];
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
  arquivado_definitivamente: "Arquivado Definitivamente",
  arquivado_provisoriamente: "Arquivado Provisoriamente",
  suspenso: "Suspenso",
};

const areaLabels: Record<string, string> = {
  civil: "Cível",
  trabalhista: "Trabalhista",
  empresarial: "Empresarial",
};

export function ProcessoResumoCard({ 
  processo, 
  responsaveis,
  audiencias = [],
  intimacoes = [],
  tarefas = [],
  movimentacoes = [],
  onMaisInformacoes, 
  onExpandirEnvolvidos, 
  onAbrirProcessoExterno,
}: ProcessoResumoCardProps) {
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

  const pastaNome = processo.pasta_cliente || processo.pasta?.nome || 
    (processo.polo_passivo && processo.polo_ativo 
      ? `${processo.polo_passivo} X ${processo.polo_ativo}` 
      : null);

  return (
    <div className="space-y-3">
      {/* Pasta e botão de ação */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-base font-semibold text-foreground">{pastaNome || "Pasta não informada"}</span>
        <Button onClick={onMaisInformacoes} size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
          <Info className="w-4 h-4 mr-2" />
          Mais informações
        </Button>
      </div>

      {/* Resumo do processo */}
      <Card className="border border-border/60 shadow-md">
        <CardContent className="p-5 md:p-6">
          <h2 className="text-sm font-semibold mb-4 text-foreground uppercase tracking-wide border-b border-border pb-2">Resumo do processo</h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4">
            {/* Coluna Esquerda */}
            <div className="space-y-4">
              {/* Situação + Monitoramento inline */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={cn(
                  "text-xs font-semibold px-2.5 py-1 rounded-md shadow-sm",
                  processo.status === "ativo" ? "bg-emerald-500/15 text-emerald-700 border border-emerald-300" :
                  processo.status === "urgente" ? "bg-destructive/15 text-destructive border border-destructive/30" :
                  processo.status === "pendente" ? "bg-amber-500/15 text-amber-700 border border-amber-300" :
                  "bg-muted text-muted-foreground border border-border"
                )}>
                  {statusLabels[processo.status] || processo.status}
                </Badge>
                <Badge className={cn(
                  "text-xs font-medium px-2.5 py-1 rounded-md",
                  processo.monitorar_andamentos 
                    ? "bg-emerald-500/10 text-emerald-700 border border-emerald-200" 
                    : "bg-muted text-muted-foreground border border-border"
                )}>
                  {processo.monitorar_andamentos ? (
                    <><Bell className="w-3 h-3 mr-1" /> Push ativo</>
                  ) : (
                    <><BellOff className="w-3 h-3 mr-1" /> Push inativo</>
                  )}
                </Badge>
              </div>

              {/* Info rows */}
              <div className="rounded-lg border border-border/50 bg-muted/30 divide-y divide-border/40">
                <div className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Número</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-mono font-semibold text-foreground">{processo.numero}</span>
                    <Button variant="ghost" size="icon" className="h-5 w-5 rounded" onClick={() => copyToClipboard(processo.numero)}>
                      <Copy className="w-3 h-3 text-muted-foreground" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Assunto</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-foreground text-right max-w-[200px] truncate">{processo.assunto || "Não informado"}</span>
                    {processo.assunto && <Scale className="w-3 h-3 text-amber-500 flex-shrink-0" />}
                  </div>
                </div>
                <div className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Órgão</span>
                  <span className="text-sm text-foreground text-right max-w-[220px] truncate">
                    {processo.tribunal || processo.vara || "Não informado"}
                    {processo.comarca && ` — ${processo.comarca}`}
                  </span>
                </div>
                <div className="flex items-center justify-between px-3 py-2.5">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Valor da ação</span>
                  <span className="text-sm font-semibold text-foreground">{formatCurrency(processo.valor_causa)}</span>
                </div>
              </div>

              {/* Envolvidos */}
              <div className="rounded-lg border border-border/50 bg-muted/30 p-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Envolvidos</p>
                <div className="flex flex-wrap gap-2">
                  {processo.polo_passivo && (
                    <Badge variant="outline" className="bg-emerald-500/10 border-emerald-300/60 text-emerald-700 py-1 px-2.5 text-xs font-medium">
                      {processo.polo_passivo}
                      <span className="ml-1.5 bg-emerald-600 text-white px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase">Requerido</span>
                    </Badge>
                  )}
                  {processo.polo_ativo && (
                    <Badge variant="outline" className="bg-muted border-border text-foreground py-1 px-2.5 text-xs font-medium">
                      {processo.polo_ativo}
                      <span className="ml-1.5 bg-muted-foreground/70 text-background px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase">Requerente</span>
                    </Badge>
                  )}
                </div>
                {onExpandirEnvolvidos && (
                  <button onClick={onExpandirEnvolvidos} className="text-xs text-primary hover:underline font-medium">Expandir</button>
                )}
              </div>

              {/* Responsáveis */}
              <div className="rounded-lg border border-border/50 bg-muted/30 p-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Responsáveis</p>
                <div className="flex flex-wrap gap-2">
                  {responsaveis.length > 0 ? (
                    responsaveis.map((r) => (
                      <div key={r.id} className="flex items-center gap-2 bg-background rounded-md px-2.5 py-1.5 border border-border/50 shadow-sm">
                        <Avatar className="w-6 h-6 border border-primary/20">
                          <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">
                            {r.nome.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-medium text-foreground">{r.nome}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Não atribuído</p>
                  )}
                </div>
              </div>

              {/* Descrição */}
              {processo.descricao && (
                <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Descrição</p>
                  <p className="text-sm text-foreground leading-relaxed">{processo.descricao}</p>
                </div>
              )}

              {/* Campos adicionais */}
              <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Dados complementares</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {[
                    { label: "Distribuição", value: formatDate(processo.data_distribuicao) },
                    { label: "Órgão julgador", value: processo.orgao_julgador },
                    { label: "Área", value: areaLabels[processo.area] || processo.area },
                    { label: "Fase", value: processo.fase },
                    { label: "Sistema", value: processo.sistema },
                    { label: "Pasta física", value: processo.pasta_fisica },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{label}</span>
                      <span className="text-xs text-foreground font-medium">{value || "—"}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Marcadores */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Marcadores</span>
                <Badge className="bg-foreground text-background text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">CAPTURA</Badge>
              </div>
            </div>

            {/* Coluna Direita */}
            <div className="space-y-3">
              <PendenciasProcessoCard
                audiencias={audiencias}
                intimacoes={intimacoes}
                tarefas={tarefas}
                movimentacoes={movimentacoes}
              />
              <DepositosRecursaisCard processoId={processo.id} />
              <CustasProcessuaisCard processoId={processo.id} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
