import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { VoltarAdminTstButton } from "@/components/admin-tst/VoltarAdminTstButton";

export type Coluna = { col: string; nome: string; exemplo?: string; obs?: string };

export function LayoutPlanilha({ colunas }: { colunas: Coluna[] }) {
  return (
    <div className="border border-border rounded-md overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-20">Coluna</TableHead>
            <TableHead>Cabeçalho esperado</TableHead>
            <TableHead>Exemplo</TableHead>
            <TableHead>Observação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {colunas.map((c) => (
            <TableRow key={c.col + c.nome}>
              <TableCell className="font-mono font-semibold">{c.col}</TableCell>
              <TableCell>{c.nome}</TableCell>
              <TableCell className="text-muted-foreground text-sm">{c.exemplo ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground text-sm">{c.obs ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export interface SecaoImportacaoProps {
  titulo: string;
  descricao: string;
  comoUsar: string[];
  layout?: Coluna[];
  layoutNota?: string;
  acao: React.ReactNode;
}

export function SecaoImportacao({ titulo, descricao, comoUsar, layout, layoutNota, acao }: SecaoImportacaoProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <CardTitle className="text-lg">{titulo}</CardTitle>
            <CardDescription className="mt-1">{descricao}</CardDescription>
          </div>
          <div className="flex-shrink-0">{acao}</div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="text-sm font-semibold mb-2">Como usar</h4>
          <ol className="list-decimal pl-5 space-y-1 text-sm text-muted-foreground">
            {comoUsar.map((p, i) => <li key={i}>{p}</li>)}
          </ol>
        </div>
        {layout && (
          <div>
            <h4 className="text-sm font-semibold mb-2">Layout da planilha</h4>
            <LayoutPlanilha colunas={layout} />
            {layoutNota && <p className="text-xs text-muted-foreground mt-2">{layoutNota}</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function PaginaImportacao(props: SecaoImportacaoProps & { pageTitle: string }) {
  const { pageTitle, ...secao } = props;
  return (
    <MainLayout title={pageTitle}>
      <div className="p-4 lg:p-6 space-y-6 max-w-6xl">
        <VoltarAdminTstButton />
        <SecaoImportacao {...secao} />
      </div>
    </MainLayout>
  );
}