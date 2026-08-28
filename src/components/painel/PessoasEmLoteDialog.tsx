import { useMemo, useState } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PeoplePicker } from "@/components/shared/PeoplePicker";
import { ResponsaveisSelector } from "@/components/distribuicao-tst/ResponsaveisSelector";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useCoordenacoesDoUsuario } from "@/hooks/useCoordenacoesDoUsuario";
import { useSituacoesPainel } from "@/hooks/useSituacoesPainel";
import {
  usePessoasEmLoteItens,
  aplicarPessoasEmLote,
  LOTE_TIPOS,
  labelTipoLote,
  type LoteItem,
  type LoteTipo,
  type PessoasEmLoteFiltros,
} from "@/hooks/usePessoasEmLote";
import {
  Loader2,
  Users,
  Search,
  ListChecks,
  Info,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const hojeStr = () => format(new Date(), "yyyy-MM-dd");

export function PessoasEmLoteDialog({ open, onOpenChange }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { isAdmin, coordenacoes } = useCoordenacoesDoUsuario();
  const { options: situacaoOptions } = useSituacoesPainel();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [buscou, setBuscou] = useState(false);
  const [filtros, setFiltros] = useState<PessoasEmLoteFiltros>({
    inicio: format(startOfMonth(new Date()), "yyyy-MM-dd"),
    fim: format(endOfMonth(new Date()), "yyyy-MM-dd"),
    tipos: [],
    coordenacaoIds: [],
    responsavelIds: [],
    situacoes: [],
    busca: "",
  });

  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [atividadesSel, setAtividadesSel] = useState<Set<string>>(new Set());
  const [novosResponsaveis, setNovosResponsaveis] = useState<string[]>([]);
  const [novosEnvolvidos, setNovosEnvolvidos] = useState<string[]>([]);
  const [aplicando, setAplicando] = useState(false);
  const [progresso, setProgresso] = useState({ feitos: 0, total: 0 });
  const [erros, setErros] = useState<string[]>([]);

  const coordenacoesPermitidas = useMemo(() => coordenacoes.map((c) => c.id), [coordenacoes]);

  const {
    data: itens = [],
    isFetching,
    refetch,
  } = usePessoasEmLoteItens(filtros, coordenacoesPermitidas, isAdmin, open && buscou);

  const itensSelecionados = useMemo(
    () => itens.filter((i) => selecionados.has(i.key)),
    [itens, selecionados],
  );

  const resetar = () => {
    setStep(1);
    setBuscou(false);
    setSelecionados(new Set());
    setAtividadesSel(new Set());
    setNovosResponsaveis([]);
    setNovosEnvolvidos([]);
    setErros([]);
    setProgresso({ feitos: 0, total: 0 });
  };

  const fechar = (v: boolean) => {
    if (!v) resetar();
    onOpenChange(v);
  };

  const toggleTipo = (tipo: LoteTipo) => {
    setFiltros((f) => ({
      ...f,
      tipos: f.tipos.includes(tipo) ? f.tipos.filter((t) => t !== tipo) : [...f.tipos, tipo],
    }));
  };

  const toggleItem = (item: LoteItem) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(item.key)) {
        next.delete(item.key);
        setAtividadesSel((atv) => {
          const nv = new Set(atv);
          item.atividades.forEach((a) => nv.delete(a.id));
          return nv;
        });
      } else {
        next.add(item.key);
      }
      return next;
    });
  };

  const toggleAtividade = (item: LoteItem, atividadeId: string) => {
    setAtividadesSel((prev) => {
      const next = new Set(prev);
      if (next.has(atividadeId)) next.delete(atividadeId);
      else {
        next.add(atividadeId);
        setSelecionados((sel) => new Set(sel).add(item.key));
      }
      return next;
    });
  };

  const selecionarTodos = () => {
    if (selecionados.size === itens.length) {
      setSelecionados(new Set());
      setAtividadesSel(new Set());
    } else {
      setSelecionados(new Set(itens.map((i) => i.key)));
    }
  };

  const buscar = async () => {
    setBuscou(true);
    setSelecionados(new Set());
    setAtividadesSel(new Set());
    setStep(2);
    await refetch();
  };

  const aplicar = async () => {
    if (itensSelecionados.length === 0) return;
    if (novosResponsaveis.length === 0 && novosEnvolvidos.length === 0) {
      toast({
        title: "Selecione pessoas",
        description: "Escolha ao menos um responsável ou envolvido para acrescentar.",
        variant: "destructive",
      });
      return;
    }
    setAplicando(true);
    setErros([]);
    setProgresso({ feitos: 0, total: itensSelecionados.length });
    try {
      const res = await aplicarPessoasEmLote({
        itens: itensSelecionados,
        atividadesIds: Array.from(atividadesSel),
        responsaveis: novosResponsaveis,
        envolvidos: novosEnvolvidos,
        usuarioAtualId: user?.id ?? null,
        onProgress: (feitos, total) => setProgresso({ feitos, total }),
      });
      setErros(res.erros);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["agenda-unificada"] }),
        queryClient.invalidateQueries({ queryKey: ["pessoas-em-lote-itens"] }),
        queryClient.invalidateQueries({ queryKey: ["itens-com-atividades"] }),
        queryClient.invalidateQueries({ queryKey: ["contagem-atividades-itens"] }),
        queryClient.invalidateQueries({ queryKey: ["tarefas"] }),
        queryClient.invalidateQueries({ queryKey: ["eventos-agenda"] }),
      ]);

      toast({
        title: "Pessoas acrescentadas",
        description: `${res.itensAlterados} item(ns) e ${res.atividadesAlteradas} atividade(s) atualizados.${
          res.erros.length ? ` ${res.erros.length} falha(s).` : ""
        }`,
      });
      if (res.erros.length === 0) fechar(false);
    } catch (e: any) {
      toast({ title: "Erro ao aplicar", description: e?.message, variant: "destructive" });
    } finally {
      setAplicando(false);
    }
  };

  const totalAtividades = useMemo(
    () => itens.reduce((acc, i) => acc + i.atividades.length, 0),
    [itens],
  );

  return (
    <Dialog open={open} onOpenChange={fechar}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-4 h-4" /> Acrescentar pessoas em lote
          </DialogTitle>
          <DialogDescription>
            Passo {step} de 3 — a operação é somente aditiva: ninguém é removido dos itens.
          </DialogDescription>
        </DialogHeader>

        {/* PASSO 1 — FILTROS */}
        {step === 1 && (
          <div className="space-y-4 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Data inicial</Label>
                <Input
                  type="date"
                  value={filtros.inicio}
                  max={filtros.fim}
                  onChange={(e) => setFiltros((f) => ({ ...f, inicio: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Data final</Label>
                <Input
                  type="date"
                  value={filtros.fim}
                  min={filtros.inicio}
                  onChange={(e) => setFiltros((f) => ({ ...f, fim: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Tipos (vazio = todos)</Label>
              <div className="flex flex-wrap gap-2">
                {LOTE_TIPOS.map((t) => (
                  <Badge
                    key={t.value}
                    variant={filtros.tipos.includes(t.value) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleTipo(t.value)}
                  >
                    {t.label}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Coordenação (vazio = todas as suas)</Label>
              <Select
                value={filtros.coordenacaoIds[0] ?? "todas"}
                onValueChange={(v) =>
                  setFiltros((f) => ({ ...f, coordenacaoIds: v === "todas" ? [] : [v] }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as coordenações permitidas</SelectItem>
                  {coordenacoes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Responsável/envolvido atual (opcional)</Label>
              <ResponsaveisSelector
                selectedIds={filtros.responsavelIds}
                onChange={(ids) => setFiltros((f) => ({ ...f, responsavelIds: ids }))}
                placeholder="Qualquer pessoa"
                coordenacaoId={filtros.coordenacaoIds[0] ?? null}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Situação (vazio = todas)</Label>
              <div className="flex flex-wrap gap-2">
                {situacaoOptions.map((s) => (
                  <Badge
                    key={s.value}
                    variant={filtros.situacoes.includes(s.value) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() =>
                      setFiltros((f) => ({
                        ...f,
                        situacoes: f.situacoes.includes(s.value)
                          ? f.situacoes.filter((v) => v !== s.value)
                          : [...f.situacoes, s.value],
                      }))
                    }
                  >
                    {s.label}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Buscar por título ou processo</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Opcional"
                  value={filtros.busca}
                  onChange={(e) => setFiltros((f) => ({ ...f, busca: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => fechar(false)}>
                Cancelar
              </Button>
              <Button onClick={buscar} disabled={!filtros.inicio || !filtros.fim}>
                Listar itens <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* PASSO 2 — LISTA */}
        {step === 2 && (
          <div className="flex-1 flex flex-col min-h-0 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground">
                {format(new Date(`${filtros.inicio}T12:00:00`), "dd/MM/yyyy", { locale: ptBR })} a{" "}
                {format(new Date(`${filtros.fim}T12:00:00`), "dd/MM/yyyy", { locale: ptBR })} •{" "}
                {itens.length} item(ns), {totalAtividades} atividade(s) • {selecionados.size}{" "}
                selecionado(s)
              </div>
              <Button variant="ghost" size="sm" onClick={selecionarTodos} disabled={itens.length === 0}>
                {selecionados.size === itens.length && itens.length > 0
                  ? "Desmarcar todos"
                  : "Selecionar todos"}
              </Button>
            </div>

            <ScrollArea className="flex-1 min-h-[280px] rounded-md border p-3">
              {isFetching ? (
                <div className="flex items-center justify-center py-10 text-sm text-muted-foreground gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Carregando itens...
                </div>
              ) : itens.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">
                  Nenhum item encontrado com esses filtros.
                </p>
              ) : (
                <div className="space-y-2">
                  {itens.map((item) => (
                    <div key={item.key} className="rounded-md border p-2">
                      <div className="flex items-start gap-2">
                        <Checkbox
                          checked={selecionados.has(item.key)}
                          onCheckedChange={() => toggleItem(item)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-[10px]">
                              {labelTipoLote(item.tipo)}
                            </Badge>
                            <span className="text-sm font-medium truncate">{item.titulo}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3">
                            {item.data && (
                              <span>
                                {format(
                                  new Date(
                                    item.data.length <= 10 ? `${item.data}T12:00:00` : item.data,
                                  ),
                                  "dd/MM/yyyy",
                                )}
                              </span>
                            )}
                            {item.processo_numero && <span className="font-mono">{item.processo_numero}</span>}
                            {item.status && <span>{item.status}</span>}
                            <span>
                              {item.responsaveis.length} resp. / {item.envolvidos.length} env.
                            </span>
                          </div>

                          {item.atividades.length > 0 && (
                            <div className="mt-2 pl-2 border-l space-y-1">
                              {item.atividades.map((at) => (
                                <label
                                  key={at.id}
                                  className="flex items-center gap-2 text-xs cursor-pointer"
                                >
                                  <Checkbox
                                    checked={atividadesSel.has(at.id)}
                                    onCheckedChange={() => toggleAtividade(item, at.id)}
                                  />
                                  <ListChecks className="w-3 h-3 text-emerald-600" />
                                  <span className="truncate">{at.titulo}</span>
                                  {at.responsavel_id && (
                                    <Badge variant="secondary" className="text-[10px]">
                                      já tem responsável
                                    </Badge>
                                  )}
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Filtros
              </Button>
              <Button onClick={() => setStep(3)} disabled={selecionados.size === 0}>
                Escolher pessoas <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* PASSO 3 — PESSOAS */}
        {step === 3 && (
          <div className="space-y-4 overflow-y-auto pr-1">
            <Alert>
              <Info className="w-4 h-4" />
              <AlertDescription className="text-xs">
                {itensSelecionados.length} item(ns) e {atividadesSel.size} atividade(s) selecionados.
                As pessoas serão <strong>acrescentadas</strong>; quem já está vinculado permanece.
                Atividades que já possuem responsável mantêm o responsável atual e as pessoas entram
                como envolvidos do item pai.
              </AlertDescription>
            </Alert>

            <div className="space-y-1.5">
              <Label className="text-xs">Acrescentar responsáveis</Label>
              <PeoplePicker
                selectedIds={novosResponsaveis}
                onChange={setNovosResponsaveis}
                placeholder="Adicionar responsável"
                icon="users"
              />
            </div>

            <Separator />

            <div className="space-y-1.5">
              <Label className="text-xs">Acrescentar envolvidos</Label>
              <PeoplePicker
                selectedIds={novosEnvolvidos}
                onChange={setNovosEnvolvidos}
                placeholder="Adicionar envolvido"
                icon="users"
              />
            </div>

            {aplicando && (
              <div className="space-y-1">
                <Progress
                  value={progresso.total ? (progresso.feitos / progresso.total) * 100 : 0}
                />
                <p className="text-xs text-muted-foreground text-center">
                  {progresso.feitos} de {progresso.total} itens processados
                </p>
              </div>
            )}

            {erros.length > 0 && (
              <div className="rounded-md border border-destructive/40 p-2">
                <p className="text-xs font-medium text-destructive mb-1">
                  {erros.length} falha(s):
                </p>
                <ScrollArea className="max-h-32">
                  <ul className="text-xs space-y-0.5 text-muted-foreground">
                    {erros.map((e, i) => (
                      <li key={i}>• {e}</li>
                    ))}
                  </ul>
                </ScrollArea>
              </div>
            )}

            <div className="flex justify-between gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep(2)} disabled={aplicando}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Itens
              </Button>
              <Button
                onClick={aplicar}
                disabled={
                  aplicando ||
                  (novosResponsaveis.length === 0 && novosEnvolvidos.length === 0)
                }
              >
                {aplicando ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                )}
                Aplicar em {itensSelecionados.length} item(ns)
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
