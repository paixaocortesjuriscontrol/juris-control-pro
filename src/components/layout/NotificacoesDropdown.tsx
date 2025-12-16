import { Bell, Check, CheckCheck, Trash2, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNotificacoes } from "@/hooks/useNotificacoes";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

export function NotificacoesDropdown() {
  const navigate = useNavigate();
  const {
    notificacoes,
    naoLidas,
    prazosPendentes,
    prazosUrgentes,
    totalPendentes,
    marcarComoLida,
    marcarTodasComoLidas,
    excluirNotificacao,
  } = useNotificacoes();

  const handleNotificacaoClick = (notificacao: typeof notificacoes[0]) => {
    marcarComoLida.mutate(notificacao.id);
    if (notificacao.link) {
      navigate(notificacao.link);
    }
  };

  const handlePrazoClick = (prazoId: string) => {
    navigate(`/prazos?prazo=${prazoId}`);
  };

  const getTipoBadgeColor = (tipo: string) => {
    switch (tipo) {
      case 'djen': return 'bg-blue-500';
      case 'warning': return 'bg-yellow-500';
      case 'success': return 'bg-green-500';
      default: return 'bg-muted';
    }
  };

  const getPrioridadeColor = (prioridade: string, isAtrasado: boolean) => {
    if (isAtrasado) return 'text-destructive';
    switch (prioridade) {
      case 'urgente': return 'text-destructive';
      case 'alta': return 'text-orange-500';
      case 'media': return 'text-yellow-500';
      default: return 'text-muted-foreground';
    }
  };

  const formatDiasRestantes = (dias: number) => {
    if (dias < 0) return `${Math.abs(dias)} dia(s) atrasado`;
    if (dias === 0) return 'Vence hoje';
    if (dias === 1) return 'Vence amanhã';
    return `${dias} dias restantes`;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {totalPendentes > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              variant="destructive"
            >
              {totalPendentes > 9 ? '9+' : totalPendentes}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96">
        <Tabs defaultValue="notificacoes" className="w-full">
          <div className="px-3 py-2">
            <TabsList className="w-full">
              <TabsTrigger value="notificacoes" className="flex-1 text-xs">
                Notificações
                {naoLidas.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    {naoLidas.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="prazos" className="flex-1 text-xs">
                Prazos
                {prazosUrgentes.length > 0 && (
                  <Badge variant="destructive" className="ml-1 h-5 px-1.5">
                    {prazosUrgentes.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>
          
          <DropdownMenuSeparator />
          
          <TabsContent value="notificacoes" className="mt-0">
            <div className="flex items-center justify-end px-3 py-1">
              {naoLidas.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 text-xs"
                  onClick={() => marcarTodasComoLidas.mutate()}
                >
                  <CheckCheck className="h-3 w-3 mr-1" />
                  Marcar todas
                </Button>
              )}
            </div>
            <ScrollArea className="h-[300px]">
              {notificacoes.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  Nenhuma notificação
                </div>
              ) : (
                notificacoes.map((notificacao) => (
                  <DropdownMenuItem
                    key={notificacao.id}
                    className={`flex flex-col items-start p-3 cursor-pointer ${
                      !notificacao.lida ? 'bg-accent/50' : ''
                    }`}
                    onClick={() => handleNotificacaoClick(notificacao)}
                  >
                    <div className="flex items-start justify-between w-full gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${getTipoBadgeColor(notificacao.tipo)}`} />
                          <span className="font-medium text-sm">{notificacao.titulo}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {notificacao.mensagem}
                        </p>
                        <span className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(notificacao.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        {!notificacao.lida && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              marcarComoLida.mutate(notificacao.id);
                            }}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            excluirNotificacao.mutate(notificacao.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </DropdownMenuItem>
                ))
              )}
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="prazos" className="mt-0">
            <div className="flex items-center justify-end px-3 py-1">
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-7 text-xs"
                onClick={() => navigate('/prazos')}
              >
                Ver todos
              </Button>
            </div>
            <ScrollArea className="h-[300px]">
              {prazosPendentes.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  Nenhum prazo pendente
                </div>
              ) : (
                prazosPendentes.map((prazo) => (
                  <DropdownMenuItem
                    key={prazo.id}
                    className={`flex flex-col items-start p-3 cursor-pointer ${
                      prazo.is_atrasado ? 'bg-destructive/10' : prazo.dias_restantes <= 3 ? 'bg-yellow-500/10' : ''
                    }`}
                    onClick={() => handlePrazoClick(prazo.id)}
                  >
                    <div className="flex items-start justify-between w-full gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {prazo.is_atrasado ? (
                            <AlertTriangle className="h-4 w-4 text-destructive" />
                          ) : (
                            <Clock className={`h-4 w-4 ${getPrioridadeColor(prazo.prioridade, prazo.is_atrasado)}`} />
                          )}
                          <span className="font-medium text-sm">{prazo.titulo}</span>
                        </div>
                        {prazo.processo && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Processo: {prazo.processo.numero}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-xs font-medium ${getPrioridadeColor(prazo.prioridade, prazo.is_atrasado)}`}>
                            {formatDiasRestantes(prazo.dias_restantes)}
                          </span>
                          <Badge variant="outline" className="text-xs h-5">
                            {prazo.prioridade}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </DropdownMenuItem>
                ))
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
