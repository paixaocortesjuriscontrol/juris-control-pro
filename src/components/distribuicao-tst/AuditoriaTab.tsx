import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useHistoricoDistribuicaoTst } from "@/hooks/useAuditoriaDistribuicaoTst";
import { useUsuariosAuditoria } from "@/hooks/useUsuariosAuditoria";
import {
  labelAcaoDistTst,
  labelCampoDistTst,
  labelOrigemDistTst,
  formatValorAuditoria,
} from "@/utils/auditoriaDistTstLabels";

interface Props {
  dadosBennerId?: string | null;
  processo?: string | null;
  dossie?: string | null;
}

/** Aba de auditoria: todas as alterações (Judit, sistema ou usuário) deste processo. */
export function AuditoriaTab({ dadosBennerId, processo, dossie }: Props) {
  const { data: rows, isLoading } = useHistoricoDistribuicaoTst(dadosBennerId);
  const { nome, email } = useUsuariosAuditoria((rows || []).map((r) => r.usuario_id));

  if (!dadosBennerId) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Salve o registro para ver a auditoria.</p>;
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold">
        Auditoria de alterações
        {processo ? <span className="font-normal text-muted-foreground"> — {processo}</span> : null}
        {dossie ? <span className="font-normal text-muted-foreground"> / Dossiê {dossie}</span> : null}
      </div>
      {!rows || rows.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Nenhuma alteração registrada para este processo. A auditoria registra apenas alterações feitas a partir da sua
          ativação.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="rounded border p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                <div className="font-medium">
                  {format(new Date(r.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                  <span className="text-muted-foreground font-normal"> · {nome(r.usuario_id)}</span>
                  {email(r.usuario_id) && (
                    <span className="text-muted-foreground font-normal"> ({email(r.usuario_id)})</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{labelAcaoDistTst(r.acao)}</Badge>
                  <span className="text-muted-foreground">{labelOrigemDistTst(r.origem)}</span>
                </div>
              </div>
              {(r.campos_alterados || []).length > 0 ? (
                <div className="space-y-1">
                  {(r.campos_alterados || []).map((d) => (
                    <div key={d.campo} className="text-xs grid grid-cols-[minmax(0,30%)_1fr_1fr] gap-2">
                      <span className="font-medium">{labelCampoDistTst(d.campo)}</span>
                      <span className="text-muted-foreground line-through break-words">{formatValorAuditoria(d.de)}</span>
                      <span className="font-medium break-words">{formatValorAuditoria(d.para)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {r.acao === "criar" ? "Registro criado." : "Registro excluído."}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
