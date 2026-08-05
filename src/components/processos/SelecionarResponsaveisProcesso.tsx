import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useCoordenacoesDoUsuario } from "@/hooks/useCoordenacoesDoUsuario";

interface Responsavel {
  id: string;
  usuario_id: string;
  coordenacao_id: string | null;
  papel: string;
  usuario?: {
    id: string;
    nome: string;
  };
  coordenacao?: {
    id: string;
    nome: string;
  };
}

interface SelecionarResponsaveisProcessoProps {
  processoId?: string;
  value: Responsavel[];
  onChange: (responsaveis: Responsavel[]) => void;
  coordenacaoIdPadrao?: string;
}

export function SelecionarResponsaveisProcesso({
  processoId,
  value = [],
  onChange,
  coordenacaoIdPadrao,
}: SelecionarResponsaveisProcessoProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const syncedFor = useRef<string | null>(null);
  const {
    isAdmin,
    coordenacoes: coordenacoesDoUsuario,
    unicaCoordenacaoId,
    precisaSelecionar,
  } = useCoordenacoesDoUsuario();
  const [coordenacaoFiltro, setCoordenacaoFiltro] = useState<string>(
    coordenacaoIdPadrao || "all"
  );

  // Usuário de uma única coordenação: trava o filtro nela.
  useEffect(() => {
    if (coordenacaoIdPadrao) return;
    if (unicaCoordenacaoId) setCoordenacaoFiltro(unicaCoordenacaoId);
  }, [unicaCoordenacaoId, coordenacaoIdPadrao]);

  const coordenacoes = coordenacoesDoUsuario;

  // Fetch todos os membros de coordenação.
  // Importante: nomes vêm de `profiles_basic` (visível a todos os perfis),
  // pois `profiles` é restrito por RLS e deixava o nome vazio ("Usuário").
  const { data: todosMembros = [] } = useQuery({
    queryKey: ["membros-coordenacao-todos-basic"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("membros_coordenacao")
        .select(`
          id,
          coordenacao_id,
          usuario_id,
          coordenacao:coordenacoes!membros_coordenacao_coordenacao_id_fkey(id, nome)
        `)
        .order("usuario_id");
      if (error) throw error;
      const rows = data || [];
      const ids = [...new Set(rows.map((r: any) => r.usuario_id).filter(Boolean))];
      const nomes = new Map<string, string>();
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from("profiles_basic" as any)
          .select("id, nome")
          .in("id", ids);
        ((profs as any[]) || []).forEach((p: any) => nomes.set(p.id, p.nome));
      }
      return rows.map((r: any) => ({
        ...r,
        usuario: { id: r.usuario_id, nome: nomes.get(r.usuario_id) || "Usuário" },
      }));
    },
  });

  // Carregar responsáveis existentes se tiver processo
  const { data: responsaveisExistentes } = useQuery({
    queryKey: ["processos-responsaveis", processoId],
    queryFn: async () => {
      if (!processoId) return [];
      const { data, error } = await supabase
        .from("processos_responsaveis")
        .select(`
          id,
          usuario_id,
          coordenacao_id,
          papel,
          coordenacao:coordenacoes!processos_responsaveis_coordenacao_id_fkey(id, nome)
        `)
        .eq("processo_id", processoId)
        .eq("ativo", true);
      if (error) throw error;
      const rows = data || [];
      const ids = [...new Set(rows.map((r: any) => r.usuario_id).filter(Boolean))];
      const nomes = new Map<string, string>();
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from("profiles_basic" as any)
          .select("id, nome")
          .in("id", ids);
        ((profs as any[]) || []).forEach((p: any) => nomes.set(p.id, p.nome));
      }
      return rows.map((r: any) => ({
        ...r,
        usuario: { id: r.usuario_id, nome: nomes.get(r.usuario_id) || "Usuário" },
      }));
    },
    enabled: !!processoId,
  });

  // Fallback: processos antigos guardam apenas `advogado_responsavel_id`.
  const { data: advogadoResponsavel } = useQuery({
    queryKey: ["processo-advogado-responsavel", processoId],
    queryFn: async () => {
      if (!processoId) return null;
      const { data, error } = await supabase
        .from("processos")
        .select("advogado_responsavel_id, coordenacao_id")
        .eq("id", processoId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      let advogado: { id: string; nome: string } | null = null;
      if (data.advogado_responsavel_id) {
        const { data: prof } = await supabase
          .from("profiles_basic" as any)
          .select("id, nome")
          .eq("id", data.advogado_responsavel_id)
          .maybeSingle();
        if (prof) advogado = { id: (prof as any).id, nome: (prof as any).nome };
      }
      return { ...data, advogado } as any;
    },
    enabled: !!processoId,
  });

  // Sincroniza o valor inicial apenas uma vez por processo, para não
  // sobrescrever alterações locais do usuário em refetches.
  useEffect(() => {
    if (!processoId || !responsaveisExistentes) return;
    if (syncedFor.current === processoId) return;
    if (responsaveisExistentes.length > 0) {
      syncedFor.current = processoId;
      onChange(responsaveisExistentes as Responsavel[]);
      return;
    }
    // Sem vínculos na tabela: usa o advogado responsável do processo.
    if (advogadoResponsavel === undefined) return;
    syncedFor.current = processoId;
    const adv = advogadoResponsavel?.advogado;
    if (adv?.id) {
      onChange([
        {
          id: crypto.randomUUID(),
          usuario_id: adv.id,
          coordenacao_id: advogadoResponsavel?.coordenacao_id || null,
          papel: "responsavel",
          usuario: { id: adv.id, nome: adv.nome },
        },
      ]);
    }
  }, [responsaveisExistentes, advogadoResponsavel, processoId]);

  /**
   * Persistência imediata (edição inline): sempre que a seleção muda e já
   * existe processo, grava direto no banco — assim o usuário não perde a
   * escolha caso não clique em "Salvar".
   */
  const persist = async (next: Responsavel[]) => {
    onChange(next);
    if (!processoId) return;
    try {
      await supabase
        .from("processos_responsaveis")
        .update({ ativo: false } as any)
        .eq("processo_id", processoId);
      if (next.length > 0) {
        const rows = next.map((r) => ({
          processo_id: processoId,
          usuario_id: r.usuario_id,
          coordenacao_id: r.coordenacao_id || null,
          papel: r.papel || "responsavel",
          ativo: true,
        }));
        const { error } = await supabase
          .from("processos_responsaveis")
          .upsert(rows as any, { onConflict: "processo_id,usuario_id" });
        if (error) throw error;
      }
      // Mantém o "advogado responsável" do processo em sincronia com o 1º selecionado.
      await supabase
        .from("processos")
        .update({ advogado_responsavel_id: next[0]?.usuario_id ?? null } as any)
        .eq("id", processoId);
      await queryClient.invalidateQueries({ queryKey: ["processos-responsaveis", processoId] });
      await queryClient.invalidateQueries({ queryKey: ["processo-advogado-responsavel", processoId] });
    } catch (e: any) {
      toast.error("Erro ao salvar responsáveis: " + (e?.message || ""));
    }
  };

  // Filtrar membros por coordenação (não-admin só enxerga as suas)
  const idsPermitidos = coordenacoes.map((c) => c.id);
  const membrosVisiveis = isAdmin
    ? todosMembros
    : todosMembros.filter((m) => idsPermitidos.includes(m.coordenacao_id as string));
  const membrosFiltrados = coordenacaoFiltro === "all"
    ? membrosVisiveis
    : membrosVisiveis.filter((m) => m.coordenacao_id === coordenacaoFiltro);

  // Agrupar membros únicos (pode estar em múltiplas coordenações)
  const membrosUnicos = membrosFiltrados.reduce((acc, m) => {
    const existing = acc.find(x => x.usuario_id === m.usuario_id);
    if (!existing && m.usuario) {
      acc.push({
        usuario_id: m.usuario_id,
        nome: m.usuario.nome,
        coordenacao_id: m.coordenacao_id,
        coordenacao_nome: m.coordenacao?.nome,
      });
    }
    return acc;
  }, [] as Array<{ usuario_id: string; nome: string; coordenacao_id: string; coordenacao_nome?: string }>);

  const isSelected = (usuarioId: string) => 
    value.some(r => r.usuario_id === usuarioId);

  const handleToggle = (membro: typeof membrosUnicos[0]) => {
    if (isSelected(membro.usuario_id)) {
      persist(value.filter(r => r.usuario_id !== membro.usuario_id));
    } else {
      persist([
        ...value,
        {
          id: crypto.randomUUID(),
          usuario_id: membro.usuario_id,
          coordenacao_id: membro.coordenacao_id,
          papel: "responsavel",
          usuario: { id: membro.usuario_id, nome: membro.nome },
          coordenacao: membro.coordenacao_nome 
            ? { id: membro.coordenacao_id, nome: membro.coordenacao_nome }
            : undefined,
        },
      ]);
    }
  };

  const handleRemove = (usuarioId: string) => {
    persist(value.filter(r => r.usuario_id !== usuarioId));
  };

  const handleChangePapel = (usuarioId: string, papel: string) => {
    persist(
      value.map(r => 
        r.usuario_id === usuarioId ? { ...r, papel } : r
      )
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="flex-1 justify-between"
            >
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>
                  {value.length === 0
                    ? "Selecionar responsáveis..."
                    : `${value.length} responsável(is) selecionado(s)`}
                </span>
              </div>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[350px] p-0" align="start">
            {precisaSelecionar && (
            <div className="p-2 border-b">
              <Select value={coordenacaoFiltro} onValueChange={setCoordenacaoFiltro}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Filtrar por coordenação" />
                </SelectTrigger>
                <SelectContent>
                  {isAdmin && <SelectItem value="all">Todas as coordenações</SelectItem>}
                  {coordenacoes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            )}
            <Command>
              <CommandInput placeholder="Buscar membro..." />
              <CommandList>
                <CommandEmpty>Nenhum membro encontrado.</CommandEmpty>
                <CommandGroup>
                  <ScrollArea className="h-[200px]">
                    {membrosUnicos.map((membro) => (
                      <CommandItem
                        key={membro.usuario_id}
                        value={membro.nome}
                        onSelect={() => handleToggle(membro)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            isSelected(membro.usuario_id) ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex-1">
                          <div className="font-medium">{membro.nome}</div>
                          {membro.coordenacao_nome && (
                            <div className="text-xs text-muted-foreground">
                              {membro.coordenacao_nome}
                            </div>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </ScrollArea>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((responsavel) => (
            <div
              key={responsavel.usuario_id}
              className="flex items-center gap-2 p-2 bg-muted/50 rounded-md"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">
                  {responsavel.usuario?.nome || "Usuário"}
                </div>
                {responsavel.coordenacao?.nome && (
                  <div className="text-xs text-muted-foreground truncate">
                    {responsavel.coordenacao.nome}
                  </div>
                )}
              </div>
              <Select
                value={responsavel.papel}
                onValueChange={(v) => handleChangePapel(responsavel.usuario_id, v)}
              >
                <SelectTrigger className="w-[120px] h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="responsavel">Responsável</SelectItem>
                  <SelectItem value="apoio">Apoio</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleRemove(responsavel.usuario_id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
