import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { VoltarAdminTstButton } from "@/components/admin-tst/VoltarAdminTstButton";
import { AjustarChanceDialog } from "@/components/distribuicao-tst/AjustarChanceDialog";

export default function AjustarChanceTurmaRelator() {
  return (
    <MainLayout
      title="Ajustar Chance Turma/Relator (2026+)"
      subtitle="Inverte marcações FAVORÁVEL para DESFAVORÁVEL na análise do reclamante dos processos prontos para enviar distribuídos a partir de 2026."
    >
      <div className="p-4 lg:p-6 space-y-4">
        <VoltarAdminTstButton />

        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>Ajuste em lote</CardTitle>
            <CardDescription>
              Somente processos prontos para enviar (sem pendência), com distribuição a partir de
              01/01/2026, recurso do reclamante preenchido e "Tem chance de êxito = SIM". O sistema
              mostra uma pré-visualização antes de gravar e gera um relatório Excel dos alterados.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AjustarChanceDialog />
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
