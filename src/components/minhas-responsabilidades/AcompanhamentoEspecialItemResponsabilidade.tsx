import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock3, Loader2, Paperclip, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatarDataDetalhe } from "@/lib/detalheItemResponsabilidade";

const HORARIOS_ACOMPANHAMENTO: Record<number, string> = {
  1: "10h",
  2: "10h e 18h",
  3: "10h, 14h e 18h",
};

const LABEL_CAMPO: Record<string, string> = {
  tribunal: "Tribunal",
  orgao_julgador: "Órgão julgador",
  classe: "Classe",
  natureza: "Natureza",
  assunto: "Assunto",
  materia: "Matéria",
  comarca: "Comarca",
  vara: "Vara/Câmara",
  uf: "UF",
  instancia: "Instância",
  justica: "Justiça",
  esfera: "Esfera",
  area: "Área",
  sistema: "Sistema",
  data_distribuicao: "Data de distribuição",
  data_citacao: "Data de citação",
  data_recebimento: "Data de recebimento",
  valor_causa: "Valor da causa",
  polo_ativo: "Polo ativo",
  polo_passivo: "Polo passivo",
  reclamante: "Reclamante",
  reclamados: "Reclamado(s)",
  terceiro_envolvido: "Terceiro envolvido",
  pedidos: "Pedidos",
  fase: "Fase",
  segredo_justica: "Segredo de justiça",
};

interface Props {
  processo: any;
  active: boolean;
}

