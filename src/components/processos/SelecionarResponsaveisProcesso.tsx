import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
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
  const [coordenacaoFiltro, setCoordenacaoFiltro] = useState<string>(coordenacaoIdPadrao || "all");

  // Fetch coordenações
  const { data: coordenacoes = [] } = useQuery({
    queryKey: ["coordenacoes-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coordenacoes")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch todos os membros de coordenação
  const { data: todosMembros = [] } = useQuery({
    queryKey: ["membros-coordenacao-todos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("membros_coordenacao")
        .select(`
          id,
          coordenacao_id,
          usuario_id,
          usuario:profiles!membros_coordenacao_usuario_id_fkey(id, nome),
          coordenacao:coordenacoes!membros_coordenacao_coordenacao_id_fkey(id, nome)
        `)
        .order("usuario_id");
      if (error) throw error;
      return data || [];
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
          usuario:profiles!processos_responsaveis_usuario_id_fkey(id, nome),
          coordenacao:coordenacoes!processos_responsaveis_coordenacao_id_fkey(id, nome)
        `)
        .eq("processo_id", processoId)
        .eq("ativo", true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!processoId,
  });

  // Sincronizar valor inicial quando carregar responsáveis existentes
  useEffect(() => {
    if (responsaveisExistentes && responsaveisExistentes.length > 0) {
      // Sempre sincronizar quando os dados existentes forem carregados
      const existingIds = responsaveisExistentes.map(r => r.usuario_id).sort().join(',');
      const currentIds = value.map(r => r.usuario_id).sort().join(',');
      if (existingIds !== currentIds) {
        onChange(responsaveisExistentes as Responsavel[]);
      }
    }
  }, [responsaveisExistentes]);

  // Filtrar membros por coordenação
  const membrosFiltrados = coordenacaoFiltro === "all" 
    ? todosMembros 
    : todosMembros.filter(m => m.coordenacao_id === coordenacaoFiltro);

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
      onChange(value.filter(r => r.usuario_id !== membro.usuario_id));
    } else {
      onChange([
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
    onChange(value.filter(r => r.usuario_id !== usuarioId));
  };

  const handleChangePapel = (usuarioId: string, papel: string) => {
    onChange(
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
            <div className="p-2 border-b">
              <Select value={coordenacaoFiltro} onValueChange={setCoordenacaoFiltro}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Filtrar por coordenação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as coordenações</SelectItem>
                  {coordenacoes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
