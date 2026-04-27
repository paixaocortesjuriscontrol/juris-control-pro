import { useMemo, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Scale, Search, ThumbsUp, ThumbsDown, Ban } from "lucide-react";
import { TURMAS_TST, MINISTROS_TST, type ClassificacaoTst } from "@/constants/classificacaoTst";

function ClassifBadge({ c }: { c: ClassificacaoTst }) {
  if (c === "POSITIVO") {
    return (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border border-green-300">
        <ThumbsUp className="w-3 h-3 mr-1" /> Positivo
      </Badge>
    );
  }
  if (c === "NEGATIVO") {
    return (
      <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border border-red-300">
        <ThumbsDown className="w-3 h-3 mr-1" /> Negativo
      </Badge>
    );
  }
  return (
    <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border border-amber-300">
      <Ban className="w-3 h-3 mr-1" /> Impedida
    </Badge>
  );
}

export default function ClassificacaoTst() {
  const [busca, setBusca] = useState("");

  const ministrosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return MINISTROS_TST;
    return MINISTROS_TST.filter(m =>
      m.nome.toLowerCase().includes(q) ||
      (m.cargo || "").toLowerCase().includes(q) ||
      m.classificacao.toLowerCase().includes(q),
    );
  }, [busca]);

  const totais = useMemo(() => {
    const t = { positivo: 0, negativo: 0, impedida: 0 };
    for (const m of MINISTROS_TST) {
      if (m.classificacao === "POSITIVO") t.positivo++;
      else if (m.classificacao === "NEGATIVO") t.negativo++;
      else t.impedida++;
    }
    return t;
  }, []);

  return (
    <div className="min-h-screen flex w-full bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <main className="flex-1 p-4 md:p-6 space-y-6 overflow-x-hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center">
              <Scale className="w-5 h-5 text-sky-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Classificação TST</h1>
              <p className="text-sm text-muted-foreground">
                Classificação interna de Turmas e Ministros do TST. Aplicada automaticamente quando
                a Judit retorna a turma e o relator do processo.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card><CardContent className="p-4 flex items-center justify-between">
              <div><p className="text-sm text-muted-foreground">Ministros Positivos</p><p className="text-2xl font-bold text-green-700">{totais.positivo}</p></div>
              <ThumbsUp className="w-8 h-8 text-green-600" />
            </CardContent></Card>
            <Card><CardContent className="p-4 flex items-center justify-between">
              <div><p className="text-sm text-muted-foreground">Ministros Negativos</p><p className="text-2xl font-bold text-red-700">{totais.negativo}</p></div>
              <ThumbsDown className="w-8 h-8 text-red-600" />
            </CardContent></Card>
            <Card><CardContent className="p-4 flex items-center justify-between">
              <div><p className="text-sm text-muted-foreground">Impedidos</p><p className="text-2xl font-bold text-amber-700">{totais.impedida}</p></div>
              <Ban className="w-8 h-8 text-amber-600" />
            </CardContent></Card>
          </div>

          <Tabs defaultValue="turmas" className="w-full">
            <TabsList>
              <TabsTrigger value="turmas">Turmas</TabsTrigger>
              <TabsTrigger value="ministros">Ministros</TabsTrigger>
            </TabsList>

            <TabsContent value="turmas">
              <Card>
                <CardHeader><CardTitle>Classificação das Turmas / Órgãos</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {TURMAS_TST.map(t => (
                      <div key={t.turma} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                        <span className="font-medium">{t.turma}</span>
                        <ClassifBadge c={t.classificacao} />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ministros">
              <Card>
                <CardHeader>
                  <CardTitle>Classificação dos Ministros / Desembargadores</CardTitle>
                  <div className="relative mt-2 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por nome, cargo ou classificação..."
                      value={busca}
                      onChange={e => setBusca(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {ministrosFiltrados.map(m => (
                      <div key={m.nome} className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{m.nome}</p>
                          {m.cargo && <p className="text-xs text-muted-foreground truncate">{m.cargo}</p>}
                          {m.observacao && <p className="text-xs text-amber-700 mt-1">{m.observacao}</p>}
                        </div>
                        <ClassifBadge c={m.classificacao} />
                      </div>
                    ))}
                    {ministrosFiltrados.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        Nenhum ministro encontrado.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}