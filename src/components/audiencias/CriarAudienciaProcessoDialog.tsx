import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AudienciaFormSimplificado } from "./AudienciaFormSimplificado";

interface CriarAudienciaProcessoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  processoNumero: string;
  processoId: string;
}


export function CriarAudienciaProcessoDialog({
  open,
  onOpenChange,
  processoNumero,
  processoId,
}: CriarAudienciaProcessoDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[92vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>Adicionar Audiência</DialogTitle>
          <DialogDescription>
            Processo: {processoNumero}
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-y-auto px-6 pb-6 flex-1">
          <AudienciaFormSimplificado
            defaultProcessoNumero={processoNumero}
            defaultProcessoId={processoId}
            showProcessoField={false}
            hideTitleHeader
            onSuccess={() => onOpenChange(false)}
            onCancel={() => onOpenChange(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
