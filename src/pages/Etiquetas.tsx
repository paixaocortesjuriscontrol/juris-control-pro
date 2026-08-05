import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tag, Plus, MoreVertical, Loader2, Check, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ColorPalettePicker } from "@/components/distribuicao-tst/ColorPalettePicker";
import { useCoordenacoesFull } from "@/hooks/useCoordenacoes";
import { useCoordenacaoPadrao } from "@/hooks/useCoordenacaoPadrao";
import {
  useEtiquetas,
  useCriarEtiqueta,
  useAtualizarEtiqueta,
  useExcluirEtiqueta,
  useAplicarEtiquetaClienteBase,
  ETIQUETA_MODULOS,
  ETIQUETA_COLOR_PALETTE,
  type Etiqueta,
  type EtiquetaModulo,
} from "@/hooks/useEtiquetas";

const TODOS_MODULOS = ETIQUETA_MODULOS.map((m) => m.value) as EtiquetaModulo[];
const SEM_CLIENTE = "__sem_cliente__";

function useClientesLista() {
  return useQuery({
    queryKey: ["clientes", "etiquetas-lista"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome")
        .order("nome", { ascending: true });
      if (error) throw error;
      return ((data as any[]) || []) as { id: string; nome: string }[];
    },
    staleTime: 300_000,
  });
}

/**
 * Página "Etiquetas" — gestão por coordenação, no modelo Astrea:
 * criar, editar (nome, cor e módulos), excluir e buscar.
 */
