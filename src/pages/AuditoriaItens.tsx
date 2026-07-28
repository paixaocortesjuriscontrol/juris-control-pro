import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Search, Eye, CheckCircle2, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MainLayout } from "@/components/layout/MainLayout";

interface AuditoriaRow {
  id: string;
  created_at: string;
  usuario_id: string | null;
  acao: string;
  sucesso: boolean;
  origem: string;
  tipo_item: string | null;
  processo_id: string | null;
  tarefa_id: string | null;
  coordenacao_id: string | null;
  dados_entrada: any;
  dados_saida: any;
  erro_mensagem: string | null;
  erro_detalhes: any;
  user_agent: string | null;
  campos_alterados: any;
}

const TIPOS = ["tarefa", "prazo", "evento", "audiencia", "parcelamento"] as const;
const ACOES = ["criar", "atualizar", "deletar", "erro_criar", "erro_atualizar", "erro_deletar"] as const;

const LABELS: Record<string, string> = {
  titulo: "Título",
  descricao: "Descrição",
  observacoes: "Observações",
  observacao: "Observação",
  status: "Situação",
  situacao: "Situação",
  prioridade: "Prioridade",
  data_vencimento: "Data de vencimento",
  data_fatal: "Data fatal",
  data_cumprimento: "Data de cumprimento",
  tratado_em: "Tratado em",
  responsavel_id: "Responsável",
  coordenacao_id: "Coordenação",
  processo_id: "Processo",
  data_inicio: "Data de início",
  data_fim: "Data de término",
  tipo: "Tipo",
  tipo_tarefa: "Tipo",
  local: "Local",
  valor: "Valor",
};

const labelCampo = (campo: string) => LABELS[campo] || campo.replace(/_/g, " ");

