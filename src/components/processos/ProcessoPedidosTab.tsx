import { PedidosEditableTable } from "./PedidosEditableTable";

interface ProcessoPedidosTabProps {
  processo: any;
}

export function ProcessoPedidosTab({ processo }: ProcessoPedidosTabProps) {
  return (
    <div className="space-y-6 min-w-0 w-full">
      <PedidosEditableTable processoId={processo.id} />
    </div>
  );
}