/** Dados já gravados pelo Acompanhamento Especial; nunca inicia uma consulta Judit. */
export function AcompanhamentoEspecialItemResponsabilidade({ processo, active }: Props) {
  const processoId = String(processo?.id ?? "");
  const { data, isLoading, error } = useQuery({
    queryKey: ["minhas-responsabilidades", "acompanhamento-especial-detalhe", processoId],
    enabled: active && !!processoId,
    staleTime: 60_000,
    queryFn: async () => {
      const [eventosRes, divergenciasRes] = await Promise.all([
        supabase
          .from("acompanhamento_especial_eventos")
          .select("id, step_date, conteudo, instancia, tribunal, anexos_count, criado_em, retroativo, lido_em")
          .eq("processo_id", processoId)
          .order("criado_em", { ascending: false })
          .limit(100),
        supabase
          .from("acompanhamento_especial_divergencias")
          .select("id, campo, valor_atual, valor_judit, detectado_em, resolvido_em")
          .eq("processo_id", processoId)
          .order("detectado_em", { ascending: false })
          .limit(50),
      ]);
      if (eventosRes.error) throw eventosRes.error;
      if (divergenciasRes.error) throw divergenciasRes.error;

      const eventos = [...(eventosRes.data ?? [])].sort((a, b) =>
        String(b.step_date ?? b.criado_em).localeCompare(String(a.step_date ?? a.criado_em)),
      );
      const ids = eventos.map((evento) => evento.id);
      const { data: authData } = await supabase.auth.getUser();
      const usuarioId = authData.user?.id;
      let lidas = new Set<string>();
      if (usuarioId && ids.length > 0) {
        const { data: leituras } = await supabase
          .from("acompanhamento_especial_leituras")
          .select("evento_id")
          .eq("user_id", usuarioId)
          .in("evento_id", ids);
        lidas = new Set((leituras ?? []).map((leitura) => leitura.evento_id));
      }

      return {
        eventos: eventos.map((evento) => ({ ...evento, lido_pelo_usuario: lidas.has(evento.id) })),
        divergencias: divergenciasRes.data ?? [],
      };
    },
  });

  if (!active) return null;
  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Carregando Acompanhamento Especial...
      </div>
    );
  }
  if (error) {
    return (
      <div role="alert" className="m-4 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        Não foi possível carregar o Acompanhamento Especial: {(error as Error).message}
      </div>
    );
  }

  const eventos = data?.eventos ?? [];
  const divergencias = data?.divergencias ?? [];
  const frequencia = Number(processo?.acompanhamento_freq_diaria ?? 1);
  const novas = eventos.filter((evento) =>
    !evento.retroativo && !evento.lido_em && !evento.lido_pelo_usuario
  ).length;
  const divergenciasPendentes = divergencias.filter((divergencia) => !divergencia.resolvido_em).length;

  return (
    <div className="space-y-5 p-4">
      <section className="rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Acompanhamento Especial</h3>
              <Badge>Ativo</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Monitoramento automático das movimentações deste processo.
            </p>
          </div>
          {novas > 0 && <Badge variant="secondary">{novas} {novas === 1 ? "novidade" : "novidades"}</Badge>}
        </div>
        <dl className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">Ativado em</dt>
            <dd className="mt-1 font-medium">{formatarDataDetalhe(processo?.acompanhamento_ativado_em, true)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Frequência</dt>
            <dd className="mt-1 font-medium">{frequencia} {frequencia === 1 ? "vez" : "vezes"} ao dia</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="h-3 w-3" /> Horários BRT</dt>
            <dd className="mt-1 font-medium">{HORARIOS_ACOMPANHAMENTO[frequencia] ?? HORARIOS_ACOMPANHAMENTO[1]}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Download de anexos</dt>
            <dd className="mt-1 font-medium">{processo?.acompanhamento_com_anexos ? "Ativado" : "Desativado"}</dd>
          </div>
        </dl>
        <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
          Esta aba mostra somente registros já armazenados e não solicita uma nova pesquisa à Judit.
        </p>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="h-4 w-4 text-primary" /> Divergências Judit × cadastro
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Diferenças detectadas entre a consulta e os dados preenchidos.</p>
          </div>
          {divergenciasPendentes > 0 && <Badge variant="secondary">{divergenciasPendentes} pendente(s)</Badge>}
        </div>
        {divergencias.length === 0 ? (
          <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            Nenhuma divergência registrada para este processo.
          </div>
        ) : (
          <div className="space-y-3">
            {divergencias.map((divergencia) => (
              <article key={divergencia.id} className="rounded-lg border bg-card p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-medium">{LABEL_CAMPO[divergencia.campo] ?? divergencia.campo.replace(/_/g, " ")}</h4>
                  <Badge variant={divergencia.resolvido_em ? "outline" : "secondary"}>
                    {divergencia.resolvido_em ? "Ciente" : "Pendente"}
                  </Badge>
                  <span className="ml-auto text-xs text-muted-foreground">{formatarDataDetalhe(divergencia.detectado_em, true)}</span>
                </div>
                <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-md bg-muted/40 p-3">
                    <dt className="text-xs text-muted-foreground">No cadastro</dt>
                    <dd className="mt-1 whitespace-pre-wrap break-words">{divergencia.valor_atual || "—"}</dd>
                  </div>
                  <div className="rounded-md bg-muted/40 p-3">
                    <dt className="text-xs text-muted-foreground">Na Judit</dt>
                    <dd className="mt-1 whitespace-pre-wrap break-words">{divergencia.valor_judit || "—"}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-2 px-1">
          <div>
            <h3 className="text-sm font-semibold">Movimentações capturadas</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">Histórico mais recente, incluindo movimentações retroativas e já lidas.</p>
          </div>
          <Badge variant="secondary">{eventos.length} registro(s)</Badge>
        </div>
        {eventos.length === 0 ? (
          <div className="flex flex-col items-center rounded-lg border border-dashed px-4 py-10 text-center">
            <CheckCircle2 className="mb-2 h-7 w-7 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nenhuma movimentação capturada até o momento.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {eventos.map((evento) => {
              const nova = !evento.retroativo && !evento.lido_em && !evento.lido_pelo_usuario;
              return (
                <article key={evento.id} className="rounded-lg border bg-card p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{formatarDataDetalhe(evento.step_date ?? evento.criado_em, true)}</span>
                    {evento.tribunal && <Badge variant="outline">{evento.tribunal}</Badge>}
                    {evento.instancia && <Badge variant="outline">{evento.instancia}</Badge>}
                    {nova && <Badge>Nova</Badge>}
                    {evento.retroativo && <Badge variant="secondary">Retroativa</Badge>}
                    {!nova && !evento.retroativo && (evento.lido_em || evento.lido_pelo_usuario) && <Badge variant="outline">Lida</Badge>}
                    {evento.anexos_count > 0 && (
                      <span className="inline-flex items-center gap-1"><Paperclip className="h-3 w-3" /> {evento.anexos_count} anexo(s)</span>
                    )}
                  </div>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{evento.conteudo || "Movimentação sem descrição."}</p>
                  <p className="mt-2 text-[11px] text-muted-foreground">Capturada em {formatarDataDetalhe(evento.criado_em, true)}</p>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
