import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Scale, Search, ThumbsUp, ThumbsDown, Ban, Plus, Trash2, Loader2 } from "lucide-react";
import {
  useTurmasTst, useRelatoresTst,
  useUpsertTurmaTst, useDeleteTurmaTst,
  useUpsertRelatorTst, useDeleteRelatorTst,
  type ClassificacaoTst, type TurmaTst, type RelatorTst,
} from "@/hooks/useClassificacaoTst";

function ClassifBadge({ c }: { c: ClassificacaoTst }) {
  if (c === "POSITIVO") {
    return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border border-green-300"><ThumbsUp className="w-3 h-3 mr-1" /> Positivo</Badge>;
  }
  if (c === "NEGATIVO") {
    return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border border-red-300"><ThumbsDown className="w-3 h-3 mr-1" /> Negativo</Badge>;
  }
  return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border border-amber-300"><Ban className="w-3 h-3 mr-1" /> Impedida</Badge>;
}

function ClassifSelect({
  value, onChange, disabled,
}: { value: ClassificacaoTst; onChange: (v: ClassificacaoTst) => void; disabled?: boolean }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as ClassificacaoTst)} disabled={disabled}>
      <SelectTrigger className="w-[150px] h-9"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="POSITIVO">Positivo</SelectItem>
        <SelectItem value="NEGATIVO">Negativo</SelectItem>
        <SelectItem value="IMPEDIDA">Impedida</SelectItem>
      </SelectContent>
    </Select>
  );
}

function TurmaRow({ turma }: { turma: TurmaTst }) {
  const [nome, setNome] = useState(turma.nome);
  const [classificacao, setClassificacao] = useState<ClassificacaoTst>(turma.classificacao);
  const [obs, setObs] = useState(turma.observacao ?? "");
  const upsert = useUpsertTurmaTst();
  const del = useDeleteTurmaTst();

  const dirty = nome.trim() !== turma.nome || classificacao !== turma.classificacao || (obs ?? "") !== (turma.observacao ?? "");

  const salvar = () => {
    if (!nome.trim()) return;
    upsert.mutate({ id: turma.id, nome, classificacao, observacao: obs || null });
  };

  return (
    <TableRow>
      <TableCell><Input value={nome} onChange={(e) => setNome(e.target.value)} onBlur={() => dirty && salvar()} className="h-9" /></TableCell>
      <TableCell><ClassifSelect value={classificacao} onChange={(v) => { setClassificacao(v); upsert.mutate({ id: turma.id, nome, classificacao: v, observacao: obs || null }); }} /></TableCell>
      <TableCell><Input value={obs} onChange={(e) => setObs(e.target.value)} onBlur={() => dirty && salvar()} placeholder="—" className="h-9" /></TableCell>
      <TableCell className="w-12">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir turma?</AlertDialogTitle>
              <AlertDialogDescription>Tem certeza que deseja excluir <strong>{turma.nome}</strong>?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => del.mutate(turma.id)}>Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  );
}

function RelatorRow({ relator }: { relator: RelatorTst }) {
  const [nome, setNome] = useState(relator.nome);
  const [cargo, setCargo] = useState(relator.cargo ?? "");
  const [classificacao, setClassificacao] = useState<ClassificacaoTst>(relator.classificacao);
  const [obs, setObs] = useState(relator.observacao ?? "");
  const upsert = useUpsertRelatorTst();
  const del = useDeleteRelatorTst();

  const dirty =
    nome.trim() !== relator.nome ||
    (cargo || "") !== (relator.cargo ?? "") ||
    classificacao !== relator.classificacao ||
    (obs || "") !== (relator.observacao ?? "");

  const salvar = () => {
    if (!nome.trim()) return;
    upsert.mutate({ id: relator.id, nome, cargo: cargo || null, classificacao, observacao: obs || null });
  };

  return (
    <TableRow>
      <TableCell><Input value={nome} onChange={(e) => setNome(e.target.value)} onBlur={() => dirty && salvar()} className="h-9" /></TableCell>
      <TableCell><Input value={cargo} onChange={(e) => setCargo(e.target.value)} onBlur={() => dirty && salvar()} placeholder="—" className="h-9" /></TableCell>
      <TableCell><ClassifSelect value={classificacao} onChange={(v) => { setClassificacao(v); upsert.mutate({ id: relator.id, nome, cargo: cargo || null, classificacao: v, observacao: obs || null }); }} /></TableCell>
      <TableCell><Input value={obs} onChange={(e) => setObs(e.target.value)} onBlur={() => dirty && salvar()} placeholder="—" className="h-9" /></TableCell>
      <TableCell className="w-12">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4" /></Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir relator?</AlertDialogTitle>
              <AlertDialogDescription>Tem certeza que deseja excluir <strong>{relator.nome}</strong>?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => del.mutate(relator.id)}>Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  );
}

