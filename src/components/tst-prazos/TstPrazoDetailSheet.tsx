import { PrazoTst } from "@/hooks/usePrazosTst";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ExternalLink, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  prazo: PrazoTst | null;
  open: boolean;
  onClose: () => void;
  onDelete?: (id: string) => void;
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground whitespace-pre-wrap">{value}</p>
    </div>
  );
}

export function TstPrazoDetailSheet({ prazo, open, onClose, onDelete }: Props) {
  const navigate = useNavigate();
  if (!prazo) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="text-base">Detalhes do Prazo</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-4">
          <Field label="Número do Processo" value={prazo.numero_processo} />
          <Field label="Dossiê" value={prazo.dossie} />
          <Field label="Réu" value={prazo.reu} />
          <Field label="Autor" value={prazo.autor} />
          <Field label="Equipe" value={prazo.equipe} />
          <Field label="Decisão" value={prazo.decisao} />
          <Field label="Formulário" value={prazo.formulario} />
          <Field label="Providências" value={prazo.providencias} />
          <Field label="Depósito Judicial" value={prazo.deposito_judicial} />
          <Field label="Preparo" value={prazo.preparo} />
          <Field label="Multa/Custas" value={prazo.multa_custas} />
          <Field label="Responsável" value={prazo.responsavel} />
          <div>
            <p className="text-xs text-muted-foreground">Data Fatal</p>
            <p className="text-sm font-semibold text-destructive">
              {format(new Date(prazo.data_fatal + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}
            </p>
          </div>

          <div className="flex gap-2 pt-4">
            {prazo.processo_id && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/processos/${prazo.processo_id}`)}
              >
                <ExternalLink className="w-4 h-4 mr-1" /> Ver Processo
              </Button>
            )}
            {onDelete && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => { onDelete(prazo.id); onClose(); }}
              >
                <Trash2 className="w-4 h-4 mr-1" /> Excluir
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
