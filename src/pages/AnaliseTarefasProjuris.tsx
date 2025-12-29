import { useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileSpreadsheet } from "lucide-react";
import { useAnalisePlanilhaTarefas } from "@/hooks/useAnalisePlanilhaTarefas";

export default function AnaliseTarefasProjuris() {
  const { analysis, loading, error, analyzeFromPublic } = useAnalisePlanilhaTarefas();

  useEffect(() => {
    analyzeFromPublic("/temp/Tarefas_Projuris.xlsx");
  }, []);

  const getTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      text: "bg-blue-100 text-blue-800",
      number: "bg-green-100 text-green-800",
      date: "bg-purple-100 text-purple-800",
      boolean: "bg-orange-100 text-orange-800",
      mixed: "bg-gray-100 text-gray-800",
    };
    return <Badge className={colors[type] || colors.mixed}>{type}</Badge>;
  };

  return (
    <MainLayout title="Análise de Tarefas Projuris" subtitle="Estrutura da planilha">
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold">Análise da Planilha de Tarefas Projuris</h1>
        </div>

        {loading && (
          <Card>
            <CardContent className="py-12 flex items-center justify-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Analisando planilha...</span>
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="border-destructive">
            <CardContent className="py-6 text-destructive">
              Erro ao analisar: {error}
            </CardContent>
          </Card>
        )}

        {analysis && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Resumo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold">{analysis.totalRows}</div>
                    <div className="text-sm text-muted-foreground">Total de Linhas</div>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold">{analysis.columns.length}</div>
                    <div className="text-sm text-muted-foreground">Colunas</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Estrutura das Colunas</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>Nome da Coluna</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Valores Únicos</TableHead>
                      <TableHead>Vazios</TableHead>
                      <TableHead>Exemplos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analysis.columns.map((col, index) => (
                      <TableRow key={col.name}>
                        <TableCell className="font-mono text-xs">{index + 1}</TableCell>
                        <TableCell className="font-medium">{col.name}</TableCell>
                        <TableCell>{getTypeBadge(col.type)}</TableCell>
                        <TableCell>{col.uniqueValues}</TableCell>
                        <TableCell>{col.nullCount}</TableCell>
                        <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                          {col.sampleValues.slice(0, 3).map(v => String(v)).join(" | ")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Primeiras 10 Linhas (Amostra)</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {analysis.rawHeaders.map((h) => (
                        <TableHead key={h} className="whitespace-nowrap text-xs">
                          {h}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analysis.sampleData.map((row, idx) => (
                      <TableRow key={idx}>
                        {analysis.rawHeaders.map((h) => (
                          <TableCell key={h} className="text-xs max-w-[200px] truncate">
                            {row[h] !== null && row[h] !== undefined ? String(row[h]) : "-"}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </MainLayout>
  );
}
