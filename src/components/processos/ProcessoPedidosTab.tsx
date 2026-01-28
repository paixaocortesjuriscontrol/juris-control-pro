import { PedidosEditableTable } from "./PedidosEditableTable";

interface ProcessoPedidosTabProps {
  processo: any;
}

export function ProcessoPedidosTab({ processo }: ProcessoPedidosTabProps) {
  return (
    <div className="space-y-6">
      <PedidosEditableTable processoId={processo.id} />
    </div>
  );
}