function NovaTurmaInline() {
  const [nome, setNome] = useState("");
  const [classificacao, setClassificacao] = useState<ClassificacaoTst>("POSITIVO");
  const [obs, setObs] = useState("");
  const upsert = useUpsertTurmaTst();

  const adicionar = () => {
    if (!nome.trim()) return;
    upsert.mutate(
      { nome, classificacao, observacao: obs || null },
      { onSuccess: () => { setNome(""); setObs(""); setClassificacao("POSITIVO"); } },
    );
  };

  return (
    <TableRow className="bg-muted/30">
      <TableCell><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nova turma / órgão" className="h-9" /></TableCell>
      <TableCell><ClassifSelect value={classificacao} onChange={setClassificacao} /></TableCell>
      <TableCell><Input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observação (opcional)" className="h-9" /></TableCell>
      <TableCell>
        <Button size="icon" className="h-8 w-8" onClick={adicionar} disabled={upsert.isPending || !nome.trim()}>
          {upsert.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
      </TableCell>
    </TableRow>
  );
}

function NovoRelatorInline() {
  const [nome, setNome] = useState("");
  const [cargo, setCargo] = useState("");
  const [classificacao, setClassificacao] = useState<ClassificacaoTst>("POSITIVO");
  const [obs, setObs] = useState("");
  const upsert = useUpsertRelatorTst();

  const adicionar = () => {
    if (!nome.trim()) return;
    upsert.mutate(
      { nome, cargo: cargo || null, classificacao, observacao: obs || null },
      { onSuccess: () => { setNome(""); setCargo(""); setObs(""); setClassificacao("POSITIVO"); } },
    );
  };

  return (
    <TableRow className="bg-muted/30">
      <TableCell><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Novo ministro / relator" className="h-9" /></TableCell>
      <TableCell><Input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Cargo (opcional)" className="h-9" /></TableCell>
      <TableCell><ClassifSelect value={classificacao} onChange={setClassificacao} /></TableCell>
      <TableCell><Input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observação (opcional)" className="h-9" /></TableCell>
      <TableCell>
        <Button size="icon" className="h-8 w-8" onClick={adicionar} disabled={upsert.isPending || !nome.trim()}>
          {upsert.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
      </TableCell>
    </TableRow>
  );
}

export default function ClassificacaoTst() {
  const [busca, setBusca] = useState("");
  const { data: turmas = [], isLoading: loadingT } = useTurmasTst();
  const { data: relatores = [], isLoading: loadingR } = useRelatoresTst();

  const turmasFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return turmas;
    return turmas.filter(t => t.nome.toLowerCase().includes(q) || t.classificacao.toLowerCase().includes(q));
  }, [turmas, busca]);

  const relatoresFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return relatores;
    return relatores.filter(r =>
      r.nome.toLowerCase().includes(q) ||
      (r.cargo || "").toLowerCase().includes(q) ||
      r.classificacao.toLowerCase().includes(q),
    );
  }, [relatores, busca]);

  const totaisR = useMemo(() => {
    const t = { positivo: 0, negativo: 0, impedida: 0 };
    for (const r of relatores) {
      if (r.classificacao === "POSITIVO") t.positivo++;
      else if (r.classificacao === "NEGATIVO") t.negativo++;
      else t.impedida++;
    }
    return t;
  }, [relatores]);

  return (
    <MainLayout title="Classificação TST">
      <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center">
              <Scale className="w-5 h-5 text-sky-700" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Classificação TST</h1>
              <p className="text-sm text-muted-foreground">
                Cadastro editável de Turmas e Relatores. Aplicado automaticamente quando a Judit retorna a turma e o relator do processo.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card><CardContent className="p-4 flex items-center justify-between">
              <div><p className="text-sm text-muted-foreground">Relatores Positivos</p><p className="text-2xl font-bold text-green-700">{totaisR.positivo}</p></div>
              <ThumbsUp className="w-8 h-8 text-green-600" />
            </CardContent></Card>
            <Card><CardContent className="p-4 flex items-center justify-between">
              <div><p className="text-sm text-muted-foreground">Relatores Negativos</p><p className="text-2xl font-bold text-red-700">{totaisR.negativo}</p></div>
              <ThumbsDown className="w-8 h-8 text-red-600" />
            </CardContent></Card>
            <Card><CardContent className="p-4 flex items-center justify-between">
              <div><p className="text-sm text-muted-foreground">Impedidos</p><p className="text-2xl font-bold text-amber-700">{totaisR.impedida}</p></div>
              <Ban className="w-8 h-8 text-amber-600" />
            </CardContent></Card>
          </div>

          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome, cargo ou classificação..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-9" />
          </div>

          <Tabs defaultValue="turmas" className="w-full">
            <TabsList>
              <TabsTrigger value="turmas">Turmas / Órgãos ({turmas.length})</TabsTrigger>
              <TabsTrigger value="relatores">Ministros / Relatores ({relatores.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="turmas">
              <Card>
                <CardHeader><CardTitle className="text-base">Turmas e Órgãos do TST</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead className="w-[180px]">Classificação</TableHead>
                        <TableHead>Observação</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <NovaTurmaInline />
                      {loadingT && (
                        <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Carregando...</TableCell></TableRow>
                      )}
                      {!loadingT && turmasFiltradas.map(t => <TurmaRow key={t.id} turma={t} />)}
                      {!loadingT && turmasFiltradas.length === 0 && (
                        <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Nenhuma turma encontrada.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="relatores">
              <Card>
                <CardHeader><CardTitle className="text-base">Ministros e Desembargadores</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Cargo</TableHead>
                        <TableHead className="w-[180px]">Classificação</TableHead>
                        <TableHead>Observação</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <NovoRelatorInline />
                      {loadingR && (
                        <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Carregando...</TableCell></TableRow>
                      )}
                      {!loadingR && relatoresFiltrados.map(r => <RelatorRow key={r.id} relator={r} />)}
                      {!loadingR && relatoresFiltrados.length === 0 && (
                        <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Nenhum relator encontrado.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <p className="text-xs text-muted-foreground">
            <ClassifBadge c="POSITIVO" /> &nbsp; <ClassifBadge c="NEGATIVO" /> &nbsp; <ClassifBadge c="IMPEDIDA" />
          </p>
      </div>
    </MainLayout>
  );
}