const formatValor = (v: any): string => {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (typeof v === "object") return JSON.stringify(v);
  const s = String(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
  if (m) return m[4] ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : `${m[3]}/${m[2]}/${m[1]}`;
  return s.length > 120 ? `${s.slice(0, 120)}…` : s;
};

const getDiff = (r: AuditoriaRow): { campo: string; de: any; para: any }[] => {
  if (Array.isArray(r.campos_alterados)) return r.campos_alterados;
  return [];
};

const getTituloItem = (r: AuditoriaRow): string => {
  const fonte = r.dados_saida || r.dados_entrada || {};
  return fonte?.titulo || fonte?.descricao || fonte?.nome || "—";
};

export default function AuditoriaItens() {
  const [tipoItem, setTipoItem] = useState<string>("todos");
  const [acao, setAcao] = useState<string>("todos");
  const [sucesso, setSucesso] = useState<string>("todos");
  const [origem, setOrigem] = useState("");
  const [buscaUsuario, setBuscaUsuario] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [selected, setSelected] = useState<AuditoriaRow | null>(null);

  const { data: rows, isLoading, refetch } = useQuery({
    queryKey: ["auditoria-itens", tipoItem, acao, sucesso, origem, dataInicio, dataFim],
    queryFn: async () => {
      let q: any = supabase
        .from("auditoria_tarefas")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (tipoItem !== "todos") q = q.eq("tipo_item", tipoItem);
      if (acao !== "todos") q = q.eq("acao", acao);
      if (sucesso !== "todos") q = q.eq("sucesso", sucesso === "sim");
      if (origem.trim()) q = q.ilike("origem", `%${origem.trim()}%`);
      if (dataInicio) q = q.gte("created_at", `${dataInicio}T00:00:00`);
      if (dataFim) q = q.lte("created_at", `${dataFim}T23:59:59`);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as AuditoriaRow[];
    },
  });

  const userIds = useMemo(
    () => Array.from(new Set((rows || []).map((r) => r.usuario_id).filter(Boolean) as string[])),
    [rows]
  );
  const { data: profiles } = useQuery({
    queryKey: ["auditoria-profiles", userIds.sort().join(",")],
    queryFn: async () => {
      if (userIds.length === 0) return {} as Record<string, string>;
      const { data } = await supabase
        .from("profiles")
        .select("id, nome_completo, email")
        .in("id", userIds);
      const map: Record<string, string> = {};
      (data || []).forEach((p: any) => {
        map[p.id] = p.nome_completo || p.email || p.id;
      });
      return map;
    },
    enabled: userIds.length > 0,
  });

  const nomeUsuario = (id: string | null) =>
    id ? profiles?.[id] || id.slice(0, 8) : "—";

  const rowsFiltradas = useMemo(() => {
    const termo = buscaUsuario.trim().toLowerCase();
    if (!termo) return rows || [];
    return (rows || []).filter((r) =>
      nomeUsuario(r.usuario_id).toLowerCase().includes(termo)
    );
  }, [rows, buscaUsuario, profiles]);

  return (
    <MainLayout
      title="Auditoria de Itens"
      subtitle="Histórico de criação, atualização e exclusão de tarefas, prazos, eventos, audiências e parcelamentos."
    >
      <div className="space-y-6">

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <Label>Tipo</Label>
            <Select value={tipoItem} onValueChange={setTipoItem}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Ação</Label>
            <Select value={acao} onValueChange={setAcao}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                {ACOES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Resultado</Label>
            <Select value={sucesso} onValueChange={setSucesso}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="sim">Sucesso</SelectItem>
                <SelectItem value="nao">Falha</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Origem (tela)</Label>
            <Input value={origem} onChange={(e) => setOrigem(e.target.value)} placeholder="ex: nova_tarefa_page" />
          </div>
          <div>
            <Label>De</Label>
            <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </div>
          <div>
            <Label>Até</Label>
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </div>
          <div className="md:col-span-3 lg:col-span-6 flex justify-end">
            <Button onClick={() => refetch()} variant="secondary">
              <Search className="w-4 h-4 mr-2" /> Aplicar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Registros {rows ? `(${rows.length})` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (rows || []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center">
              Nenhum registro encontrado com os filtros atuais.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Resultado</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(rows || []).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {format(new Date(r.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.usuario_id ? (profiles?.[r.usuario_id] || r.usuario_id.slice(0, 8)) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{r.tipo_item || "—"}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{r.acao}</TableCell>
                      <TableCell>
                        {r.sucesso ? (
                          <span className="inline-flex items-center gap-1 text-green-600 text-xs">
                            <CheckCircle2 className="w-4 h-4" /> Sucesso
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600 text-xs">
                            <XCircle className="w-4 h-4" /> Falha
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.origem}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => setSelected(r)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detalhes do registro</DialogTitle>
          </DialogHeader>
          {selected && (
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-4 text-sm pr-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><span className="text-muted-foreground">Data:</span> {format(new Date(selected.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}</div>
                  <div><span className="text-muted-foreground">Usuário:</span> {selected.usuario_id ? (profiles?.[selected.usuario_id] || selected.usuario_id) : "—"}</div>
                  <div><span className="text-muted-foreground">Tipo:</span> {selected.tipo_item || "—"}</div>
                  <div><span className="text-muted-foreground">Ação:</span> {selected.acao}</div>
                  <div><span className="text-muted-foreground">Origem:</span> {selected.origem}</div>
                  <div><span className="text-muted-foreground">Resultado:</span> {selected.sucesso ? "Sucesso" : "Falha"}</div>
                  <div><span className="text-muted-foreground">Processo:</span> {selected.processo_id || "—"}</div>
                  <div><span className="text-muted-foreground">Item ID:</span> {selected.tarefa_id || "—"}</div>
                  <div><span className="text-muted-foreground">Coordenação:</span> {selected.coordenacao_id || "—"}</div>
                </div>
                {selected.erro_mensagem && (
                  <div>
                    <div className="font-medium text-red-600 mb-1">Erro</div>
                    <pre className="bg-red-50 dark:bg-red-950/20 p-3 rounded text-xs whitespace-pre-wrap">{selected.erro_mensagem}</pre>
                    {selected.erro_detalhes && (
                      <pre className="bg-muted p-3 rounded text-xs mt-2 whitespace-pre-wrap">{JSON.stringify(selected.erro_detalhes, null, 2)}</pre>
                    )}
                  </div>
                )}
                <div>
                  <div className="font-medium mb-1">Dados de entrada</div>
                  <pre className="bg-muted p-3 rounded text-xs whitespace-pre-wrap">{JSON.stringify(selected.dados_entrada, null, 2)}</pre>
                </div>
                {selected.dados_saida && (
                  <div>
                    <div className="font-medium mb-1">Dados de saída</div>
                    <pre className="bg-muted p-3 rounded text-xs whitespace-pre-wrap">{JSON.stringify(selected.dados_saida, null, 2)}</pre>
                  </div>
                )}
                {selected.user_agent && (
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">User agent:</span> {selected.user_agent}
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </MainLayout>
  );
}