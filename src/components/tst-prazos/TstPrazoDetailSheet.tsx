import { ProcessoTst } from "@/hooks/usePrazosTst";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  processo: ProcessoTst | null;
  open: boolean;
  onClose: () => void;
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

function formatDataFatal(value: string | null | undefined) {
  if (!value) return { text: "Sem prazo informado", isMissing: true };
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return { text: "Data inválida", isMissing: true };
  return { text: format(date, "dd/MM/yyyy", { locale: ptBR }), isMissing: false };
}

export function TstPrazoDetailSheet({ processo, open, onClose }: Props) {
  const navigate = useNavigate();
  if (!processo) return null;

  const dataFatal = formatDataFatal(processo.data_fatal);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="text-base">Detalhes do Processo TST</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 mt-4">
          <Field label="Número do Processo" value={processo.numero} />
          <Field label="Dossiê" value={processo.dossie_tst} />
          <Field label="Réu" value={processo.polo_passivo} />
          <Field label="Autor" value={processo.polo_ativo} />
          <Field label="Equipe" value={processo.equipe_tst} />
          <Field label="Decisão" value={processo.decisao_tst} />
          <Field label="Formulário" value={processo.formulario_tst} />
          <Field label="Providências" value={processo.providencias_tst} />
          <Field label="Depósito Judicial" value={processo.deposito_judicial_tst} />
          <Field label="Preparo" value={processo.preparo_tst} />
          <Field label="Multa/Custas" value={processo.multa_custas_tst} />
          <Field label="Responsável" value={processo.responsavel_tst} />
          <div>
            <p className="text-xs text-muted-foreground">Data Fatal</p>
            <p className={`text-sm font-semibold ${dataFatal.isMissing ? "text-muted-foreground" : "text-destructive"}`}>
              {dataFatal.text}
            </p>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/processos/${processo.id}`)}
            >
              <ExternalLink className="w-4 h-4 mr-1" /> Ver Processo
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