export default function EtiquetasPage() {
  const { data: coordenacoes = [] } = useCoordenacoesFull();
  const { data: coordPadrao } = useCoordenacaoPadrao();
  const [coordId, setCoordId] = useState<string>("");

  const coordenacoesDisponiveis = useMemo(
    () => (coordenacoes as any[]).map((c) => ({ id: c.id, nome: c.nome })),
    [coordenacoes],
  );
  const coordSelecionada =
    coordId ||
    (coordPadrao && coordenacoesDisponiveis.some((c) => c.id === coordPadrao)
      ? coordPadrao
      : coordenacoesDisponiveis[0]?.id || "");

  const { data: etiquetas = [], isLoading } = useEtiquetas(coordSelecionada || undefined);
  const criar = useCriarEtiqueta();
  const atualizar = useAtualizarEtiqueta();
  const excluir = useExcluirEtiqueta();
  const aplicarBase = useAplicarEtiquetaClienteBase();
  const { data: clientes = [] } = useClientesLista();
  const clienteNomeById = useMemo(
    () => new Map(clientes.map((c) => [c.id, c.nome])),
    [clientes],
  );

  const [busca, setBusca] = useState("");
  const [criando, setCriando] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novaCor, setNovaCor] = useState(ETIQUETA_COLOR_PALETTE[10]);
  const [novosModulos, setNovosModulos] = useState<EtiquetaModulo[]>(TODOS_MODULOS);
  const [novoCliente, setNovoCliente] = useState<string>(SEM_CLIENTE);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editCor, setEditCor] = useState("");
  const [editModulos, setEditModulos] = useState<EtiquetaModulo[]>([]);
  const [editCliente, setEditCliente] = useState<string>(SEM_CLIENTE);
  const [excluindo, setExcluindo] = useState<Etiqueta | null>(null);
  const [aplicando, setAplicando] = useState<{ etiqueta: Etiqueta; total: number } | null>(null);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return q ? etiquetas.filter((e) => e.nome.toLowerCase().includes(q)) : etiquetas;
  }, [etiquetas, busca]);

  const toggleModulo = (
    arr: EtiquetaModulo[],
    set: (v: EtiquetaModulo[]) => void,
    m: EtiquetaModulo,
    checked: boolean,
  ) => set(checked ? [...arr, m] : arr.filter((x) => x !== m));

  const handleCriar = async () => {
    if (!novoNome.trim() || !coordSelecionada) return;
    await criar.mutateAsync({
      coordenacao_id: coordSelecionada,
      nome: novoNome,
      cor: novaCor,
      modulos: novosModulos,
      cliente_id: novoCliente === SEM_CLIENTE ? null : novoCliente,
    });
    setNovoNome("");
    setNovosModulos(TODOS_MODULOS);
    setNovoCliente(SEM_CLIENTE);
    setCriando(false);
  };

  const iniciarEdicao = (e: Etiqueta) => {
    setEditandoId(e.id);
    setEditNome(e.nome);
    setEditCor(e.cor);
    setEditModulos((e.modulos || []) as EtiquetaModulo[]);
    setEditCliente(e.cliente_id ?? SEM_CLIENTE);
  };

  const salvarEdicao = async () => {
    if (!editandoId) return;
    await atualizar.mutateAsync({
      id: editandoId,
      nome: editNome,
      cor: editCor,
      modulos: editModulos,
      cliente_id: editCliente === SEM_CLIENTE ? null : editCliente,
    });
    setEditandoId(null);
  };

  const iniciarAplicacaoBase = async (e: Etiqueta) => {
    const res = await aplicarBase.mutateAsync({ etiquetaId: e.id, dryRun: true });
    setAplicando({ etiqueta: e, total: Number(res?.total ?? 0) });
  };

  return (
    <MainLayout
      title="Etiquetas"
      subtitle="Crie, edite e exclua as etiquetas da sua coordenação. Cada coordenação tem suas próprias etiquetas."
    >
      <div className="container mx-auto p-4 space-y-4 max-w-4xl">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-primary" />
            <span className="font-semibold">Coordenação</span>
          </div>
          <Select value={coordSelecionada} onValueChange={setCoordId}>
            <SelectTrigger className="w-[320px]">
              <SelectValue placeholder="Selecione uma coordenação" />
            </SelectTrigger>
            <SelectContent>
              {coordenacoesDisponiveis.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar etiqueta..."
            className="w-56 h-9"
          />
          <Button size="sm" onClick={() => setCriando((v) => !v)} className="gap-1">
            <Plus className="w-4 h-4" /> Adicionar etiqueta
          </Button>
        </div>

        {criando && (
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Nome</Label>
                  <Input
                    value={novoNome}
                    onChange={(e) => setNovoNome(e.target.value)}
                    placeholder="Ex.: Urgente"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Cor</Label>
                  <ColorPalettePicker value={novaCor} onChange={setNovaCor} size="md" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cliente vinculado (opcional)</Label>
                <Select value={novoCliente} onValueChange={setNovoCliente}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Sem cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SEM_CLIENTE}>Sem cliente</SelectItem>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Com cliente vinculado, a etiqueta é aplicada automaticamente aos processos desse
                  cliente quando chegam novas publicações.
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Aparece nos módulos</Label>
                <div className="grid gap-1 sm:grid-cols-2">
                  {ETIQUETA_MODULOS.map((m) => (
                    <label key={m.value} className="flex items-center gap-2 text-xs">
                      <Checkbox
                        checked={novosModulos.includes(m.value)}
                        onCheckedChange={(v) =>
                          toggleModulo(novosModulos, setNovosModulos, m.value, !!v)
                        }
                      />
                      {m.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleCriar} disabled={criar.isPending}>
                  {criar.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  Salvar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setCriando(false)}>
                  <X className="w-4 h-4" /> Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-0 divide-y">
            {isLoading ? (
              <div className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando etiquetas...
              </div>
            ) : lista.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">
                Nenhuma etiqueta cadastrada nesta coordenação.
              </div>
            ) : (
              lista.map((e) =>
                editandoId === e.id ? (
                  <div key={e.id} className="p-4 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Nome</Label>
                        <Input value={editNome} onChange={(ev) => setEditNome(ev.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Cor</Label>
                        <ColorPalettePicker value={editCor} onChange={setEditCor} size="md" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Cliente vinculado (opcional)</Label>
                      <Select value={editCliente} onValueChange={setEditCliente}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Sem cliente" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={SEM_CLIENTE}>Sem cliente</SelectItem>
                          {clientes.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Aparece nos módulos</Label>
                      <div className="grid gap-1 sm:grid-cols-2">
                        {ETIQUETA_MODULOS.map((m) => (
                          <label key={m.value} className="flex items-center gap-2 text-xs">
                            <Checkbox
                              checked={editModulos.includes(m.value)}
                              onCheckedChange={(v) =>
                                toggleModulo(editModulos, setEditModulos, m.value, !!v)
                              }
                            />
                            {m.label}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={salvarEdicao} disabled={atualizar.isPending}>
                        {atualizar.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Check className="w-4 h-4" />
                        )}
                        Salvar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditandoId(null)}>
                        <X className="w-4 h-4" /> Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div key={e.id} className="p-3 flex items-center gap-3">
                    <Badge
                      className="text-[11px] text-primary-foreground"
                      style={{ backgroundColor: e.cor }}
                    >
                      {e.nome}
                    </Badge>
                    <div className="flex-1 flex flex-wrap gap-1">
                      {e.cliente_id && (
                        <span className="text-[10px] text-muted-foreground border rounded px-1 py-0.5">
                          Cliente: {clienteNomeById.get(e.cliente_id) ?? "—"}
                        </span>
                      )}
                      {ETIQUETA_MODULOS.filter((m) => (e.modulos || []).includes(m.value)).map(
                        (m) => (
                          <span
                            key={m.value}
                            className="text-[10px] text-muted-foreground border rounded px-1 py-0.5"
                          >
                            {m.label}
                          </span>
                        ),
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => iniciarEdicao(e)}>Editar</DropdownMenuItem>
                        {e.cliente_id && (
                          <DropdownMenuItem onClick={() => iniciarAplicacaoBase(e)}>
                            Aplicar na base (processos do cliente)
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setExcluindo(e)}
                        >
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ),
              )
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!excluindo} onOpenChange={(o) => !o && setExcluindo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir etiqueta</AlertDialogTitle>
            <AlertDialogDescription>
              A etiqueta "{excluindo?.nome}" será removida de todos os itens em que foi aplicada.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (excluindo) await excluir.mutateAsync(excluindo.id);
                setExcluindo(null);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!aplicando} onOpenChange={(o) => !o && setAplicando(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aplicar etiqueta na base</AlertDialogTitle>
            <AlertDialogDescription>
              {aplicando?.total ?? 0} processo(s) desta coordenação pertencem ao cliente
              {" "}
              {aplicando?.etiqueta.cliente_id
                ? clienteNomeById.get(aplicando.etiqueta.cliente_id) ?? ""
                : ""}
              . A etiqueta "{aplicando?.etiqueta.nome}" será aplicada a todos eles.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!aplicando?.total || aplicarBase.isPending}
              onClick={async () => {
                if (aplicando)
                  await aplicarBase.mutateAsync({
                    etiquetaId: aplicando.etiqueta.id,
                    dryRun: false,
                  });
                setAplicando(null);
              }}
            >
              Aplicar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}